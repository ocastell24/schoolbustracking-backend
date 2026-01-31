// scripts/assignChildToParent.js
const { db } = require('../config/firebase');

async function assignChildToParent() {
  try {
    // ID del padre Juan Perez (+51987654321)
    const padreId = 'dmzilbieQbNAJDnKm4boT1cHwHf2'; // oscar castellanos (TU)
    
    console.log('🔍 Buscando alumnos para asignar...');
    
    // Obtener primeros 2 alumnos
    const alumnosSnapshot = await db.collection('alumnos')
      .limit(2)
      .get();

    if (alumnosSnapshot.empty) {
      console.log('❌ No hay alumnos en la BD');
      process.exit(1);
    }

    console.log(`📊 Encontrados ${alumnosSnapshot.size} alumnos`);
    console.log('📝 Asignando al padre Juan Perez...\n');

    for (const doc of alumnosSnapshot.docs) {
      const alumno = doc.data();
      
      await db.collection('alumnos').doc(doc.id).update({
        padre_id: padreId,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ ${alumno.nombre} ${alumno.apellido || ''} → Padre: Juan Perez (${padreId})`);
    }

    console.log('\n✅ Alumnos asignados correctamente');
    console.log('\n📋 Ahora puedes hacer login con:');
    console.log('   Teléfono: +51987654321');
    console.log('   Debería ver solo sus 2 hijos');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignChildToParent();