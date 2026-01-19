// routes/buses.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, checkRole } = require('../middleware/auth');
const { isValidPlaca, sanitizeString } = require('../utils/validators');

/**
 * GET /api/buses
 * Obtener todos los buses
 */
router.get('/', /* verifyToken, */ async (req, res) => {
  try {
    const { colegio_id } = req.query;

    let query = db.collection('buses');

    // Si viene colegio_id, filtrar por colegio
    if (colegio_id) {
      query = query.where('colegio_id', '==', colegio_id);
    }

    const snapshot = await query.get();

    const buses = [];
    snapshot.forEach(doc => {
      buses.push({
        id: doc.id,
        ...doc.data()
      });
    });

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
 * GET /api/buses/:id
 * Obtener un bus por ID
 */
router.get('/:id', /* verifyToken, */ async (req, res) => {
  try {
    const { id } = req.params;

    const busDoc = await db.collection('buses').doc(id).get();

    if (!busDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Bus no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        id: busDoc.id,
        ...busDoc.data()
      }
    });

  } catch (error) {
    console.error('❌ Get bus error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener bus',
      details: error.message
    });
  }
});

/**
 * POST /api/buses
 * Crear nuevo bus
 */
router.post('/', /* verifyToken, */ async (req, res) => {
  try {
    const { 
      placa, 
      modelo, 
      capacidad, 
      año,
      color,
      colegio_id,
      gps_imei 
    } = req.body;

    // Validaciones
    if (!placa || !modelo || !capacidad || !colegio_id) {
      return res.status(400).json({
        error: true,
        message: 'Placa, modelo, capacidad y colegio_id son requeridos'
      });
    }

    if (!isValidPlaca(placa)) {
      return res.status(400).json({
        error: true,
        message: 'Formato de placa inválido. Use: ABC-123 o ABC123'
      });
    }

    if (capacidad < 1 || capacidad > 100) {
      return res.status(400).json({
        error: true,
        message: 'Capacidad debe estar entre 1 y 100'
      });
    }

    // Verificar que la placa no exista
    const existingBus = await db.collection('buses')
      .where('placa', '==', placa.toUpperCase())
      .limit(1)
      .get();

    if (!existingBus.empty) {
      return res.status(409).json({
        error: true,
        message: 'Ya existe un bus con esa placa'
      });
    }

    // Crear bus
    const busData = {
      placa: placa.toUpperCase(),
      modelo: sanitizeString(modelo),
      capacidad: parseInt(capacidad),
      año: año ? parseInt(año) : null,
      color: color ? sanitizeString(color) : null,
      colegio_id: colegio_id,
      gps_imei: gps_imei || null,
      conductor_id: null,
      estado: 'activo', // activo, mantenimiento, inactivo
      ubicacion_actual: null,
      ultima_actualizacion: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const busRef = await db.collection('buses').add(busData);

    res.status(201).json({
      success: true,
      message: 'Bus creado exitosamente',
      data: {
        id: busRef.id,
        ...busData
      }
    });

  } catch (error) {
    console.error('❌ Create bus error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al crear bus',
      details: error.message
    });
  }
});

/**
 * PUT /api/buses/:id
 * Actualizar bus
 */
router.put('/:id', /* verifyToken, */ async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verificar que el bus existe
    const busDoc = await db.collection('buses').doc(id).get();

    if (!busDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Bus no encontrado'
      });
    }

    // Campos permitidos para actualizar
    const allowedFields = [
      'modelo', 'capacidad', 'año', 'color', 
      'gps_imei', 'conductor_id', 'estado'
    ];

    const updateData = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'modelo' || field === 'color') {
          updateData[field] = sanitizeString(updates[field]);
        } else if (field === 'capacidad' || field === 'año') {
          updateData[field] = parseInt(updates[field]);
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    updateData.updatedAt = new Date().toISOString();

    await db.collection('buses').doc(id).update(updateData);

    const updatedBus = await db.collection('buses').doc(id).get();

    res.json({
      success: true,
      message: 'Bus actualizado exitosamente',
      data: {
        id: updatedBus.id,
        ...updatedBus.data()
      }
    });

  } catch (error) {
    console.error('❌ Update bus error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al actualizar bus',
      details: error.message
    });
  }
});

/**
 * DELETE /api/buses/:id
 * Eliminar bus (soft delete)
 */
router.delete('/:id', /* verifyToken, */ async (req, res) => {
  try {
    const { id } = req.params;

    const busDoc = await db.collection('buses').doc(id).get();

    if (!busDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Bus no encontrado'
      });
    }

    // Soft delete - marcar como inactivo
    await db.collection('buses').doc(id).update({
      estado: 'inactivo',
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Bus eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Delete bus error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al eliminar bus',
      details: error.message
    });
  }
});

module.exports = router;