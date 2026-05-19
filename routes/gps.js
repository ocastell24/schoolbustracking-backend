// routes/gps.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const { checkCamionAccess } = require('../middleware/checkPermissions');

/**
 * POST /api/gps/position
 */
router.post('/position', async (req, res) => {
  try {
    const { device_id, latitude, longitude, speed, altitude, accuracy, timestamp, battery } = req.body;

    if (!device_id || !latitude || !longitude) {
      return res.status(400).json({ error: true, message: 'device_id, latitude y longitude son requeridos' });
    }

    const busQuery = await db.collection('buses').where('gps_imei', '==', device_id).limit(1).get();

    if (busQuery.empty) {
      return res.status(404).json({ error: true, message: 'No se encontró bus con ese GPS tracker' });
    }

    const busDoc = busQuery.docs[0];
    const busId = busDoc.id;

    const posicionData = {
      bus_id: busId,
      device_id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: speed ? parseFloat(speed) : null,
      altitude: altitude ? parseFloat(altitude) : null,
      accuracy: accuracy ? parseFloat(accuracy) : null,
      battery: battery ? parseFloat(battery) : null,
      timestamp: timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await db.collection('gps_positions').add(posicionData);

    await db.collection('buses').doc(busId).update({
      ubicacion_actual: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: speed ? parseFloat(speed) : null,
        timestamp: timestamp || new Date().toISOString()
      },
      ultima_actualizacion: new Date().toISOString()
    });

    const alumnosQuery = await db.collection('alumnos').where('bus_id', '==', busId).get();

    if (!alumnosQuery.empty) {
      await checkProximityAlerts(busId, latitude, longitude, alumnosQuery.docs);
    }

    res.json({
      success: true,
      message: 'Posición GPS guardada exitosamente',
      data: { bus_id: busId, latitude: parseFloat(latitude), longitude: parseFloat(longitude), students_count: alumnosQuery.size }
    });

  } catch (error) {
    console.error('❌ GPS position error:', error);
    res.status(500).json({ error: true, message: 'Error al guardar posición GPS', details: error.message });
  }
});

/**
 * GET /api/gps/bus/:busId/current
 */
router.get('/bus/:busId/current', async (req, res) => {
  try {
    const { busId } = req.params;
    const busDoc = await db.collection('buses').doc(busId).get();

    if (!busDoc.exists) return res.status(404).json({ error: true, message: 'Bus no encontrado' });

    const busData = busDoc.data();
    if (!busData.ubicacion_actual) return res.status(404).json({ error: true, message: 'Bus no tiene ubicación GPS registrada' });

    res.json({
      success: true,
      data: { bus_id: busId, placa: busData.placa, ubicacion: busData.ubicacion_actual, ultima_actualizacion: busData.ultima_actualizacion }
    });

  } catch (error) {
    console.error('❌ Get GPS error:', error);
    res.status(500).json({ error: true, message: 'Error al obtener ubicación GPS', details: error.message });
  }
});

/**
 * GET /api/gps/bus/:busId/history
 */
router.get('/bus/:busId/history', async (req, res) => {
  try {
    const { busId } = req.params;
    const { limit = 100, since } = req.query;

    let query = db.collection('gps_positions').where('bus_id', '==', busId).orderBy('timestamp', 'desc').limit(parseInt(limit));
    if (since) query = query.where('timestamp', '>=', since);

    const snapshot = await query.get();
    const positions = [];
    snapshot.forEach(doc => positions.push({ id: doc.id, ...doc.data() }));

    res.json({ success: true, count: positions.length, data: positions });

  } catch (error) {
    console.error('❌ Get GPS history error:', error);
    res.status(500).json({ error: true, message: 'Error al obtener historial GPS', details: error.message });
  }
});

/**
 * POST /api/gps/simulate-movement/:busId
 */
router.post('/simulate-movement/:busId', async (req, res) => {
  try {
    const { busId } = req.params;
    const busDoc = await db.collection('buses').doc(busId).get();

    if (!busDoc.exists) return res.status(404).json({ error: true, message: 'Bus no encontrado' });

    const busData = busDoc.data();
    const currentLocation = busData.ubicacion_actual;

    let newLat = currentLocation?.latitude || -12.0464;
    let newLng = currentLocation?.longitude || -77.0428;

    newLat += (Math.random() - 0.5) * 0.005;
    newLng += (Math.random() - 0.5) * 0.005;

    const speed = Math.floor(Math.random() * 20) + 20;
    const newPosition = { latitude: newLat, longitude: newLng, speed, timestamp: new Date().toISOString() };

    await db.collection('buses').doc(busId).update({ ubicacion_actual: newPosition, ultima_actualizacion: new Date().toISOString() });
    await db.collection('gps_positions').add({ bus_id: busId, placa: busData.placa, ...newPosition, createdAt: new Date().toISOString() });

    res.json({ success: true, message: 'Posición actualizada', data: { bus_id: busId, placa: busData.placa, ubicacion: newPosition } });

  } catch (error) {
    console.error('Error simulando movimiento:', error);
    res.status(500).json({ error: true, message: 'Error al simular movimiento', details: error.message });
  }
});

/**
 * POST /api/gps/update-position/:busId
 */
router.post('/update-position/:busId', async (req, res) => {
  try {
    const { busId } = req.params;
    const { latitude, longitude, speed } = req.body;

    if (!latitude || !longitude) return res.status(400).json({ error: true, message: 'latitude y longitude son requeridos' });

    const busDoc = await db.collection('buses').doc(busId).get();
    if (!busDoc.exists) return res.status(404).json({ error: true, message: 'Bus no encontrado' });

    const bus = busDoc.data();
    const ubicacion = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: speed ? parseFloat(speed) : 0,
      timestamp: new Date().toISOString()
    };

    await db.collection('buses').doc(busId).update({ ubicacion_actual: ubicacion, ultima_actualizacion: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await db.collection('gps_positions').add({ bus_id: busId, placa: bus.placa, ...ubicacion, source: 'manual', createdAt: new Date().toISOString() });

    // Verificar proximidad
    const alumnosQuery = await db.collection('alumnos').where('bus_id', '==', busId).get();
    if (!alumnosQuery.empty) {
      await checkProximityAlerts(busId, latitude, longitude, alumnosQuery.docs);
    }

    res.json({ success: true, message: 'Ubicación actualizada', data: ubicacion });

  } catch (error) {
    console.error('❌ Update position error:', error);
    res.status(500).json({ error: true, message: 'Error al actualizar posición', details: error.message });
  }
});

/**
 * POST /api/gps/traccar-webhook
 */
router.post('/traccar-webhook', async (req, res) => {
  try {
    console.log('📡 Query params:', JSON.stringify(req.query));

    const { id, lat, lon, speed, altitude, course, time } = req.query;

    if (!id || !lat || !lon) {
      return res.status(400).json({ error: true, message: 'Datos incompletos en webhook' });
    }

    const deviceId = id;

    const busesSnapshot = await db.collection('buses').where('gps_imei', '==', deviceId).limit(1).get();

    if (busesSnapshot.empty) {
      return res.status(404).json({ error: true, message: `Bus no encontrado para dispositivo ${deviceId}` });
    }

    const busDoc = busesSnapshot.docs[0];
    const busId = busDoc.id;
    const bus = busDoc.data();

    const ubicacion = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      speed: speed ? parseFloat(speed) : 0,
      altitude: altitude ? parseFloat(altitude) : 0,
      course: course ? parseFloat(course) : 0,
      timestamp: time || new Date().toISOString(),
      source: 'traccar',
      deviceId
    };

    await db.collection('buses').doc(busId).update({ ubicacion_actual: ubicacion, ultima_actualizacion: new Date().toISOString(), updatedAt: new Date().toISOString() });

    await db.collection('gps_positions').add({
      bus_id: busId, placa: bus.placa,
      latitude: ubicacion.latitude, longitude: ubicacion.longitude,
      speed: ubicacion.speed, altitude: ubicacion.altitude, course: ubicacion.course,
      source: 'traccar', device_id: deviceId, timestamp: ubicacion.timestamp,
      createdAt: new Date().toISOString()
    });

    // Verificar proximidad
    const alumnosQuery = await db.collection('alumnos').where('bus_id', '==', busId).get();
    if (!alumnosQuery.empty) {
      await checkProximityAlerts(busId, ubicacion.latitude, ubicacion.longitude, alumnosQuery.docs);
    }

    res.json({ success: true, message: 'Ubicación actualizada correctamente', bus: { id: busId, placa: bus.placa, ubicacion } });

  } catch (error) {
    console.error('❌ Traccar webhook error:', error);
    res.status(500).json({ error: true, message: 'Error procesando webhook de Traccar', details: error.message });
  }
});

/**
 * GET /api/gps/traccar-test
 */
router.get('/traccar-test', (req, res) => {
  res.json({ success: true, message: 'Endpoint de Traccar funcionando', timestamp: new Date().toISOString() });
});

/**
 * GET /api/gps/history
 */
router.get('/history', async (req, res, next) => {
  next();
}, verifyToken, async (req, res, next) => {
  next();
}, checkCamionAccess, async (req, res) => {
  try {
    const { bus_id, camion_id, fecha } = req.query;
    const busId = bus_id || camion_id;

    if (!busId) return res.status(400).json({ error: true, message: 'bus_id o camion_id es requerido' });

    const snapshot = await db.collection('gps_positions').where('bus_id', '==', busId).orderBy('timestamp', 'desc').limit(10000).get();

    let positions = [];
    snapshot.forEach(doc => positions.push({ id: doc.id, ...doc.data() }));

    if (fecha) {
      const startDate = new Date(fecha + 'T05:00:00.000Z');
      const endDate = new Date(fecha + 'T04:59:59.999Z');
      endDate.setDate(endDate.getDate() + 1);
      positions = positions.filter(pos => {
        const posDate = new Date(pos.timestamp);
        return posDate >= startDate && posDate < endDate;
      });
    }

    positions.reverse();
    res.json({ success: true, count: positions.length, data: positions });

  } catch (error) {
    console.error('❌ Get GPS history error:', error);
    res.status(500).json({ error: true, message: 'Error al obtener historial GPS', details: error.message });
  }
});

// ─── FUNCIONES AUXILIARES ────────────────────────────────────────────────────

/**
 * Verificar alertas de proximidad con horario y preferencia del padre
 */
async function checkProximityAlerts(busId, busLat, busLng, alumnosDocs) {
  const notificationService = require('../services/notificationService');

  try {
    // Obtener datos del bus
    const busDoc = await db.collection('buses').doc(busId).get();
    if (!busDoc.exists) return;

    const bus = busDoc.data();
    const busPlaca = bus.placa || busId;
    const colegioId = bus.colegio_id;

    // Verificar horario del colegio
    if (colegioId) {
      const colegioDoc = await db.collection('colegios').doc(colegioId).get();
      if (colegioDoc.exists) {
        const horarios = colegioDoc.data().horarios_mapa;
        if (horarios && !estaEnHorarioActivo(horarios)) {
          console.log(`⏰ Fuera de horario escolar, no se envían notificaciones de proximidad`);
          return;
        }
      }
    }

    // Procesar cada alumno
    for (const alumnoDoc of alumnosDocs) {
      const alumno = alumnoDoc.data();

      if (!alumno.ubicacion_lat || !alumno.ubicacion_lng) continue;

      const distance = calculateDistance(
        parseFloat(busLat), parseFloat(busLng),
        parseFloat(alumno.ubicacion_lat), parseFloat(alumno.ubicacion_lng)
      );

      const distanceMeters = Math.round(distance * 1000);
      if (distanceMeters > 500) continue;

      // Obtener padres del alumno
      const padres = await notificationService.getPadresDeAlumno(alumnoDoc.id);

      for (const padre of padres) {
        // Verificar preferencia del padre
        if (padre.notificaciones_proximidad === false) {
          console.log(`🔕 Padre ${padre.nombre} tiene notificaciones de proximidad desactivadas`);
          continue;
        }

        // Verificar cooldown (no repetir en 10 minutos)
        const cooldownKey = `proximity_${busId}_${alumnoDoc.id}_${padre.id}`;
        const cooldownDoc = await db.collection('notificacion_cooldowns').doc(cooldownKey).get();

        if (cooldownDoc.exists) {
          const lastSent = new Date(cooldownDoc.data().lastSent);
          const minutesPassed = (new Date() - lastSent) / 1000 / 60;
          if (minutesPassed < 10) {
            console.log(`⏱️ Cooldown activo para ${alumno.nombre}, faltan ${Math.round(10 - minutesPassed)} min`);
            continue;
          }
        }

        // Enviar notificación
        console.log(`🔔 Bus a ${distanceMeters}m de ${alumno.nombre} ${alumno.apellido}`);
        await notificationService.notifyBusProximity(alumnoDoc.id, busPlaca, distanceMeters);

        // Guardar cooldown
        await db.collection('notificacion_cooldowns').doc(cooldownKey).set({
          lastSent: new Date().toISOString(),
          busId, alumnoId: alumnoDoc.id, padreId: padre.id
        });
      }
    }

  } catch (error) {
    console.error('❌ Error en checkProximityAlerts:', error.message);
  }
}

/**
 * Verificar si estamos en horario activo del colegio (hora Perú UTC-5)
 */
function estaEnHorarioActivo(horarios) {
  const ahora = new Date();
  const horaPeruMs = ahora.getTime() - (5 * 60 * 60 * 1000);
  const horaPeru = new Date(horaPeruMs);

  const dia = horaPeru.getDay();
  const horaActual = horaPeru.getHours() * 60 + horaPeru.getMinutes();

  if (!horarios.diasActivos?.includes(dia)) return false;

  const timeToMin = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const enIda = horarios.ida?.activo &&
    horaActual >= timeToMin(horarios.ida.inicio) &&
    horaActual <= timeToMin(horarios.ida.fin);

  const enRegreso = horarios.regreso?.activo &&
    horaActual >= timeToMin(horarios.regreso.inicio) &&
    horaActual <= timeToMin(horarios.regreso.fin);

  return enIda || enRegreso;
}

/**
 * Calcular distancia entre dos puntos (Haversine) en km
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = router;