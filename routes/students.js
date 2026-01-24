// routes/students.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const { isValidDNI, sanitizeString } = require('../utils/validators');

/**
 * GET /api/students
 * Obtener todos los alumnos
 */
router.get('/', /* verifyToken, */ async (req, res) => {
  try {
    const { colegio_id, bus_id, padre_id } = req.query;

    let query = db.collection('alumnos');

    if (colegio_id) {
      query = query.where('colegio_id', '==', colegio_id);
    }

    if (bus_id) {
      query = query.where('bus_id', '==', bus_id);
    }

    if (padre_id) {
      query = query.where('padre_id', '==', padre_id);
    }

    const snapshot = await query.get();

    const alumnos = [];
    snapshot.forEach(doc => {
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
    console.error('❌ Get students error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener alumnos',
      details: error.message
    });
  }
});

/**
 * GET /api/students/:id
 * Obtener un alumno por ID
 */
router.get('/:id', /* verifyToken, */ async (req, res) => {
  try {
    const { id } = req.params;

    const alumnoDoc = await db.collection('alumnos').doc(id).get();

    if (!alumnoDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Alumno no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        id: alumnoDoc.id,
        ...alumnoDoc.data()
      }
    });

  } catch (error) {
    console.error('❌ Get student error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener alumno',
      details: error.message
    });
  }
});

/**
 * POST /api/students
 * Crear nuevo alumno
 */
router.post('/', /* verifyToken, */ async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      dni,
      fecha_nacimiento,
      grado,
      seccion,
      padre_id,
      colegio_id,
      direccion_recogida,
      direccion_entrega,
      foto_url
    } = req.body;

    // Validaciones
    if (!nombre || !apellido || !dni || !colegio_id) {
      return res.status(400).json({
        error: true,
        message: 'Nombre, apellido, DNI y colegio_id son requeridos'
      });
    }

    if (!isValidDNI(dni)) {
      return res.status(400).json({
        error: true,
        message: 'DNI debe tener 8 dígitos'
      });
    }

    // Verificar que el DNI no exista
    const existingAlumno = await db.collection('alumnos')
      .where('dni', '==', dni)
      .limit(1)
      .get();

    if (!existingAlumno.empty) {
      return res.status(409).json({
        error: true,
        message: 'Ya existe un alumno con ese DNI'
      });
    }

    // Crear alumno
    const alumnoData = {
      nombre: sanitizeString(nombre),
      apellido: sanitizeString(apellido),
      dni: dni,
      fecha_nacimiento: fecha_nacimiento || null,
      grado: grado || null,
      seccion: seccion || null,
      padre_id: padre_id,
      colegio_id: colegio_id,
      bus_id: null, // Se asigna después
      direccion_recogida: direccion_recogida || null,
      direccion_entrega: direccion_entrega || null,
      foto_url: foto_url || null,
      estado: 'activo', // activo, inactivo
      asistencias: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const alumnoRef = await db.collection('alumnos').add(alumnoData);

  // Agregar alumno al array de hijos del padre (solo si se proporciona padre_id)
if (padre_id) {
  try {
    await db.collection('usuarios').doc(padre_id).update({
      hijos: admin.firestore.FieldValue.arrayUnion(alumnoRef.id),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn('⚠️ No se pudo actualizar el padre:', error.message);
    // No fallar si el padre no existe
  }
}

    res.status(201).json({
      success: true,
      message: 'Alumno creado exitosamente',
      data: {
        id: alumnoRef.id,
        ...alumnoData
      }
    });

  } catch (error) {
    console.error('❌ Create student error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al crear alumno',
      details: error.message
    });
  }
});

/**
 * PUT /api/students/:id
 * Actualizar alumno
 */
router.put('/:id', /* verifyToken, */ async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const alumnoDoc = await db.collection('alumnos').doc(id).get();

    if (!alumnoDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Alumno no encontrado'
      });
    }

    const allowedFields = [
      'nombre', 'apellido', 'fecha_nacimiento',
      'grado', 'seccion', 'bus_id',
      'direccion_recogida', 'direccion_entrega',
      'foto_url', 'estado'
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'nombre' || field === 'apellido') {
          updateData[field] = sanitizeString(updates[field]);
        } else {
          updateData[field] = updates[field];
        }
      }
    }

    updateData.updatedAt = new Date().toISOString();

    await db.collection('alumnos').doc(id).update(updateData);

    const updatedAlumno = await db.collection('alumnos').doc(id).get();

    res.json({
      success: true,
      message: 'Alumno actualizado exitosamente',
      data: {
        id: updatedAlumno.id,
        ...updatedAlumno.data()
      }
    });

  } catch (error) {
    console.error('❌ Update student error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al actualizar alumno',
      details: error.message
    });
  }
});

/**
 * DELETE /api/students/:id
 * Eliminar alumno (soft delete)
 */
router.delete('/:id', /* verifyToken, */ async (req, res) => {
  try {
    const { id } = req.params;

    const alumnoDoc = await db.collection('alumnos').doc(id).get();

    if (!alumnoDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Alumno no encontrado'
      });
    }

    await db.collection('alumnos').doc(id).update({
      estado: 'inactivo',
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Alumno eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Delete student error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al eliminar alumno',
      details: error.message
    });
  }
});

/**
 * POST /api/students/:id/assign-bus
 * Asignar alumno a un bus
 */
router.post('/:id/assign-bus', /* verifyToken, */ async (req, res) => {
  try {
    const { id } = req.params;
    const { bus_id } = req.body;

    if (!bus_id) {
      return res.status(400).json({
        error: true,
        message: 'bus_id es requerido'
      });
    }

    // Verificar que el bus existe
    const busDoc = await db.collection('buses').doc(bus_id).get();
    if (!busDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Bus no encontrado'
      });
    }

    // Asignar bus al alumno
    await db.collection('alumnos').doc(id).update({
      bus_id: bus_id,
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Alumno asignado al bus exitosamente'
    });

  } catch (error) {
    console.error('❌ Assign bus error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al asignar bus',
      details: error.message
    });
  }
});

module.exports = router;