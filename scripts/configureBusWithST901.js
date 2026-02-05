// scripts/configureBusWithST901.js
const { db } = require('../config/firebase');

async function configureBusWithST901() {
  try {
    console.log('🚌 Configurando bus con ST901...\n');

    // IMEI de tu ST901 (cámbialo por el real)
    const st901_imei = '9172976591'; // ← CAMBIAR POR TU IMEI REAL
    
    // Placa del bus a configurar
    const placaBus = 'ABC-123'; // ← Puedes cambiar esto

    console.log(`🔍 Buscando bus con placa: ${placaBus}`);

    // Buscar el bus
    const busesSnapshot = await db.collection('buses')
      .where('placa', '==', placaBus)
      .limit(1)
      .get();

    if (busesSnapshot.empty) {
      console.log(`❌ No se encontró bus con placa: ${placaBus}`);
      console.log('\n💡 Buses disponibles:');
      
      const allBuses = await db.collection('buses').get();
      allBuses.forEach(doc => {
        const bus = doc.data();
        console.log(`   - ${bus.placa} (${bus.modelo})`);
      });
      
      process.exit(1);
    }

    const busDoc = busesSnapshot.docs[0];
    const bus = busDoc.data();

    console.log(`✅ Bus encontrado: ${bus.placa} - ${bus.modelo}`);
    console.log(`   ID: ${busDoc.id}\n`);

    // Actualizar con datos del ST901
    await db.collection('buses').doc(busDoc.id).update({
      gps_imei: st901_imei,
      gps_type: 'traccar',
      gps_device: 'ST901',
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Bus configurado con ST901:');
    console.log(`   Placa: ${bus.placa}`);
    console.log(`   IMEI: ${st901_imei}`);
    console.log(`   Tipo GPS: Traccar`);
    console.log(`   Dispositivo: ST901\n`);

    console.log('📋 PRÓXIMOS PASOS:');
    console.log('1. Configurar ST901 con comandos SMS');
    console.log('2. Configurar webhook en Traccar:');
    console.log('   URL: https://schoolbustracking-backend-production.up.railway.app/api/gps/traccar-webhook');
    console.log('3. En Traccar, asociar dispositivo con IMEI:', st901_imei);
    console.log('4. Probar que las posiciones lleguen al backend\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

configureBusWithST901();