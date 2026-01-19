// routes/gps.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');

/**
 * POST /api/gps/position
 * Recibir y guardar posición GPS del tracker
 * (Este endpoint será llamado por Traccar via webhook)
 */
router.post('/position', async (req, res) => {
  try {
    const {
      device_id,      // ID del GPS tracker (IMEI)
      latitude,
      longitude,
      speed,          // km/h
      altitude,
      accuracy,
      timestamp,
      battery
    } = req.body;

    // Validaciones básicas
    if (!device_id || !latitude || !longitude) {
      return res.status(400).json({
        error: true,
        message: 'device_id, latitude y longitude son requeridos'
      });
    }

    // Buscar el bus con este GPS
    const busQuery = await db.collection('buses')
      .where('gps_imei', '==', device_id)
      .limit(1)
      .get();

    if (busQuery.empty) {
      console.log(`⚠️ No se encontró bus con GPS IMEI: ${device_id}`);
      return res.status(404).json({
        error: true,
        message: 'No se encontró bus con ese GPS tracker'
      });
    }

    const busDoc = busQuery.docs[0];
    const busId = busDoc.id;
    const busData = busDoc.data();

    // Guardar posición en Firestore
    const posicionData = {
      bus_id: busId,
      device_id: device_id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: speed ? parseFloat(speed) : null,
      altitude: altitude ? parseFloat(altitude) : null,
      accuracy: accuracy ? parseFloat(accuracy) : null,
      battery: battery ? parseFloat(battery) : null,
      timestamp: timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // Guardar en colección de posiciones históricas
    await db.collection('gps_positions').add(posicionData);

    // Actualizar ubicación actual del bus
    await db.collection('buses').doc(busId).update({
      ubicacion_actual: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: speed ? parseFloat(speed) : null,
        timestamp: timestamp || new Date().toISOString()
      },
      ultima_actualizacion: new Date().toISOString()
    });

    console.log(`✅ GPS actualizado para bus ${busId}`);

    // Verificar si hay alumnos en este bus y calcular distancias
    const alumnosQuery = await db.collection('alumnos')
      .where('bus_id', '==', busId)
      .get();

    if (!alumnosQuery.empty) {
      // Procesar notificaciones de proximidad
      await checkProximityAlerts(busId, latitude, longitude, alumnosQuery.docs);
    }

    res.json({
      success: true,
      message: 'Posición GPS guardada exitosamente',
      data: {
        bus_id: busId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        students_count: alumnosQuery.size
      }
    });

  } catch (error) {
    console.error('❌ GPS position error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al guardar posición GPS',
      details: error.message
    });
  }
});

/**
 * GET /api/gps/bus/:busId/current
 * Obtener ubicación actual de un bus
 */
router.get('/bus/:busId/current', async (req, res) => {
  try {
    const { busId } = req.params;

    const busDoc = await db.collection('buses').doc(busId).get();

    if (!busDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Bus no encontrado'
      });
    }

    const busData = busDoc.data();

    if (!busData.ubicacion_actual) {
      return res.status(404).json({
        error: true,
        message: 'Bus no tiene ubicación GPS registrada'
      });
    }

    res.json({
      success: true,
      data: {
        bus_id: busId,
        placa: busData.placa,
        ubicacion: busData.ubicacion_actual,
        ultima_actualizacion: busData.ultima_actualizacion
      }
    });

  } catch (error) {
    console.error('❌ Get GPS error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener ubicación GPS',
      details: error.message
    });
  }
});

/**
 * GET /api/gps/bus/:busId/history
 * Obtener historial de posiciones de un bus
 */
router.get('/bus/:busId/history', async (req, res) => {
  try {
    const { busId } = req.params;
    const { limit = 100, since } = req.query;

    let query = db.collection('gps_positions')
      .where('bus_id', '==', busId)
      .orderBy('timestamp', 'desc')
      .limit(parseInt(limit));

    if (since) {
      query = query.where('timestamp', '>=', since);
    }

    const snapshot = await query.get();

    const positions = [];
    snapshot.forEach(doc => {
      positions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      count: positions.length,
      data: positions
    });

  } catch (error) {
    console.error('❌ Get GPS history error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener historial GPS',
      details: error.message
    });
  }
});

/**
 * Función auxiliar: Verificar alertas de proximidad
 */
async function checkProximityAlerts(busId, busLat, busLng, alumnosDocs) {
  for (const alumnoDoc of alumnosDocs) {
    const alumno = alumnoDoc.data();
    
    // Si el alumno tiene dirección de recogida con coordenadas
    if (alumno.direccion_recogida?.latitude && alumno.direccion_recogida?.longitude) {
      const distance = calculateDistance(
        busLat,
        busLng,
        alumno.direccion_recogida.latitude,
        alumno.direccion_recogida.longitude
      );

      // Alerta a 500m
      if (distance <= 0.5 && distance > 0.2) {
        console.log(`📍 Bus a 500m de ${alumno.nombre} ${alumno.apellido}`);
        // Aquí enviaremos notificación (siguiente paso)
      }

      // Alerta a 200m
      if (distance <= 0.2) {
        console.log(`📍 Bus a 200m de ${alumno.nombre} ${alumno.apellido}`);
        // Aquí enviaremos notificación (siguiente paso)
      }
    }
  }
}

/**
 * Función auxiliar: Calcular distancia entre dos puntos (Haversine)
 * Retorna distancia en kilómetros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance; // en kilómetros
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = router;