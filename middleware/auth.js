// middleware/auth.js
const { admin } = require('../config/firebase');

/**
 * Middleware para verificar token de Firebase
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: true,
        message: 'No authorization token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verificar token con Firebase
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Agregar info del usuario al request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      phone: decodedToken.phone_number
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      error: true,
      message: 'Invalid or expired token',
      details: error.message
    });
  }
};

/**
 * Middleware para verificar roles (opcional por ahora)
 */
const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const { uid } = req.user;
      
      // Obtener usuario de Firestore
      const userDoc = await admin.firestore()
        .collection('usuarios')
        .doc(uid)
        .get();

      if (!userDoc.exists) {
        return res.status(404).json({
          error: true,
          message: 'User not found'
        });
      }

      const userData = userDoc.data();
      const userRole = userData.rol;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: true,
          message: 'Insufficient permissions'
        });
      }

      req.user.role = userRole;
      next();
    } catch (error) {
      console.error('Role check error:', error.message);
      return res.status(500).json({
        error: true,
        message: 'Error checking permissions'
      });
    }
  };
};

module.exports = { verifyToken, checkRole };