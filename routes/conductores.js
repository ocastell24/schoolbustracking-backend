// routes/conductores.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { checkRole } = require('../middleware/checkRole');
const notificationService = require('../services/notificationService');

/**
 * GET /api/conductores/me/bus
 * Obtener información del bus del conductor
 */
router.get('/me/bus', checkRole(['conductor']), async (req, res) => {
  try {
    const conductorId = req.user.id;

    console.log('🚌 Buscando bus del conductor:', conductorId);

    const busesSnapshot = await db.collection('buses')
      .where('conductor_id', '==', conductorId)
      .where('estado', '==', 'activo')
      .limit(1)
      .get();

    if (busesSnapshot.empty) {
      console.log('⚠️ No se encontró bus para conductor:', conductorId);
      return res.status(404).json({
        error: true,
        message: 'No tienes un bus asignado'
      });
    }

    const busDoc = busesSnapshot.docs[0];
    const bus = busDoc.data();

    console.log('✅ Bus encontrado:', bus.placa);

    res.json({
      success: true,
      data: {
        id: busDoc.id,
        ...bus
      }
    });

  } catch (error) {
    console.error('❌ Get conductor bus error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener bus',
      details: error.message
    });
  }
});

/**
 * GET /api/conductores/me/alumnos
 * Obtener alumnos asignados al bus del conductor
 */
router.get('/me/alumnos', checkRole(['conductor']), async (req, res) => {
  try {
    const conductorId = req.user.id;

    console.log('👨‍👩‍👧‍👦 Buscando alumnos del conductor:', conductorId);

    const busesSnapshot = await db.collection('buses')
      .where('conductor_id', '==', conductorId)
      .where('estado', '==', 'activo')
      .limit(1)
      .get();

    if (busesSnapshot.empty) {
      return res.status(404).json({
        error: true,
        message: 'No tienes un bus asignado'
      });
    }

    const busId = busesSnapshot.docs[0].id;
    console.log('🚌 Bus ID:', busId);

    const alumnosSnapshot = await db.collection('alumnos')
      .where('bus_id', '==', busId)
      .where('estado', '==', 'activo')
      .get();

    const alumnos = [];
    alumnosSnapshot.forEach(doc => {
      alumnos.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log('✅ Alumnos encontrados:', alumnos.length);

    res.json({
      success: true,
      count: alumnos.length,
      data: alumnos
    });

  } catch (error) {
    console.error('❌ Get conductor alumnos error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener alumnos',
      details: error.message
    });
  }
});

/**
 * POST /api/conductores/asistencia
 * Marcar asistencia de un alumno
 * Campo nuevo: ruta ('ida' | 'regreso')
 */
router.post('/asistencia', checkRole(['conductor']), async (req, res) => {
  try {
    const { alumno_id, tipo, ruta } = req.body; // ruta: 'ida' | 'regreso'
    const conductorId = req.user.id;

    console.log('📝 Registrando asistencia:', { alumno_id, tipo, ruta, conductorId });

    if (!alumno_id || !tipo) {
      return res.status(400).json({
        error: true,
        message: 'alumno_id y tipo son requeridos'
      });
    }

    if (!['subida', 'bajada'].includes(tipo)) {
      return res.status(400).json({
        error: true,
        message: 'tipo debe ser "subida" o "bajada"'
      });
    }

    // ruta es opcional por compatibilidad con registros anteriores
    const rutaValida = ['ida', 'regreso'].includes(ruta) ? ruta : 'ida';

    const busesSnapshot = await db.collection('buses')
      .where('conductor_id', '==', conductorId)
      .limit(1)
      .get();

    if (busesSnapshot.empty) {
      return res.status(403).json({
        error: true,
        message: 'No tienes un bus asignado'
      });
    }

    const busDoc = busesSnapshot.docs[0];
    const busId = busDoc.id;
    const bus = busDoc.data();

    const alumnoDoc = await db.collection('alumnos').doc(alumno_id).get();

    if (!alumnoDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Alumno no encontrado'
      });
    }

    const alumno = alumnoDoc.data();

    if (alumno.bus_id !== busId) {
      return res.status(403).json({
        error: true,
        message: 'Este alumno no está asignado a tu bus'
      });
    }

    // Crear registro de asistencia con campo ruta
    const asistenciaData = {
      alumno_id,
      alumno_nombre: `${alumno.nombre} ${alumno.apellido || ''}`,
      bus_id: busId,
      conductor_id: conductorId,
      tipo,           // 'subida' | 'bajada'
      ruta: rutaValida, // 'ida' | 'regreso'
      fecha: new Date().toISOString(),
      timestamp: new Date().getTime()
    };

    const asistenciaRef = await db.collection('asistencias').add(asistenciaData);

    console.log('✅ Asistencia registrada:', asistenciaRef.id);

    // Enviar notificación al padre
    console.log('📨 Enviando notificación al padre...');

    if (tipo === 'subida') {
    await notificationService.notifyStudentPickup(alumno_id, bus.placa, rutaValida);
      console.log('✅ Notificación de subida enviada');
    } else if (tipo === 'bajada') {
  await notificationService.notifyStudentDropoff(alumno_id, bus.placa, rutaValida);
      console.log('✅ Notificación de bajada enviada');
    }

    res.json({
      success: true,
      message: `Asistencia de ${tipo} registrada (${rutaValida})`,
      data: {
        id: asistenciaRef.id,
        ...asistenciaData
      }
    });

  } catch (error) {
    console.error('❌ Asistencia error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al registrar asistencia',
      details: error.message
    });
  }
});

module.exports = router;