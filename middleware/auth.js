// middleware/auth.js
const { db } = require('../config/firebase');
const { verifyToken: verifyJWT } = require('../utils/jwt');

/**
 * Middleware para verificar JWT token
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

    // Verificar token JWT
    const decoded = verifyJWT(token);
    
    // El token contiene: { userId, telefono, rol, empresa_id }
    req.user = {
      uid: decoded.userId,
      id: decoded.userId,
      telefono: decoded.telefono,
      rol: decoded.rol,
      empresa_id: decoded.empresa_id
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
 * Middleware para verificar roles
 */
const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.rol;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: true,
          message: 'Insufficient permissions'
        });
      }

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