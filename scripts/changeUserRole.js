// scripts/changeUserRole.js
const { db } = require('../config/firebase');

async function changeUserRole() {
  try {
    // Cambiar el usuario con este teléfono a admin
    const telefono = '+51970963085';
    const nuevoRol = 'admin';

    console.log(`🔍 Buscando usuario con teléfono: ${telefono}`);

    const usuariosSnapshot = await db.collection('usuarios')
      .where('telefono', '==', telefono)
      .limit(1)
      .get();

    if (usuariosSnapshot.empty) {
      console.log(`❌ Usuario con teléfono ${telefono} no encontrado`);
      process.exit(1);
    }

    const userDoc = usuariosSnapshot.docs[0];
    const user = userDoc.data();

    console.log(`\n✅ Usuario encontrado:`);
    console.log(`   ID: ${userDoc.id}`);
    console.log(`   Nombre: ${user.nombre} ${user.apellido || ''}`);
    console.log(`   Teléfono: ${telefono}`);
    console.log(`   Rol anterior: ${user.rol || 'sin rol'}`);

    // Actualizar rol
    await db.collection('usuarios').doc(userDoc.id).update({
      rol: nuevoRol,
      updatedAt: new Date().toISOString()
    });

    console.log(`   Rol nuevo: ${nuevoRol} ✅\n`);
    console.log(`🎉 Rol actualizado exitosamente`);
    console.log(`\n📋 Ahora puedes hacer login con:`);
    console.log(`   Teléfono: ${telefono}`);
    console.log(`   Debería redirigir a /admin\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

changeUserRole();