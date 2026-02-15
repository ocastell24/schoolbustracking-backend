// routes/auth.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { isValidPhone, sanitizeString } = require('../utils/validators');
const bcrypt = require('bcrypt');

/**
 * POST /api/auth/register
 * Registrar nuevo usuario (Padre/Tutor)
 */
router.post('/register', async (req, res) => {
  try {
    const { telefono, nombre, apellido, password, rol, colegio_id } = req.body;

    // Validaciones
    if (!telefono || !nombre || !apellido) {
      return res.status(400).json({
        error: true,
        message: 'Teléfono, nombre y apellido son requeridos'
      });
    }

    // Validar contraseña solo si es un registro de padre
    if (!rol || rol === 'padre') {
      if (!password || password.length < 6) {
        return res.status(400).json({
          error: true,
          message: 'La contraseña debe tener al menos 6 caracteres'
        });
      }
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

    // Hashear contraseña si existe
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      phoneNumber: telefono,
      displayName: `${nombre} ${apellido}`
    });

    // Guardar en Firestore
    const userData = {
      uid: userRecord.uid,
      telefono: telefono,
      nombre: sanitizeString(nombre),
      apellido: sanitizeString(apellido),
      password: hashedPassword,
      rol: rol || 'padre',
      estado: rol && rol !== 'padre' ? 'activo' : 'pendiente',
      colegio_id: colegio_id || null,
      hijos: [],
      biometric_enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('usuarios').doc(userRecord.uid).set(userData);

    res.status(201).json({
      success: true,
      message: rol === 'padre' ? 'Usuario registrado exitosamente. Pendiente de aprobación.' : 'Usuario creado exitosamente',
      data: {
        uid: userRecord.uid,
        telefono: telefono,
        nombre: nombre,
        apellido: apellido,
        estado: userData.estado
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
 * POST /api/auth/login
 * Login de usuario (por teléfono + contraseña)
 */
router.post('/login', async (req, res) => {
  try {
    const { telefono, password } = req.body;

    if (!telefono) {
      return res.status(400).json({
        error: true,
        message: 'Teléfono es requerido'
      });
    }

    if (!password) {
      return res.status(400).json({
        error: true,
        message: 'Contraseña es requerida'
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
        message: 'Usuario o contraseña incorrectos'
      });
    }

    const usuarioDoc = usuariosSnapshot.docs[0];
    const usuario = usuarioDoc.data();

    console.log('✅ Usuario encontrado:', usuario.nombre, '- Rol:', usuario.rol);

    // Verificar contraseña
    if (!usuario.password) {
      return res.status(400).json({
        error: true,
        message: 'Este usuario no tiene contraseña configurada. Contacte al administrador.'
      });
    }

    const passwordMatch = await bcrypt.compare(password, usuario.password);
    
    if (!passwordMatch) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({
        error: true,
        message: 'Usuario o contraseña incorrectos'
      });
    }

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
        estado: usuario.estado,
        biometric_enabled: usuario.biometric_enabled || false
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

/**
 * POST /api/auth/enable-biometric
 * Habilitar autenticación biométrica
 */
router.post('/enable-biometric', async (req, res) => {
  try {
    const { telefono, credential } = req.body;

    if (!telefono || !credential) {
      return res.status(400).json({
        error: true,
        message: 'Teléfono y credencial son requeridos'
      });
    }

    // Buscar usuario
    const usuariosSnapshot = await db.collection('usuarios')
      .where('telefono', '==', telefono)
      .limit(1)
      .get();

    if (usuariosSnapshot.empty) {
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }

    const usuarioDoc = usuariosSnapshot.docs[0];

    // Guardar credencial biométrica
    await db.collection('usuarios').doc(usuarioDoc.id).update({
      biometric_enabled: true,
      biometric_credential: credential,
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Autenticación biométrica habilitada'
    });

  } catch (error) {
    console.error('❌ Enable biometric error:', error);
    res.status(500).json({
      error: true,
      message: 'Error al habilitar biométrica',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/verify-biometric
 * Verificar autenticación biométrica
 */
router.post('/verify-biometric', async (req, res) => {
  try {
    const { telefono, credential } = req.body;

    if (!telefono || !credential) {
      return res.status(400).json({
        error: true,
        message: 'Teléfono y credencial son requeridos'
      });
    }

    // Buscar usuario
    const usuariosSnapshot = await db.collection('usuarios')
      .where('telefono', '==', telefono)
      .limit(1)
      .get();

    if (usuariosSnapshot.empty) {
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }

    const usuarioDoc = usuariosSnapshot.docs[0];
    const usuario = usuarioDoc.data();

    // Verificar que tenga biométrica habilitada
    if (!usuario.biometric_enabled || !usuario.biometric_credential) {
      return res.status(400).json({
        error: true,
        message: 'Autenticación biométrica no habilitada'
      });
    }

    // Verificar credencial (simplificado, en producción usar WebAuthn completo)
    if (usuario.biometric_credential !== credential) {
      return res.status(401).json({
        error: true,
        message: 'Credencial biométrica inválida'
      });
    }

    // Verificar estado
    if (usuario.estado !== 'activo') {
      return res.status(403).json({
        error: true,
        message: 'Usuario inactivo'
      });
    }

    res.json({
      success: true,
      message: 'Login biométrico exitoso',
      data: {
        uid: usuarioDoc.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido || '',
        telefono: usuario.telefono,
        rol: usuario.rol || 'padre',
        colegio_id: usuario.colegio_id || null,
        estado: usuario.estado
      }
    });

  } catch (error) {
    console.error('❌ Verify biometric error:', error);
    res.status(500).json({
      error: true,
      message: 'Error en verificación biométrica',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/verify-phone
 * Verificar teléfono y obtener token
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

    const userDoc = await db.collection('usuarios').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }

    const userData = userDoc.data();

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
 * Obtener info del usuario actual
 */
router.get('/me', async (req, res) => {
  try {
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