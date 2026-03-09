// config/firebase.js
const admin = require('firebase-admin');
const getFirebaseCredentials = require('./firebase-credentials');

console.log('🔍 Initializing Firebase...');

let serviceAccount;
try {
  serviceAccount = getFirebaseCredentials();
  console.log('✅ Firebase credentials loaded');
  console.log('   Project ID:', serviceAccount.project_id);
} catch (error) {
  console.error('❌ Failed to load Firebase credentials:', error.message);
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://schoolbustracking.firebaseio.com",
    storageBucket: "schoolbustracking-49920.firebasestorage.app"  // ← AGREGAR ESTA LÍNEA
  });

  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };