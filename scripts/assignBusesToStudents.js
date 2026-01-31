// scripts/assignBusesToStudents.js
const { db } = require('../config/firebase');

async function assignBusesToStudents() {
  try {
    console.log('🚌 Asignando buses a alumnos...\n');

    // Obtener primer bus disponible
    const busesSnapshot = await db.collection('buses')
      .where('estado', '==', 'activo')
      .limit(1)
      .get();

    if (busesSnapshot.empty) {
      console.log('❌ No hay buses activos en la BD');
      process.exit(1);
    }

    const busId = busesSnapshot.docs[0].id;
    const bus = busesSnapshot.docs[0].data();

    console.log(`🚌 Bus seleccionado: ${bus.placa} - ${bus.modelo}`);
    console.log(`   ID: ${busId}\n`);

    // Obtener alumnos sin bus asignado
    const alumnosSnapshot = await db.collection('alumnos')
      .where('bus_id', '==', null)
      .get();

    if (alumnosSnapshot.empty) {
      console.log('✅ Todos los alumnos ya tienen bus asignado');
      process.exit(0);
    }

    console.log(`📊 Alumnos sin bus: ${alumnosSnapshot.size}\n`);

    // Asignar el bus a cada alumno
    for (const doc of alumnosSnapshot.docs) {
      const alumno = doc.data();

      await db.collection('alumnos').doc(doc.id).update({
        bus_id: busId,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ ${alumno.nombre} ${alumno.apellido || ''} → Bus: ${bus.placa}`);
    }

    console.log('\n✅ Buses asignados correctamente');
    console.log('\n📋 Ahora los padres deberían ver el bus en su dashboard');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignBusesToStudents();