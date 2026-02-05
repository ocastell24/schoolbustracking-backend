// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize Firebase
const { db } = require('./config/firebase');

// Initialize Traccar Service
const traccarService = require('./services/traccarService');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://schoolbustracking-frontend.vercel.app',
    'https://schoolbustracking-frontend-sl0q7wbmp-oscars-projects-f3afc9a2.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));
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
      firebase: '✅ Connected',
      traccarPolling: '✅ Active'
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

// Debug: Verificar que rutas se cargan
console.log('🔍 Loading routes...');

try {
  const authRoutes = require('./routes/auth');
  console.log('✅ Auth routes loaded successfully');
  
  // Debug: Ver qué rutas tiene
  if (authRoutes.stack) {
    console.log('   Routes in auth:');
    authRoutes.stack.forEach(r => {
      if (r.route) {
        const methods = Object.keys(r.route.methods).join(',').toUpperCase();
        console.log(`   - ${methods} ${r.route.path}`);
      }
    });
  }
  
  app.use('/api/auth', authRoutes);
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

try {
  app.use('/api/buses', require('./routes/buses'));
  console.log('✅ Buses routes loaded');
} catch (error) {
  console.error('❌ Error loading buses routes:', error.message);
}

try {
  app.use('/api/students', require('./routes/students'));
  console.log('✅ Students routes loaded');
} catch (error) {
  console.error('❌ Error loading students routes:', error.message);
}

try {
  app.use('/api/gps', require('./routes/gps'));
  console.log('✅ GPS routes loaded');
} catch (error) {
  console.error('❌ Error loading GPS routes:', error.message);
}

try {
  app.use('/api/admin', require('./routes/admin'));
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.error('❌ Error loading admin routes:', error.message);
}

try {
  app.use('/api/parents', require('./routes/parents'));
  console.log('✅ Parents routes loaded');
} catch (error) {
  console.error('❌ Error loading parents routes:', error.message);
}


try {
  app.use('/api/conductores', require('./routes/conductores'));
  console.log('✅ Conductores routes loaded');
} catch (error) {
  console.error('❌ Error loading conductores routes:', error.message);
}

console.log('✅ All routes loaded');

// Routes (vamos a crearlas paso a paso)
 //app.use('/api/auth', require('./routes/auth'));
 //app.use('/api/buses', require('./routes/buses'));
 //app.use('/api/students', require('./routes/students'));
 //app.use('/api/gps', require('./routes/gps'));

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

  // Iniciar polling de Traccar después de que el servidor esté listo
  setTimeout(() => {
    console.log('🚀 Iniciando servicio de polling de Traccar...');
    traccarService.startPolling(10); // Polling cada 10 segundos
  }, 3000); // Esperar 3 segundos después del inicio
});

// Cleanup al cerrar el servidor
process.on('SIGTERM', () => {
  console.log('⏹️ SIGTERM recibido, deteniendo polling...');
  traccarService.stopPolling();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⏹️ SIGINT recibido, deteniendo polling...');
  traccarService.stopPolling();
  process.exit(0);
});

module.exports = app;

// Keep process alive (fix for Windows)
process.stdin.resume();
