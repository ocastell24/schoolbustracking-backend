// routes/auth.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { isValidPhone, sanitizeString } = require('../utils/validators');

/**
 * POST /api/auth/register
 * Registrar nuevo usuario (Padre/Tutor)
 */
router.post('/register', async (req, res) => {
  try {
    const { telefono, nombre, apellido } = req.body;

    // Validaciones
    if (!telefono || !nombre || !apellido) {
      return res.status(400).json({
        error: true,
        message: 'Todos los campos son requeridos'
      });
    }

    if (!isValidPhone(telefono)) {
      return res.status(400).json({
        error: true,
        message: 'Formato de teléfono inválido. Use: +51XXXXXXXXX'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await db.collection('usuarios')
      .where('telefono', '==', telefono)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return res.status(409).json({
        error: true,
        message: 'El número de teléfono ya está registrado'
      });
    }

    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      phoneNumber: telefono,
      displayName: `${nombre} ${apellido}`
    });

    // Guardar en Firestore
    await db.collection('usuarios').doc(userRecord.uid).set({
      uid: userRecord.uid,
      telefono: telefono,
      nombre: sanitizeString(nombre),
      apellido: sanitizeString(apellido),
      rol: 'padre', // padre, conductor, admin_colegio, super_admin
      estado: 'pendiente', // pendiente, aprobado, rechazado
      colegio_id: null,
      hijos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Pendiente de aprobación.',
      data: {
        uid: userRecord.uid,
        telefono: telefono,
        nombre: nombre,
        apellido: apellido,
        estado: 'pendiente'
      }
    });

  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al registrar usuario',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/verify-phone
 * Verificar teléfono y obtener token
 * (Esto lo maneja Firebase Auth en el frontend, aquí solo validamos)
 */
router.post('/verify-phone', async (req, res) => {
  try {
    const { telefono, uid } = req.body;

    if (!telefono || !uid) {
      return res.status(400).json({
        error: true,
        message: 'Teléfono y UID son requeridos'
      });
    }

    // Obtener usuario de Firestore
    const userDoc = await db.collection('usuarios').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }

    const userData = userDoc.data();

    // Verificar estado del usuario
    if (userData.estado === 'rechazado') {
      return res.status(403).json({
        error: true,
        message: 'Su solicitud de registro ha sido rechazada. Contacte al colegio.'
      });
    }

    if (userData.estado === 'pendiente') {
      return res.status(403).json({
        error: true,
        message: 'Su solicitud está pendiente de aprobación por el colegio.'
      });
    }

    // Usuario aprobado
    res.json({
      success: true,
      message: 'Verificación exitosa',
      data: {
        uid: userData.uid,
        telefono: userData.telefono,
        nombre: userData.nombre,
        apellido: userData.apellido,
        rol: userData.rol,
        estado: userData.estado,
        colegio_id: userData.colegio_id
      }
    });

  } catch (error) {
    console.error('❌ Verify phone error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al verificar teléfono',
      details: error.message
    });
  }
});

/**
 * GET /api/auth/me
 * Obtener info del usuario actual (requiere token)
 */
router.get('/me', async (req, res) => {
  try {
    // Por ahora sin middleware, después lo agregamos
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: true,
        message: 'No authorization token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    const userDoc = await db.collection('usuarios').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: userDoc.data()
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(401).json({
      error: true,
      message: 'Token inválido o expirado'
    });
  }
});

/**
 * POST /api/auth/login
 * Login de usuario (por teléfono)
 */
router.post('/login', async (req, res) => {
  try {
    const { telefono } = req.body;

    if (!telefono) {
      return res.status(400).json({
        error: true,
        message: 'Teléfono es requerido'
      });
    }

    console.log('🔐 Intento de login:', telefono);

    // Buscar usuario por teléfono
    const usuariosSnapshot = await db.collection('usuarios')
      .where('telefono', '==', telefono)
      .limit(1)
      .get();

    if (usuariosSnapshot.empty) {
      console.log('❌ Usuario no encontrado:', telefono);
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }

    const usuarioDoc = usuariosSnapshot.docs[0];
    const usuario = usuarioDoc.data();

    console.log('✅ Usuario encontrado:', usuario.nombre, '- Rol:', usuario.rol);

    // Verificar estado
    if (usuario.estado !== 'activo') {
      console.log('⚠️ Usuario no activo:', usuario.estado);
      return res.status(403).json({
        error: true,
        message: 'Usuario inactivo o pendiente de aprobación'
      });
    }

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        uid: usuarioDoc.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido || '',
        telefono: usuario.telefono,
        email: usuario.email || null,
        rol: usuario.rol || 'padre',
        colegio_id: usuario.colegio_id || null,
        estado: usuario.estado
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      error: true,
      message: 'Error en login',
      details: error.message
    });
  }
});

// Agregar este endpoint en routes/auth.js

/**
 * POST /api/auth/update-fcm-token
 * Actualizar token FCM del usuario
 */
router.post('/update-fcm-token', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { fcm_token } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: true,
        message: 'Usuario no autenticado'
      });
    }

    if (!fcm_token) {
      return res.status(400).json({
        error: true,
        message: 'fcm_token es requerido'
      });
    }

    console.log(`📱 Actualizando FCM token para usuario: ${userId}`);

    // Actualizar token en Firestore
    await db.collection('usuarios').doc(userId).update({
      fcm_token: fcm_token,
      fcm_token_updated_at: new Date().toISOString()
    });

    console.log('✅ Token FCM actualizado exitosamente');

    res.json({
      success: true,
      message: 'Token FCM actualizado'
    });

  } catch (error) {
    console.error('❌ Error actualizando token FCM:', error);
    res.status(500).json({
      error: true,
      message: 'Error al actualizar token FCM',
      details: error.message
    });
  }
});

module.exports = router;