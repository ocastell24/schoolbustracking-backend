// routes/parents.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { checkRole } = require('../middleware/checkRole');

/**
 * GET /api/parents/me/children
 * Obtener hijos del padre autenticado
 */
router.get('/me/children', checkRole(['padre']), async (req, res) => {
  try {
    const padreId = req.user.id;

    // Obtener alumnos del padre
    const alumnosSnapshot = await db.collection('alumnos')
      .where('padre_id', '==', padreId)
      .where('estado', '==', 'activo')
      .get();

    const alumnos = [];
    alumnosSnapshot.forEach(doc => {
      alumnos.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      count: alumnos.length,
      data: alumnos
    });

  } catch (error) {
    console.error('❌ Get children error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener hijos',
      details: error.message
    });
  }
});

/**
 * GET /api/parents/me/buses
 * Obtener buses de los hijos del padre
 */
router.get('/me/buses', checkRole(['padre']), async (req, res) => {
  try {
    const padreId = req.user.id;

    // Obtener alumnos del padre
    const alumnosSnapshot = await db.collection('alumnos')
      .where('padre_id', '==', padreId)
      .where('estado', '==', 'activo')
      .get();

    // Obtener IDs únicos de buses
    const busIds = new Set();
    alumnosSnapshot.forEach(doc => {
      const alumno = doc.data();
      if (alumno.bus_id) {
        busIds.add(alumno.bus_id);
      }
    });

    // Obtener información de los buses
    const buses = [];
    for (const busId of busIds) {
      const busDoc = await db.collection('buses').doc(busId).get();
      if (busDoc.exists) {
        buses.push({
          id: busDoc.id,
          ...busDoc.data()
        });
      }
    }

    res.json({
      success: true,
      count: buses.length,
      data: buses
    });

  } catch (error) {
    console.error('❌ Get buses error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener buses',
      details: error.message
    });
  }
});

/**
 * GET /api/parents/me/asistencias
 * Obtener historial de asistencias de los hijos del padre
 */
router.get('/me/asistencias', checkRole(['padre']), async (req, res) => {
  try {
    const padreId = req.user.id;
    const { dias = 7 } = req.query; // Por defecto últimos 7 días

    console.log('📋 Obteniendo asistencias del padre:', padreId);

    // Obtener IDs de los hijos del padre
    const alumnosSnapshot = await db.collection('alumnos')
      .where('padre_id', '==', padreId)
      .where('estado', '==', 'activo')
      .get();

    if (alumnosSnapshot.empty) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const hijosIds = [];
    const hijosMap = {};
    
    alumnosSnapshot.forEach(doc => {
      const alumno = doc.data();
      hijosIds.push(doc.id);
      hijosMap[doc.id] = {
        nombre: `${alumno.nombre} ${alumno.apellido || ''}`,
        grado: alumno.grado,
        seccion: alumno.seccion
      };
    });

    console.log('👨‍👩‍👧‍👦 Hijos encontrados:', hijosIds.length);

    // Calcular fecha límite
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - parseInt(dias));

    // Obtener asistencias de los hijos
    const asistencias = [];
    
    for (const alumnoId of hijosIds) {
      const asistenciasSnapshot = await db.collection('asistencias')
        .where('alumno_id', '==', alumnoId)
        .orderBy('timestamp', 'desc')
        .get();

      asistenciasSnapshot.forEach(doc => {
        const asistencia = doc.data();
        const fechaAsistencia = new Date(asistencia.fecha);
        
        // Filtrar por fecha
        if (fechaAsistencia >= fechaLimite) {
          asistencias.push({
            id: doc.id,
            ...asistencia,
            alumno_info: hijosMap[alumnoId]
          });
        }
      });
    }

    // Ordenar por fecha descendente
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
    res.status(500).json({
      error: true,
      message: 'Error al obtener asistencias',
      details: error.message
    });
  }
});

module.exports = router;