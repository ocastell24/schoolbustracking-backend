// config/firebase-credentials.js
module.exports = function getFirebaseCredentials() {
  
  // PRODUCCIÓN: Hardcoded temporalmente (Railway no guarda env vars)
  if (process.env.RAILWAY_ENVIRONMENT_NAME === 'production') {
    return {
      type: "service_account",
      project_id: "schoolbustracking-49920",
      private_key_id: "bf9ca1442ac25fc1a7f897410e711c2570fac7eb",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6QaEk6+v6pV5L\ndyT64U2j664sLeUze5qb1DJl9BTnGOp6WauMi5O9C7naRxoXrT3yIyI7Wq6AzQbQ\nwy/CfSf52vwzXR56F1s2kKbWT6edPl8jj0EQbpKgB1RGAUq0Eyo4ahkF8W7WN8xK\nUsFRkY195qrGXd/WH8b8TcpuhZpoZEvS6Q78pbv7ZxMR4Z7ig9vdG61Rm2TU1Uqz\n0vgqlF3+2D5iepmK6+Hl1hA7GIYZKI10SIf3j4N54+blS+hAvQpbyaimqarsHRd9\nKBYRjhtu3bMg8w+7+0tIbXEvIdI+s+AAmYaFG7ZKp5YuXzFvqRE5BCzunNliqT4s\nsjyN9fDpAgMBAAECggEATWhbNYILR9cUcl6o8s9SOi8H6vqECDp1jg/Jhk/DpCvZ\nv1GnFzknBGlsK0hjkrWASjLJ1ksgvQz4qSiFn9nuFEwrhplLwkgUs3+4ptbh/Vrf\npWKzEsYxj+qb3qBI0MAqStnlXm/xtXvpHnZ4O5M3b7y++sQm89GvHEqkN/y0qG9X\nZfFVHaM9Fid+v7iArpcZP62WE75FRm4Zamp+QqphBkDIjpCH7OJZ4wI/5asYzFgJ\nkYcEIVtnALQAsW0FrvZzkS+LZNHIW2hRF8OEa4XWGZ8gM8ehS9RQ06QMari76nx9\n1brSoVmoLSoPjL/NDsVuctdehfUlWpSDtVjRCLn4pQKBgQD5pPPf9hCwhIb9vgBH\nnNugQnjlmrdw69Yu+J6JR9vMKiKOUdOsHCbsMvLC+johDDVkN/D6Y/yQHJFYiJe8\njT8U2rtP/+qvSeayVVaiy/iKhFQW3vy63ht73/C0Ibmp87PqzCq/mwv4jEFYFFKP\n1ib94yBREcboaAvbgTsMVaskFwKBgQC+/4xRmG6nDSZvgkMHtXgvz3gVNx4RBYc+\nnY1I5Lnx34U1qKuagtCWpL28JLDOJ70NTlhO5CMXCsVtPHCU5QhkPw4r8kZJ+1PH\n8oxk7bhdWVvZMS/HAOrUOvDj+cfG0Ge1zBamF2irXGwVAHZHEDQGOxOVW5pUf3h5\nEaCnL+Oy/wKBgHtajYKptJ90LLuuqba5BDDRB6n0ZBYxAjldcgDFeA8O9to6Boyx\nsG3f0uKTACwaOzuVBMbEpySSaSNFAy0Q4g2s8wdZnh4VNyABWPjCLsJLFr3iWyD+\n5Le19NsdGv+mQs2PKsRYmXar3xHloNIf8E5dbzd/wDhQSSOiXIoAvrrrAoGBAIDG\n1jnxl7GkSSTn4//fl8BMlv9e4TPC0XQjUC40oTZ2aV9LcSBFURQw0Qh4iIkG/A1r\npFjUsuAHUCOdm56YabcFWK3CtSeOf+eRHp2yNhsic64V3svDT5F2iBJ9x/fBbhuC\nFkc4A0d+khT68cRqJVmKHWMXlw+fvn+KphHzVQfLAoGBAK/SJ4nOyS7h8bPO20j4\nrjfHNicSR7eBtk906KHmZWNRHB1t/26y5dwECuZlVJUsWbmi3CNBRImFTxNK1st8\n1yCz2LTwBVynyW3V+buuP75ifTLzU76p1bhZ1S6huo4ZC2BS0G+2ptTW6TMJ56BR\nTY2mbSUBXv277K0My4ZzfB21\n-----END PRIVATE KEY-----\n",
      client_email: "firebase-adminsdk-fbsvc@schoolbustracking-49920.iam.gserviceaccount.com",
      client_id: "101792936248283866752",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: ""
    };
  }

  // DESARROLLO: Usar archivo local
  try {
    return require('../firebase-credentials.json');
  } catch (e) {
    throw new Error('No Firebase credentials found');
  }
};