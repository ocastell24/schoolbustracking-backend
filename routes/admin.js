// routes/admin.js
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

/**
 * POST /api/admin/login
 * Login de administrador
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Por ahora, credenciales hardcodeadas
    // TODO: Implementar hash de passwords y BD
    const ADMIN_EMAIL = 'admin@schoolbus.com';
    const ADMIN_PASSWORD = 'admin123';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const adminData = {
        id: 'admin-1',
        email: email,
        nombre: 'Administrador',
        rol: 'admin'
      };

      res.json({
        success: true,
        message: 'Login exitoso',
        data: adminData
      });
    } else {
      res.status(401).json({
        error: true,
        message: 'Credenciales inválidas'
      });
    }

  } catch (error) {
    console.error('Error en login admin:', error);
    res.status(500).json({
      error: true,
      message: 'Error en login',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/stats
 * Estadísticas generales del sistema
 */
router.get('/stats', async (req, res) => {
  try {
    // Contar buses
    const busesSnapshot = await db.collection('buses').get();
    const totalBuses = busesSnapshot.size;
    const busesActivos = busesSnapshot.docs.filter(doc => doc.data().estado === 'activo').length;

    // Contar alumnos
    const studentsSnapshot = await db.collection('alumnos').get();
    const totalAlumnos = studentsSnapshot.size;

    // Contar usuarios (padres)
    const usersSnapshot = await db.collection('usuarios').get();
    const totalUsuarios = usersSnapshot.size;

    // Contar posiciones GPS (últimas 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const gpsSnapshot = await db.collection('gps_positions')
      .where('createdAt', '>=', yesterday.toISOString())
      .get();
    const posicionesHoy = gpsSnapshot.size;

    res.json({
      success: true,
      data: {
        buses: {
          total: totalBuses,
          activos: busesActivos,
          inactivos: totalBuses - busesActivos
        },
        alumnos: {
          total: totalAlumnos
        },
        usuarios: {
          total: totalUsuarios
        },
        gps: {
          posiciones24h: posicionesHoy
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({
      error: true,
      message: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

// ============================================
// NUEVAS FUNCIONES (agregar aquí)
// ============================================

/**
 * GET /api/admin/colegios/:colegioId
 * Obtener información de un colegio específico
 */
router.get('/colegios/:colegioId', async (req, res) => {
  try {
    const { colegioId } = req.params;

    const colegioDoc = await db.collection('colegios').doc(colegioId).get();

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
    console.error('Error obteniendo colegio:', error);
    res.status(500).json({
      error: true,
      message: 'Error obteniendo colegio',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/asistencias
 * Obtener asistencias filtradas por fecha y colegio
 */
router.get('/asistencias', async (req, res) => {
  try {
    const { fecha, colegio_id } = req.query;

    let query = db.collection('asistencias');

    // Filtrar por fecha si se proporciona
    if (fecha) {
      const startDate = new Date(fecha);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(fecha);
      endDate.setHours(23, 59, 59, 999);

      query = query
        .where('timestamp', '>=', startDate.getTime())
        .where('timestamp', '<=', endDate.getTime());
    }

    const snapshot = await query.get();

    let asistencias = [];
    snapshot.forEach(doc => {
      asistencias.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Si hay filtro de colegio, filtrar por bus_id del colegio
    if (colegio_id) {
      // Obtener buses del colegio
      const busesSnapshot = await db.collection('buses')
        .where('colegio_id', '==', colegio_id)
        .get();
      
      const busIds = busesSnapshot.docs.map(doc => doc.id);
      
      // Filtrar asistencias por buses del colegio
      asistencias = asistencias.filter(a => busIds.includes(a.bus_id));
    }

    res.json({
      success: true,
      count: asistencias.length,
      data: asistencias
    });

  } catch (error) {
    console.error('Error obteniendo asistencias:', error);
    res.status(500).json({
      error: true,
      message: 'Error obteniendo asistencias',
      details: error.message
    });
  }
});

module.exports = router;