// utils/validators.js

/**
 * Validar teléfono peruano
 */
const isValidPhone = (phone) => {
  // Formato: +51 seguido de 9 dígitos
  const phoneRegex = /^\+51\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * Validar email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validar placa de vehículo peruano
 */
const isValidPlaca = (placa) => {
  // Formato: ABC-123 o ABC123
  const placaRegex = /^[A-Z]{3}-?\d{3}$/;
  return placaRegex.test(placa.toUpperCase());
};

/**
 * Validar DNI peruano
 */
const isValidDNI = (dni) => {
  return /^\d{8}$/.test(dni);
};

/**
 * Sanitizar string (remover caracteres especiales)
 */
const sanitizeString = (str) => {
  return str.trim().replace(/[<>]/g, '');
};

module.exports = {
  isValidPhone,
  isValidEmail,
  isValidPlaca,
  isValidDNI,
  sanitizeString
};