// routes/eventos.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');

// Configurar multer para manejar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

/**
 * POST /api/eventos/llegada
 * Registrar llegada al colegio con foto
 */
router.post('/llegada', verifyToken, upload.single('foto'), async (req, res) => {
  try {
    const { bus_id, colegio_id, latitude, longitude } = req.body;
    const file = req.file;
    const userId = req.user.userId || req.user.uid || null;
    console.log('👤 Usuario del token:', req.user);
    console.log('👤 userId extraído:', userId);

    console.log('📸 Registrando llegada:', { bus_id, colegio_id });

    // Validaciones
    if (!bus_id || !colegio_id) {
      return res.status(400).json({
        error: true,
        message: 'bus_id y colegio_id son requeridos'
      });
    }

    if (!file) {
      return res.status(400).json({
        error: true,
        message: 'Foto es requerida'
      });
    }

    // Verificar que el bus existe
    const busDoc = await db.collection('buses').doc(bus_id).get();
    if (!busDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Bus no encontrado'
      });
    }

    const busData = busDoc.data();

    // Subir foto a Firebase Storage
    const bucket = admin.storage().bucket();
    const timestamp = Date.now();
    const filename = `llegadas/${colegio_id}/${bus_id}_${timestamp}.jpg`;
    const blob = bucket.file(filename);

    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          bus_id: bus_id,
          colegio_id: colegio_id,
          timestamp: new Date().toISOString()
        }
      }
    });

    await new Promise((resolve, reject) => {
      blobStream.on('error', reject);
      blobStream.on('finish', resolve);
      blobStream.end(file.buffer);
    });

    // Hacer el archivo público
    await blob.makePublic();

    const foto_url = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    console.log('✅ Foto subida:', foto_url);

    // Guardar evento en Firestore
    const llegadaData = {
      bus_id,
      colegio_id,
      conductor_id: userId,
      bus_placa: busData.placa || 'N/A',
      foto_url,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    const llegadaRef = await db.collection('llegadas').add(llegadaData);

    console.log('✅ Llegada registrada:', llegadaRef.id);

    res.json({
      success: true,
      message: 'Llegada registrada exitosamente',
      data: {
        id: llegadaRef.id,
        foto_url,
        timestamp: llegadaData.timestamp
      }
    });

  } catch (error) {
    console.error('❌ Error registrando llegada:', error);
    res.status(500).json({
      error: true,
      message: 'Error al registrar llegada',
      details: error.message
    });
  }
});

/**
 * GET /api/eventos/llegadas/:colegio_id
 * Obtener llegadas de un colegio (del día o rango de fechas)
 */
router.get('/llegadas/:colegio_id', verifyToken, async (req, res) => {
  try {
    const { colegio_id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    console.log('📊 Obteniendo llegadas para colegio:', colegio_id);

    // Determinar rango de fechas
    let startDate, endDate;

    if (fecha_inicio && fecha_fin) {
      // Rango personalizado
      startDate = new Date(fecha_inicio + 'T05:00:00.000Z'); // 00:00 Peru
      endDate = new Date(fecha_fin + 'T04:59:59.999Z');
      endDate.setDate(endDate.getDate() + 1);
    } else {
      // Por defecto: hoy
      const now = new Date();
      const peruTime = new Date(now.getTime() + (-5 * 60 * 60 * 1000));
      const today = peruTime.toISOString().split('T')[0];
      startDate = new Date(today + 'T05:00:00.000Z');
      endDate = new Date(today + 'T04:59:59.999Z');
      endDate.setDate(endDate.getDate() + 1);
    }

    console.log('📅 Rango:', startDate.toISOString(), 'a', endDate.toISOString());

    // Obtener llegadas
    const snapshot = await db.collection('llegadas')
      .where('colegio_id', '==', colegio_id)
      .where('timestamp', '>=', startDate.toISOString())
      .where('timestamp', '<=', endDate.toISOString())
      .orderBy('timestamp', 'desc')
      .get();

    const llegadas = [];
    snapshot.forEach(doc => {
      llegadas.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log('✅ Llegadas encontradas:', llegadas.length);

    res.json({
      success: true,
      count: llegadas.length,
      data: llegadas
    });

  } catch (error) {
    console.error('❌ Error obteniendo llegadas:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener llegadas',
      details: error.message
    });
  }
});

/**
 * GET /api/eventos/llegadas/bus/:bus_id
 * Obtener llegadas de un bus específico
 */
router.get('/llegadas/bus/:bus_id', verifyToken, async (req, res) => {
  try {
    const { bus_id } = req.params;
    const { limit = 30 } = req.query;

    const snapshot = await db.collection('llegadas')
      .where('bus_id', '==', bus_id)
      .orderBy('timestamp', 'desc')
      .limit(parseInt(limit))
      .get();

    const llegadas = [];
    snapshot.forEach(doc => {
      llegadas.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      count: llegadas.length,
      data: llegadas
    });

  } catch (error) {
    console.error('❌ Error obteniendo llegadas del bus:', error);
    res.status(500).json({
      error: true,
      message: 'Error al obtener llegadas',
      details: error.message
    });
  }
});

module.exports = router;