// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize Firebase
const { db } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint with Firebase test
app.get('/health', async (req, res) => {
  try {
    // Test Firestore connection
    await db.collection('_health_check').doc('test').set({
      timestamp: new Date().toISOString(),
      status: 'ok'
    });

    res.json({ 
      status: 'OK', 
      message: 'SchoolBusTracking API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      firebase: '✅ Connected'
    });
  } catch (error) {
    console.error('❌ Firebase error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: 'Firebase connection failed',
      error: error.message
    });
  }
});

// Test endpoint to verify code is running
app.get('/test-firebase', async (req, res) => {
  console.log('🧪 Test endpoint called');
  try {
    console.log('🧪 Attempting Firestore write...');
    
    const testDoc = await db.collection('_test').doc('test123').set({
      timestamp: new Date().toISOString(),
      message: 'Firebase test successful!'
    });
    
    console.log('✅ Firestore write successful');
    
    res.json({
      success: true,
      message: 'Firebase is working!',
      firebase: '✅ Connected and tested'
    });
  } catch (error) {
    console.error('❌ Firebase test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: '🚌 SchoolBusTracking API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      buses: '/api/buses/*',
      students: '/api/students/*',
      gps: '/api/gps/*'
    }
  });
});

// Routes (vamos a crearlas paso a paso)
 app.use('/api/auth', require('./routes/auth'));
 app.use('/api/buses', require('./routes/buses'));
 app.use('/api/students', require('./routes/students'));
// app.use('/api/gps', require('./routes/gps'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: 'Endpoint not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚌 SchoolBusTracking API Started     ║
║  Port: ${PORT}                           ║
║  Environment: ${process.env.NODE_ENV}              ║
║  Health: http://localhost:${PORT}/health  ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;

// Keep process alive (fix for Windows)
process.stdin.resume();