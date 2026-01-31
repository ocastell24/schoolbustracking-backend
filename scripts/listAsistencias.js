// scripts/listAsistencias.js
const { db } = require('../config/firebase');

async function listAsistencias() {
  try {
    console.log('📋 ASISTENCIAS EN EL SISTEMA:\n');
    console.log('─'.repeat(80));

    const asistenciasSnapshot = await db.collection('asistencias')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (asistenciasSnapshot.empty) {
      console.log('⚠️ No hay asistencias registradas en la BD');
      process.exit(0);
    }

    console.log(`Total: ${asistenciasSnapshot.size} asistencias (últimas 20)\n`);

    asistenciasSnapshot.forEach(doc => {
      const asistencia = doc.data();
      const fecha = new Date(asistencia.fecha);
      
      console.log(`ID: ${doc.id}`);
      console.log(`Alumno: ${asistencia.alumno_nombre}`);
      console.log(`Alumno ID: ${asistencia.alumno_id}`);
      console.log(`Tipo: ${asistencia.tipo}`);
      console.log(`Fecha: ${fecha.toLocaleString('es-PE')}`);
      console.log(`Bus ID: ${asistencia.bus_id}`);
      console.log(`Conductor ID: ${asistencia.conductor_id}`);
      console.log('─'.repeat(80));
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listAsistencias();