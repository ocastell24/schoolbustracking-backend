// config/firebase.js
const admin = require('firebase-admin');

// En producción (Railway), usar variable de entorno
// En desarrollo, usar archivo local
let serviceAccount;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  // Producción: parsear JSON desde variable de entorno
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Using Firebase credentials from environment variable');
  } catch (error) {
    console.error('❌ Error parsing Firebase credentials:', error);
    process.exit(1);
  }
} else {
  // Desarrollo: usar archivo local
  try {
    serviceAccount = require('../firebase-credentials.json');
    console.log('✅ Using Firebase credentials from local file');
  } catch (error) {
    console.error('❌ Firebase credentials file not found');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://schoolbustracking-default-rtdb.firebaseio.com`
});

const db = admin.firestore();
const auth = admin.auth();

console.log('✅ Firebase Admin initialized successfully');

module.exports = { admin, db, auth };