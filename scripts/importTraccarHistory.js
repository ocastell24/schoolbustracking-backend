// scripts/importTraccarHistory.js
const axios = require('axios');
const { db } = require('../config/firebase');

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://34.173.106.142:8082';
const TRACCAR_USER = process.env.TRACCAR_USER || 'ocastell24@gmail.com';
const TRACCAR_PASSWORD = process.env.TRACCAR_PASSWORD || 'admin';

/**
 * Importar historial de posiciones desde Traccar
 */
async function importHistory(deviceId, fecha) {
  try {
    console.log(`📥 Importando historial del dispositivo ${deviceId} para ${fecha}...`);

    // Calcular rango de fechas (todo el día)
    const startDate = new Date(fecha);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(fecha);
    endDate.setHours(23, 59, 59, 999);

    // Obtener información del dispositivo
    const deviceResponse = await axios.get(`${TRACCAR_URL}/api/devices/${deviceId}`, {
      auth: { username: TRACCAR_USER, password: TRACCAR_PASSWORD }
    });
    const device = deviceResponse.data;
    const uniqueId = device.uniqueId;

    console.log(`📱 Dispositivo: ${device.name} (IMEI: ${uniqueId})`);

    // Buscar bus en Firestore
    const busesSnapshot = await db.collection('buses')
      .where('gps_imei', '==', uniqueId)
      .limit(1)
      .get();

    if (busesSnapshot.empty) {
      console.log(`⚠️ Bus no encontrado para IMEI: ${uniqueId}`);
      return { success: false, message: 'Bus no encontrado' };
    }

    const busDoc = busesSnapshot.docs[0];
    const busId = busDoc.id;
    const bus = busDoc.data();

    console.log(`🚌 Bus encontrado: ${bus.placa}`);

    // Obtener posiciones desde Traccar
    const positionsResponse = await axios.get(`${TRACCAR_URL}/api/positions`, {
      params: {
        deviceId: deviceId,
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      auth: { username: TRACCAR_USER, password: TRACCAR_PASSWORD }
    });

    const positions = positionsResponse.data;
    console.log(`📍 Posiciones obtenidas: ${positions.length}`);

    if (positions.length === 0) {
      console.log('⚠️ No hay posiciones para importar');
      return { success: true, imported: 0 };
    }

    // Verificar cuáles ya existen en Firestore
    const existingPositions = new Set();
    const existingSnapshot = await db.collection('gps_positions')
      .where('bus_id', '==', busId)
      .where('timestamp', '>=', startDate.toISOString())
      .where('timestamp', '<=', endDate.toISOString())
      .get();

    existingSnapshot.forEach(doc => {
      const data = doc.data();
      existingPositions.add(data.timestamp);
    });

    console.log(`✅ Ya existen ${existingPositions.size} posiciones en Firestore`);

    // Importar solo las que no existen
    let imported = 0;
    const batch = db.batch();
    
    for (const position of positions) {
      const timestamp = position.deviceTime || position.fixTime;
      
      // Skip si ya existe
      if (existingPositions.has(timestamp)) {
        continue;
      }

      const gpsRef = db.collection('gps_positions').doc();
      batch.set(gpsRef, {
        bus_id: busId,
        placa: bus.placa,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed || 0,
        altitude: position.altitude || 0,
        course: position.course || 0,
        source: 'traccar-import',
        device_id: uniqueId,
        timestamp: timestamp,
        createdAt: new Date().toISOString()
      });

      imported++;

      // Firestore batch limit es 500
      if (imported % 500 === 0) {
        await batch.commit();
        console.log(`💾 Guardadas ${imported} posiciones...`);
      }
    }

    // Guardar las restantes
    if (imported % 500 !== 0) {
      await batch.commit();
    }

    console.log(`✅ Importación completada: ${imported} posiciones nuevas guardadas`);

    return { success: true, imported: imported, total: positions.length };

  } catch (error) {
    console.error('❌ Error importando historial:', error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Importar historial de todos los dispositivos
 */
async function importAllDevices(fecha) {
  try {
    console.log(`\n🌍 Importando historial de todos los dispositivos para ${fecha}...\n`);

    // Obtener todos los dispositivos
    const devicesResponse = await axios.get(`${TRACCAR_URL}/api/devices`, {
      auth: { username: TRACCAR_USER, password: TRACCAR_PASSWORD }
    });

    const devices = devicesResponse.data;
    console.log(`📱 Dispositivos encontrados: ${devices.length}\n`);

    const results = [];

    for (const device of devices) {
      const result = await importHistory(device.id, fecha);
      results.push({
        deviceId: device.id,
        name: device.name,
        ...result
      });
      console.log('─'.repeat(60));
    }

    // Resumen final
    console.log('\n📊 RESUMEN DE IMPORTACIÓN:\n');
    const totalImported = results.reduce((sum, r) => sum + (r.imported || 0), 0);
    console.log(`✅ Total importado: ${totalImported} posiciones`);
    
    results.forEach(r => {
      if (r.imported > 0) {
        console.log(`   ${r.name}: ${r.imported}/${r.total} posiciones`);
      }
    });

    return results;

  } catch (error) {
    console.error('❌ Error general:', error.message);
    throw error;
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  // Usar fecha de hoy por defecto
  const fecha = process.argv[2] || new Date().toISOString().split('T')[0];
  
  console.log(`\n🚀 Iniciando importación para fecha: ${fecha}\n`);
  
  importAllDevices(fecha)
    .then(() => {
      console.log('\n✅ Proceso completado exitosamente');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Error en el proceso:', err);
      process.exit(1);
    });
}

module.exports = { importHistory, importAllDevices };