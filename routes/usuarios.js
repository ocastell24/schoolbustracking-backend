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

/**
 * PUT /api/usuarios/:id
 * Actualizar usuario
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const usuarioDoc = await db.collection('usuarios').doc(id).get();

    if (!usuarioDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }

    const allowedFields = ['nombre', 'apellido', 'telefono', 'rol', 'colegio_id', 'estado'];
    const updateData = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    updateData.updatedAt = new Date().toISOString();

    await db.collection('usuarios').doc(id).update(updateData);

    const updatedUsuario = await db.collection('usuarios').doc(id).get();

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: {
        id: updatedUsuario.id,
        ...updatedUsuario.data()
      }
    });

  } catch (error) {
    console.error('❌ Update usuario error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al actualizar usuario',
      details: error.message
    });
  }
});

/**
 * DELETE /api/usuarios/:id
 * Eliminar usuario (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const usuarioDoc = await db.collection('usuarios').doc(id).get();

    if (!usuarioDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }

    await db.collection('usuarios').doc(id).update({
      estado: 'inactivo',
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Delete usuario error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al eliminar usuario',
      details: error.message
    });
  }
});

module.exports = router;
