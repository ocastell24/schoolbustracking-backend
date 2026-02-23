// utils/jwt.js
const jwt = require('jsonwebtoken');

// Secret key para firmar tokens (en producción debe estar en .env)
const JWT_SECRET = process.env.JWT_SECRET || 'ontastruck-secret-key-change-in-production';

/**
 * Generar JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d' // Token válido por 30 días
  });
};

/**
 * Verificar JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};

module.exports = {
  generateToken,
  verifyToken
};
