// routes/parents.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { checkRole } = require('../middleware/checkRole');

/**
 * Obtener IDs de hijos del padre desde su documento
 */
const getHijosIds = async (padreId) => {
  const padreDoc = await db.collection('usuarios').doc(padreId).get();
  if (!padreDoc.exists) return [];
  const padre = padreDoc.data();
  return padre.hijos || [];
};

/**
 * GET /api/parents/me/children
 * Obtener hijos del padre autenticado
 */
router.get('/me/children', checkRole(['padre']), async (req, res) => {
  try {
    const padreId = req.user.id;

    const hijosIds = await getHijosIds(padreId);

    if (hijosIds.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const alumnos = [];
    for (const alumnoId of hijosIds) {
      const alumnoDoc = await db.collection('alumnos').doc(alumnoId).get();
      if (alumnoDoc.exists) {
        const alumno = alumnoDoc.data();
        if (alumno.estado === 'activo') {
          alumnos.push({ id: alumnoDoc.id, ...alumno });
        }
      }
    }

    res.json({ success: true, count: alumnos.length, data: alumnos });

  } catch (error) {
    console.error('❌ Get children error:', error);
    res.status(500).json({ error: true, message: 'Error al obtener hijos', details: error.message });
  }
});

/**
 * GET /api/parents/me/buses
 * Obtener buses de los hijos del padre
 */
router.get('/me/buses', checkRole(['padre']), async (req, res) => {
  try {
    const padreId = req.user.id;

    const hijosIds = await getHijosIds(padreId);

    if (hijosIds.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const busIds = new Set();
    for (const alumnoId of hijosIds) {
      const alumnoDoc = await db.collection('alumnos').doc(alumnoId).get();
      if (alumnoDoc.exists) {
        const alumno = alumnoDoc.data();
        if (alumno.bus_id && alumno.estado === 'activo') {
          busIds.add(alumno.bus_id);
        }
      }
    }

    const buses = [];
    for (const busId of busIds) {
      const busDoc = await db.collection('buses').doc(busId).get();
      if (busDoc.exists) {
        buses.push({ id: busDoc.id, ...busDoc.data() });
      }
    }

    res.json({ success: true, count: buses.length, data: buses });

  } catch (error) {
    console.error('❌ Get buses error:', error);
    res.status(500).json({ error: true, message: 'Error al obtener buses', details: error.message });
  }
});

/**
 * GET /api/parents/me/asistencias
 * Obtener historial de asistencias de los hijos del padre
 */
router.get('/me/asistencias', checkRole(['padre']), async (req, res) => {
  try {
    const padreId = req.user.id;
    const { dias = 7 } = req.query;

    console.log('📋 Obteniendo asistencias del padre:', padreId);

    const hijosIds = await getHijosIds(padreId);

    if (hijosIds.length === 0) {
      return res.json({ success: true, count: 0, data: [], periodo: `Últimos ${dias} días` });
    }

    const hijosMap = {};
    for (const alumnoId of hijosIds) {
      const alumnoDoc = await db.collection('alumnos').doc(alumnoId).get();
      if (alumnoDoc.exists) {
        const alumno = alumnoDoc.data();
        hijosMap[alumnoId] = {
          nombre: alumno.nombre,
          grado: alumno.grado,
          seccion: alumno.seccion
        };
      }
    }

    console.log('👨‍👩‍👧‍👦 Hijos encontrados:', hijosIds.length);

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - parseInt(dias));

    const asistencias = [];

    for (const alumnoId of hijosIds) {
      const asistenciasSnapshot = await db.collection('asistencias')
        .where('alumno_id', '==', alumnoId)
        .orderBy('timestamp', 'desc')
        .get();

      asistenciasSnapshot.forEach(doc => {
        const asistencia = doc.data();
        const fechaAsistencia = new Date(asistencia.fecha);
        if (fechaAsistencia >= fechaLimite) {
          asistencias.push({
            id: doc.id,
            ...asistencia,
            alumno_info: hijosMap[alumnoId]
          });
        }
      });
    }

    asistencias.sort((a, b) => b.timestamp - a.timestamp);

    console.log('✅ Asistencias encontradas:', asistencias.length);

    res.json({
      success: true,
      count: asistencias.length,
      data: asistencias,
      periodo: `Últimos ${dias} días`
    });

  } catch (error) {
    console.error('❌ Get asistencias error:', error);
    res.status(500).json({ error: true, message: 'Error al obtener asistencias', details: error.message });
  }
});

module.exports = router;
