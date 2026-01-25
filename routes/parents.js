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

module.exports = router;