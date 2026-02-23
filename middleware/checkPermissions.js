// middleware/checkPermissions.js
const { db } = require('../config/firebase');

/**
 * Middleware para verificar si el usuario tiene acceso a un camión específico
 */
const checkCamionAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const camionId = req.params.id || req.params.camionId || req.query.bus_id || req.query.camion_id;
    
    // Obtener datos del usuario
    const userDoc = await db.collection('usuarios').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Usuario no encontrado'
      });
    }
    
    const user = userDoc.data();
    
    // Super admin tiene acceso a todo
    if (user.rol === 'super_admin') {
      return next();
    }
    
    // Admin tiene acceso a todos los camiones de su empresa
    if (user.rol === 'admin') {
      // Verificar que el camión pertenezca a su empresa
      if (camionId) {
        const camionDoc = await db.collection('camiones').doc(camionId).get();
        if (camionDoc.exists && camionDoc.data().empresa_id === user.empresa_id) {
          return next();
        }
        return res.status(403).json({
          error: true,
          message: 'No tienes permiso para acceder a este camión'
        });
      }
      return next();
    }
    
    // Viewer con permisos temporales
    if (user.rol === 'viewer') {
      if (!user.permisos) {
        return res.status(403).json({
          error: true,
          message: 'No tienes permisos configurados'
        });
      }
      
      // Verificar si está activo
      if (!user.permisos.activo) {
        return res.status(403).json({
          error: true,
          message: 'Tu acceso ha sido desactivado'
        });
      }
      
      // Verificar expiración
      const now = new Date();
      const expiracion = new Date(user.permisos.fecha_expiracion);
      
      if (now > expiracion) {
        // Desactivar automáticamente
        await db.collection('usuarios').doc(userId).update({
          'permisos.activo': false,
          estado: 'inactivo'
        });
        
        return res.status(403).json({
          error: true,
          message: 'Tu acceso ha expirado',
          expiro: true
        });
      }
      
      // Verificar si tiene acceso a este camión específico
      if (camionId && !user.permisos.camiones_permitidos.includes(camionId)) {
        return res.status(403).json({
          error: true,
          message: 'No tienes permiso para ver este camión'
        });
      }
      
      // Todo OK
      return next();
    }
    
    // Rol no reconocido
    return res.status(403).json({
      error: true,
      message: 'Rol no reconocido'
    });
    
  } catch (error) {
    console.error('❌ Error en checkCamionAccess:', error);
    return res.status(500).json({
      error: true,
      message: 'Error verificando permisos',
      details: error.message
    });
  }
};

/**
 * Función helper para verificar si un acceso ha expirado
 */
const isExpired = (fechaExpiracion) => {
  const now = new Date();
  const expiracion = new Date(fechaExpiracion);
  return now > expiracion;
};

/**
 * Función helper para calcular días restantes
 */
const diasRestantes = (fechaExpiracion) => {
  const now = new Date();
  const expiracion = new Date(fechaExpiracion);
  const diff = expiracion - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

module.exports = {
  checkCamionAccess,
  isExpired,
  diasRestantes
};
