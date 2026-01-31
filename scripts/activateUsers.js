// scripts/activateUsers.js
const { db } = require('../config/firebase');

async function activateUsers() {
  try {
    console.log('🔄 Activando usuarios pendientes...');

    const usuariosSnapshot = await db.collection('usuarios')
      .where('estado', '==', 'pendiente')
      .get();

    if (usuariosSnapshot.empty) {
      console.log('✅ No hay usuarios pendientes');
      return;
    }

    console.log(`📊 Usuarios pendientes: ${usuariosSnapshot.size}`);

    for (const doc of usuariosSnapshot.docs) {
      await db.collection('usuarios').doc(doc.id).update({
        estado: 'activo',
        updatedAt: new Date().toISOString()
      });

      const user = doc.data();
      console.log(`✅ ${user.nombre} ${user.apellido || ''} → ACTIVO`);
    }

    console.log('\n✅ Todos los usuarios activados');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

activateUsers();