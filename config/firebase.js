// config/firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-credentials.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://schoolbustracking-default-rtdb.firebaseio.com`
});

const db = admin.firestore();
const auth = admin.auth();

console.log('✅ Firebase Admin initialized successfully');

module.exports = { admin, db, auth };