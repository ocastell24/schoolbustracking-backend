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

module.exports = router;