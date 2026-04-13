// routes/eventos.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');

// Configurar multer para manejar uploads de foto y video
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB máximo (para videos)
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 Mimetype recibido:', file.mimetype);
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm',
      'video/3gpp', 'video/3gpp2', 'video/x-msvideo', 'video/mpeg'
    ];
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  }
});

/**
 * POST /api/eventos/llegada
 * Registrar llegada al colegio con foto o video
 */
router.post('/llegada', verifyToken, upload.fields([
  { name: 'foto', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { bus_id, colegio_id, latitude, longitude, tipo } = req.body;
    const userId = req.user.userId || req.user.uid || null;
    console.log('👤 Usuario del token:', req.user);
    console.log('👤 userId extraído:', userId);

    // Detectar si llegó foto o video
    const file = req.files?.['foto']?.[0] || req.files?.['video']?.[0];
    const tipoArchivo = tipo || (req.files?.['foto'] ? 'foto' : 'video');

    console.log(`📸 Registrando llegada (${tipoArchivo}):`, { bus_id, colegio_id });

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
        message: 'Foto o video es requerido'
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

    // Determinar extensión según tipo
    const esVideo = tipoArchivo === 'video' || file.mimetype.startsWith('video/');
    const extension = esVideo ? 'mp4' : 'jpg';
    const carpeta = esVideo ? 'llegadas_video' : 'llegadas';

    // Subir archivo a Firebase Storage
    const bucket = admin.storage().bucket();
    const timestamp = Date.now();
    const filename = `${carpeta}/${colegio_id}/${bus_id}_${timestamp}.${extension}`;
    const blob = bucket.file(filename);

    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          bus_id: bus_id,
          colegio_id: colegio_id,
          tipo: tipoArchivo,
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

    const archivo_url = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    console.log(`✅ ${esVideo ? 'Video' : 'Foto'} subido:`, archivo_url);

    // Guardar evento en Firestore
    const llegadaData = {
      bus_id,
      colegio_id,
      conductor_id: userId,
      bus_placa: busData.placa || 'N/A',
      tipo: tipoArchivo,                          // 'foto' | 'video'
      foto_url: esVideo ? null : archivo_url,     // compatibilidad con código anterior
      video_url: esVideo ? archivo_url : null,
      archivo_url,                                // campo unificado
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    const llegadaRef = await db.collection('llegadas').add(llegadaData);

    console.log('✅ Llegada registrada:', llegadaRef.id);

    res.json({
      success: true,
      message: `Llegada registrada exitosamente (${tipoArchivo})`,
      data: {
        id: llegadaRef.id,
        tipo: tipoArchivo,
        archivo_url,
        foto_url: llegadaData.foto_url,
        video_url: llegadaData.video_url,
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
      startDate = new Date(fecha_inicio + 'T05:00:00.000Z');
      endDate = new Date(fecha_fin + 'T04:59:59.999Z');
      endDate.setDate(endDate.getDate() + 1);
    } else {
      const now = new Date();
      const peruTime = new Date(now.getTime() + (-5 * 60 * 60 * 1000));
      const today = peruTime.toISOString().split('T')[0];
      startDate = new Date(today + 'T05:00:00.000Z');
      endDate = new Date(today + 'T04:59:59.999Z');
      endDate.setDate(endDate.getDate() + 1);
    }

    console.log('📅 Rango:', startDate.toISOString(), 'a', endDate.toISOString());

    const snapshot = await db.collection('llegadas')
      .where('colegio_id', '==', colegio_id)
      .where('timestamp', '>=', startDate.toISOString())
      .where('timestamp', '<=', endDate.toISOString())
      .orderBy('timestamp', 'desc')
      .get();

    const llegadas = [];
    snapshot.forEach(doc => {
      llegadas.push({ id: doc.id, ...doc.data() });
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
      llegadas.push({ id: doc.id, ...doc.data() });
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