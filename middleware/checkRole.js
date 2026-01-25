// middleware/checkRole.js
const { db } = require('../config/firebase');

/**
 * Middleware para verificar el rol del usuario
 * @param {Array} allowedRoles - Roles permitidos ['padre', 'conductor', 'admin', 'superadmin']
 */
const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Por ahora, obtener user_id de un header o query
      // TODO: Implementar con JWT tokens reales
      const userId = req.headers['x-user-id'] || req.query.user_id;
      
      if (!userId) {
        return res.status(401).json({
          error: true,
          message: 'Usuario no autenticado'
        });
      }

      // Obtener usuario de Firestore
      const userDoc = await db.collection('usuarios').doc(userId).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({
          error: true,
          message: 'Usuario no encontrado'
        });
      }

      const user = userDoc.data();
      
      // Verificar rol
      if (!allowedRoles.includes(user.rol)) {
        return res.status(403).json({
          error: true,
          message: `Acceso denegado. Se requiere uno de estos roles: ${allowedRoles.join(', ')}`
        });
      }
      
      // Agregar usuario al request para uso posterior
      req.user = {
        id: userId,
        ...user
      };
      
      next();
      
    } catch (error) {
      console.error('❌ Check role error:', error);
      res.status(500).json({
        error: true,
        message: 'Error verificando permisos',
        details: error.message
      });
    }
  };
};

module.exports = { checkRole };