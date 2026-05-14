const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// Enviar mensaje
router.post('/send', async (req, res) => {
  try {
    const { bus_id, colegio_id, texto, sender_id, sender_nombre, sender_rol } = req.body;

    if (!bus_id || !texto || !sender_id) {
      return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
    }

    const mensaje = {
      bus_id,
      colegio_id,
      texto,
      sender_id,
      sender_nombre,
      sender_rol, // 'conductor' o 'padre'
      timestamp: new Date().toISOString(),
      createdAt: new Date()
    };

    const ref = await db.collection('chat_mensajes').add(mensaje);

    res.json({ success: true, id: ref.id, data: mensaje });
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Obtener mensajes de un bus
router.get('/mensajes/:bus_id', async (req, res) => {
  try {
    const { bus_id } = req.params;
    const { limit = 50 } = req.query;

    const snapshot = await db.collection('chat_mensajes')
      .where('bus_id', '==', bus_id)
      .orderBy('createdAt', 'asc')
      .limitToLast(Number(limit))
      .get();

    const mensajes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: undefined
    }));

    res.json({ success: true, data: mensajes });
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;