// routes/colegios.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

/**
 * GET /api/colegios
 * Obtener todos los colegios
 */
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('colegios').get();

    const colegios = [];
    snapshot.forEach(doc => {
      colegios.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      count: colegios.length,
      data: colegios
    });

  } catch (error) {
    console.error('❌ Get colegios error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener colegios',
      details: error.message
    });
  }
});

/**
 * GET /api/colegios/:id
 * Obtener un colegio por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const colegioDoc = await db.collection('colegios').doc(id).get();

    if (!colegioDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Colegio no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        id: colegioDoc.id,
        ...colegioDoc.data()
      }
    });

  } catch (error) {
    console.error('❌ Get colegio error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener colegio',
      details: error.message
    });
  }
});

/**
 * POST /api/colegios
 * Crear nuevo colegio
 */
router.post('/', async (req, res) => {
  try {
    const { nombre, direccion, telefono } = req.body;

    if (!nombre) {
      return res.status(400).json({
        error: true,
        message: 'Nombre es requerido'
      });
    }

    const colegioData = {
      nombre: nombre,
      direccion: direccion || null,
      telefono: telefono || null,
      estado: 'activo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const colegioRef = await db.collection('colegios').add(colegioData);

    res.status(201).json({
      success: true,
      message: 'Colegio creado exitosamente',
      data: {
        id: colegioRef.id,
        ...colegioData
      }
    });

  } catch (error) {
    console.error('❌ Create colegio error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al crear colegio',
      details: error.message
    });
  }
});

module.exports = router;
