// scripts/addRolesToUsers.js
const { db } = require('../config/firebase');

async function addRolesToUsers() {
  try {
    console.log('🔄 Iniciando actualización de roles...');

    // Obtener todos los usuarios
    const usuariosSnapshot = await db.collection('usuarios').get();

    if (usuariosSnapshot.empty) {
      console.log('⚠️ No hay usuarios en la base de datos');
      return;
    }

    console.log(`📊 Total de usuarios encontrados: ${usuariosSnapshot.size}`);

    let updated = 0;
    let skipped = 0;

    // Actualizar cada usuario
    for (const doc of usuariosSnapshot.docs) {
      const usuario = doc.data();
      
      // Si ya tiene rol, saltarlo
      if (usuario.rol) {
        console.log(`⏭️ Usuario ${doc.id} ya tiene rol: ${usuario.rol}`);
        skipped++;
        continue;
      }

      // Asignar rol por defecto: 'padre'
      // Puedes personalizar esto según tus necesidades
      let rol = 'padre';

      // Si el email es admin@schoolbus.com, hacer admin
      if (usuario.email === 'admin@schoolbus.com') {
        rol = 'admin';
      }

      // Actualizar usuario
      await db.collection('usuarios').doc(doc.id).update({
        rol: rol,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Usuario ${doc.id} (${usuario.nombre || 'Sin nombre'}) → rol: ${rol}`);
      updated++;
    }

    console.log('\n✅ Actualización completada:');
    console.log(`   - Actualizados: ${updated}`);
    console.log(`   - Omitidos: ${skipped}`);
    console.log(`   - Total: ${usuariosSnapshot.size}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error actualizando roles:', error);
    process.exit(1);
  }
}

// Ejecutar
addRolesToUsers();