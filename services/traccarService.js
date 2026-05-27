// services/traccarService.js
const axios = require('axios');
const { db } = require('../config/firebase');

class TraccarService {
  constructor() {
    this.traccarUrl = process.env.TRACCAR_URL || 'http://34.173.106.142:8082';
    this.traccarUser = process.env.TRACCAR_USER || 'admin@example.com';
    this.traccarPassword = process.env.TRACCAR_PASSWORD || 'admin';
    this.pollingInterval = null;
    this.lastPositions = new Map(); // Guardar últimas posiciones para evitar duplicados
  }

  /**
   * Iniciar polling de posiciones
   */
  startPolling(intervalSeconds = 10) {
    console.log(`🔄 Iniciando polling de Traccar cada ${intervalSeconds} segundos...`);

    // Detener polling anterior si existe
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Primera consulta inmediata
    this.fetchAndUpdatePositions();

    // Luego cada X segundos
    this.pollingInterval = setInterval(() => {
      this.fetchAndUpdatePositions();
    }, intervalSeconds * 1000);
  }

  /**
   * Detener polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('⏹️ Polling de Traccar detenido');
    }
  }

  /**
   * Obtener posiciones desde Traccar y actualizar Firebase
   */
  async fetchAndUpdatePositions() {
    try {
      // Obtener todas las posiciones actuales desde Traccar
      const response = await axios.get(`${this.traccarUrl}/api/positions`, {
        auth: {
          username: this.traccarUser,
          password: this.traccarPassword
        }
      });

      const positions = response.data;
      console.log(`📡 Traccar: ${positions.length} posiciones recibidas`);

      // Procesar cada posición
      for (const position of positions) {
        await this.processPosition(position);
      }

    } catch (error) {
      console.error('❌ Error consultando Traccar:', error.message);
    }
  }

  /**
   * Procesar una posición individual
   */
  async processPosition(position) {
    try {
      const deviceId = position.deviceId;
      const positionId = position.id;

      console.log(`🔄 Intentando procesar deviceId: ${deviceId}, positionId: ${positionId}`);

      // Verificar si ya procesamos esta posición
      const lastPositionId = this.lastPositions.get(deviceId);
      if (lastPositionId === positionId) {
        console.log(`⏭️ Posición ${positionId} ya procesada, skip`);
        return; // Ya procesada, skip
      }

      // Obtener información del dispositivo desde Traccar
      console.log(`📞 Consultando dispositivo ${deviceId} en Traccar...`);
      const deviceResponse = await axios.get(`${this.traccarUrl}/api/devices/${deviceId}`, {
        auth: {
          username: this.traccarUser,
          password: this.traccarPassword
        }
      });

      const device = deviceResponse.data;
      const uniqueId = device.uniqueId; // IMEI del GPS

      console.log(`🔍 Procesando posición de dispositivo: ${uniqueId} (deviceId: ${deviceId})`);

      // Buscar bus con este IMEI en Firestore
      const busesSnapshot = await db.collection('buses')
        .where('gps_imei', '==', uniqueId)
        .limit(1)
        .get();

      if (busesSnapshot.empty) {
        console.log(`⚠️ Bus no encontrado para IMEI: ${uniqueId}`);
        // Marcar como procesada para no seguir intentando
        this.lastPositions.set(deviceId, positionId);
        return;
      }

      const busDoc = busesSnapshot.docs[0];
      const busId = busDoc.id;
      const bus = busDoc.data();

      // Preparar datos de ubicación
      const ubicacion = {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed || 0,
        altitude: position.altitude || 0,
        course: position.course || 0,
        timestamp: position.deviceTime || position.fixTime || new Date().toISOString(),
        source: 'traccar-polling',
        deviceId: uniqueId
      };

      console.log(`💾 Actualizando bus ${bus.placa} con posición:`, ubicacion);

      // Actualizar ubicación actual del bus
      await db.collection('buses').doc(busId).update({
        ubicacion_actual: ubicacion,
        ultima_actualizacion: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Guardar en historial GPS
      await db.collection('gps_positions').add({
        bus_id: busId,
        placa: bus.placa,
        latitude: ubicacion.latitude,
        longitude: ubicacion.longitude,
        speed: ubicacion.speed,
        altitude: ubicacion.altitude,
        course: ubicacion.course,
        source: 'traccar-polling',
        device_id: uniqueId,
        timestamp: ubicacion.timestamp,
        createdAt: new Date().toISOString()
      });

      // Actualizar última posición procesada
      this.lastPositions.set(deviceId, positionId);

      console.log(`✅ Bus ${bus.placa} actualizado con posición de Traccar`);

      // Verificar alertas de proximidad
      await this.checkProximityAlerts(busId, ubicacion);

    } catch (error) {
      console.error(`❌ Error procesando posición (deviceId: ${position?.deviceId}):`, error.message);
      console.error('Stack trace:', error.stack);
    }
  }

  /**
   * Calcular distancia entre dos coordenadas (en metros) usando fórmula Haversine
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }

  /**
   * Verificar alertas de proximidad para alumnos
   */
  async checkProximityAlerts(busId, ubicacion) {
    try {
      const notificationService = require('./notificationService');

      // Obtener alumnos asignados a este bus
      const alumnosSnapshot = await db.collection('alumnos')
        .where('bus_id', '==', busId)
        .where('estado', '==', 'activo')
        .get();

      if (alumnosSnapshot.empty) {
        return; // No hay alumnos asignados a este bus
      }

      // Detectar ruta por hora actual
      const busDoc2 = await db.collection('buses').doc(busId).get();
      const busData = busDoc2.data();
      const colegioDoc = await db.collection('colegios').doc(busData.colegio_id).get();
      const horarios = colegioDoc.data()?.horarios_mapa;

      const ahora = new Date();
      const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
      const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

      let rutaActiva = 'ida';
      if (horarios?.regreso?.activo) {
        const inicioRegreso = timeToMin(horarios.regreso.inicio);
        const finRegreso = timeToMin(horarios.regreso.fin);
        if (horaActual >= inicioRegreso && horaActual <= finRegreso) rutaActiva = 'regreso';
      }

      // Verificar horario antes de enviar notificaciones
      const estaEnHorario = (horarios) => {
        if (!horarios) return true;
        const ahora2 = new Date();
        const dia = ahora2.getDay();
        const horaActual2 = ahora2.getHours() * 60 + ahora2.getMinutes();
        if (!horarios.diasActivos?.includes(dia)) return false;
        const enIda = horarios.ida?.activo && horaActual2 >= timeToMin(horarios.ida.inicio) && horaActual2 <= timeToMin(horarios.ida.fin);
        const enRegreso = horarios.regreso?.activo && horaActual2 >= timeToMin(horarios.regreso.inicio) && horaActual2 <= timeToMin(horarios.regreso.fin);
        return enIda || enRegreso;
      };
      if (!estaEnHorario(horarios)) {
        console.log('⏰ Fuera de horario escolar, no se envían notificaciones de proximidad');
        return;
      }

      for (const alumnoDoc of alumnosSnapshot.docs) {
        const alumno = alumnoDoc.data();
        const alumnoId = alumnoDoc.id;

        // Verificar que el alumno tenga ubicación
        if (!alumno.ubicacion_lat || !alumno.ubicacion_lng) {
          continue;
        }

        // Calcular distancia
        const distance = this.calculateDistance(
          ubicacion.latitude,
          ubicacion.longitude,
          alumno.ubicacion_lat,
          alumno.ubicacion_lng
        );

        console.log(`📏 Distancia bus → ${alumno.nombre}: ${Math.round(distance)}m`);

        // Obtener datos del bus
        const busDoc = await db.collection('buses').doc(busId).get();
        const bus = busDoc.data();

        // Verificar si ya enviamos notificación reciente para este alumno
        const alertKey = `${busId}_${alumnoId}`;
        const lastAlert = this.lastProximityAlerts?.get(alertKey);
        const now = Date.now();

        // Inicializar Map si no existe
        if (!this.lastProximityAlerts) {
          this.lastProximityAlerts = new Map();
        }

        // Alerta a 500 metros (solo si no se envió en los últimos 5 minutos)
        if (distance <= 500 && distance > 200) {
          if (!lastAlert || (now - lastAlert.time) > 5 * 60 * 1000) {
            console.log(`🔔 Enviando alerta de 500m para ${alumno.nombre}`);
            await notificationService.notifyBusProximity(
              alumnoId,
              bus.placa,
              Math.round(distance),
              alumno.padre_id,
              rutaActiva
            );
            this.lastProximityAlerts.set(alertKey, { distance: 500, time: now });
          }
        }

        // Alerta a 200 metros (solo si no se envió en los últimos 5 minutos)
        if (distance <= 200) {
          if (!lastAlert || lastAlert.distance !== 200 || (now - lastAlert.time) > 5 * 60 * 1000) {
            console.log(`🔔 Enviando alerta de 200m para ${alumno.nombre}`);
            await notificationService.notifyBusProximity(
              alumnoId,
              bus.placa,
              Math.round(distance),
              alumno.padre_id,
              rutaActiva
            );
            this.lastProximityAlerts.set(alertKey, { distance: 200, time: now });
          }
        }
      }

    } catch (error) {
      console.error('❌ Error verificando proximidad:', error.message);
    }
  }
}

// Exportar instancia única (singleton)
const traccarService = new TraccarService();
module.exports = traccarService;