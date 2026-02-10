// routes/usuarios.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

/**
 * GET /api/usuarios
 * Obtener todos los usuarios (con filtros opcionales)
 */
router.get('/', async (req, res) => {
  try {
    const { rol, colegio_id } = req.query;

    let query = db.collection('usuarios');

    // Filtrar por rol si se proporciona
    if (rol) {
      query = query.where('rol', '==', rol);
    }

    // Filtrar por colegio si se proporciona
    if (colegio_id) {
      query = query.where('colegio_id', '==', colegio_id);
    }

    const snapshot = await query.get();

    const usuarios = [];
    snapshot.forEach(doc => {
      usuarios.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      count: usuarios.length,
      data: usuarios
    });

  } catch (error) {
    console.error('❌ Get usuarios error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener usuarios',
      details: error.message
    });
  }
});

module.exports = router;
