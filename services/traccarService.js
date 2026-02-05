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

      // Verificar si ya procesamos esta posición
      const lastPositionId = this.lastPositions.get(deviceId);
      if (lastPositionId === positionId) {
        return; // Ya procesada, skip
      }

      // Obtener información del dispositivo desde Traccar
      const deviceResponse = await axios.get(`${this.traccarUrl}/api/devices/${deviceId}`, {
        auth: {
          username: this.traccarUser,
          password: this.traccarPassword
        }
      });

      const device = deviceResponse.data;
      const uniqueId = device.uniqueId; // IMEI del GPS

      console.log(`🔍 Procesando posición de dispositivo: ${uniqueId}`);

      // Buscar bus con este IMEI en Firestore
      const busesSnapshot = await db.collection('buses')
        .where('gps_imei', '==', uniqueId)
        .limit(1)
        .get();

      if (busesSnapshot.empty) {
        console.log(`⚠️ Bus no encontrado para IMEI: ${uniqueId}`);
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

    } catch (error) {
      console.error('❌ Error procesando posición:', error.message);
    }
  }
}

// Exportar instancia única (singleton)
const traccarService = new TraccarService();
module.exports = traccarService;
