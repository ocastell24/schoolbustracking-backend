// scripts/createConductor.js
const { db } = require('../config/firebase');

async function createConductor() {
  try {
    console.log('🚌 Creando usuario conductor...\n');

    // Datos del conductor
    const conductorData = {
      nombre: 'Roberto',
      apellido: 'Fernandez',
      telefono: '+51999888777',
      email: 'roberto.conductor@schoolbus.com',
      rol: 'conductor',
      estado: 'activo',
      colegio_id: 'colegio-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Crear usuario conductor
    const conductorRef = await db.collection('usuarios').add(conductorData);
    console.log(`✅ Conductor creado:`);
    console.log(`   ID: ${conductorRef.id}`);
    console.log(`   Nombre: ${conductorData.nombre} ${conductorData.apellido}`);
    console.log(`   Teléfono: ${conductorData.telefono}`);
    console.log(`   Rol: ${conductorData.rol}\n`);

    // Buscar un bus sin conductor
    const busesSnapshot = await db.collection('buses')
      .where('conductor_id', '==', null)
      .where('estado', '==', 'activo')
      .limit(1)
      .get();

    if (busesSnapshot.empty) {
      console.log('⚠️ No hay buses sin conductor asignado');
      console.log('📋 Login: ' + conductorData.telefono);
      process.exit(0);
    }

    const busDoc = busesSnapshot.docs[0];
    const bus = busDoc.data();

    // Asignar conductor al bus
    await db.collection('buses').doc(busDoc.id).update({
      conductor_id: conductorRef.id,
      updatedAt: new Date().toISOString()
    });

    console.log(`🚐 Bus asignado:`);
    console.log(`   Placa: ${bus.placa}`);
    console.log(`   Modelo: ${bus.modelo}`);
    console.log(`   ID: ${busDoc.id}\n`);

    console.log('✅ Conductor creado y bus asignado exitosamente\n');
    console.log('📋 CREDENCIALES DE LOGIN:');
    console.log(`   Teléfono: ${conductorData.telefono}`);
    console.log(`   Debería redirigir a: /conductor\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createConductor();