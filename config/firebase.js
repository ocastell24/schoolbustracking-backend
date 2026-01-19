// config/firebase.js
const admin = require('firebase-admin');

console.log('🔍 Checking for Firebase credentials...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Has GOOGLE_APPLICATION_CREDENTIALS_JSON?', !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

let serviceAccount;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.log('✅ Found GOOGLE_APPLICATION_CREDENTIALS_JSON in environment');
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Successfully parsed Firebase credentials');
    console.log('Project ID from credentials:', serviceAccount.project_id);
  } catch (error) {
    console.error('❌ Error parsing Firebase credentials:', error.message);
    console.error('First 100 chars of JSON:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.substring(0, 100));
    process.exit(1);
  }
} else {
  console.log('⚠️ GOOGLE_APPLICATION_CREDENTIALS_JSON not found, trying local file...');
  try {
    serviceAccount = require('../firebase-credentials.json');
    console.log('✅ Using Firebase credentials from local file');
  } catch (error) {
    console.error('❌ Firebase credentials file not found');
    console.error('❌ Cannot start without Firebase credentials');
    process.exit(1);
  }
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
  
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };