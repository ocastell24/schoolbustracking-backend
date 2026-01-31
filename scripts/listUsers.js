// scripts/listUsers.js
const { db } = require('../config/firebase');

async function listUsers() {
  try {
    const usuariosSnapshot = await db.collection('usuarios').get();

    console.log('\n👥 USUARIOS EN EL SISTEMA:\n');
    console.log('─'.repeat(80));

    usuariosSnapshot.forEach(doc => {
      const user = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Nombre: ${user.nombre || 'N/A'} ${user.apellido || ''}`);
      console.log(`Teléfono: ${user.telefono || 'N/A'}`);
      console.log(`Email: ${user.email || 'N/A'}`);
      console.log(`Rol: ${user.rol || 'SIN ROL'}`);
      console.log(`Estado: ${user.estado || 'N/A'}`);
      console.log('─'.repeat(80));
    });

    console.log(`\nTotal: ${usuariosSnapshot.size} usuarios\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listUsers();