// services/notificationService.js
const { admin } = require('../config/firebase');

class NotificationService {
  /**
   * Enviar notificación push a un usuario específico
   */
  async sendNotificationToUser(userId, title, body, data = {}) {
    try {
      // Obtener token FCM del usuario desde Firestore
      const userDoc = await admin.firestore().collection('usuarios').doc(userId).get();

      if (!userDoc.exists) {
        console.log(`⚠️ Usuario ${userId} no encontrado`);
        return { success: false, error: 'Usuario no encontrado' };
      }

      const userData = userDoc.data();
      const fcmToken = userData.fcm_token;

      if (!fcmToken) {
        console.log(`⚠️ Usuario ${userId} no tiene token FCM registrado`);
        return { success: false, error: 'Token FCM no disponible' };
      }

      // Construir mensaje
      const message = {
        token: fcmToken,
        notification: {
          title: title,
          body: body
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'schoolbus_notifications'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      // Enviar notificación
      const response = await admin.messaging().send(message);
      console.log(`✅ Notificación enviada a usuario ${userId}:`, response);

      return { success: true, messageId: response };

    } catch (error) {
      console.error(`❌ Error enviando notificación a usuario ${userId}:`, error.message);

      // Si el token es inválido, limpiarlo de la base de datos
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        await admin.firestore().collection('usuarios').doc(userId).update({
          fcm_token: null
        });
        console.log(`🗑️ Token FCM inválido eliminado para usuario ${userId}`);
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Buscar padres de un alumno por array hijos
   */
  async getPadresDeAlumno(alumnoId) {
    const padresSnapshot = await admin.firestore().collection('usuarios')
      .where('rol', '==', 'padre')
      .where('hijos', 'array-contains', alumnoId)
      .get();

    if (padresSnapshot.empty) {
      console.log(`⚠️ No se encontró padre para alumno ${alumnoId}`);
      return [];
    }

    return padresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Notificar al padre cuando alumno sube al bus
   */
  async notifyStudentPickup(alumnoId, busPlaca, ruta = 'ida') {
    try {
      const alumnoDoc = await admin.firestore().collection('alumnos').doc(alumnoId).get();

      if (!alumnoDoc.exists) {
        console.log(`⚠️ Alumno ${alumnoId} no encontrado`);
        return { success: false };
      }

      const alumno = alumnoDoc.data();
      const padres = await this.getPadresDeAlumno(alumnoId);

      if (padres.length === 0) return { success: false };

      const rutaLabel = ruta === 'regreso' ? '🏠 Ruta de regreso' : '🌅 Ruta de ida';
      const title = `🚌 ${alumno.nombre} subió al bus`;
      const body = `${alumno.nombre} ${alumno.apellido} ha subido al bus ${busPlaca} (${rutaLabel})`;

      const data = {
        type: 'student_pickup',
        alumno_id: alumnoId,
        alumno_nombre: `${alumno.nombre} ${alumno.apellido}`,
        bus_placa: busPlaca,
        ruta: ruta,
        timestamp: new Date().toISOString()
      };

      const resultados = [];
      for (const padre of padres) {
        const resultado = await this.sendNotificationToUser(padre.id, title, body, data);
        resultados.push(resultado);
      }

      return { success: true, resultados };

    } catch (error) {
      console.error('❌ Error en notifyStudentPickup:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notificar al padre cuando alumno baja del bus
   */
  async notifyStudentDropoff(alumnoId, busPlaca, ruta = 'ida') {
    try {
      const alumnoDoc = await admin.firestore().collection('alumnos').doc(alumnoId).get();

      if (!alumnoDoc.exists) {
        console.log(`⚠️ Alumno ${alumnoId} no encontrado`);
        return { success: false };
      }

      const alumno = alumnoDoc.data();
      const padres = await this.getPadresDeAlumno(alumnoId);

      if (padres.length === 0) return { success: false };

      const rutaLabel = ruta === 'regreso' ? '🏠 Ruta de regreso' : '🌅 Ruta de ida';
      const title = `🏠 ${alumno.nombre} bajó del bus`;
      const body = `${alumno.nombre} ${alumno.apellido} ha bajado del bus ${busPlaca} (${rutaLabel})`;

      const data = {
        type: 'student_dropoff',
        alumno_id: alumnoId,
        alumno_nombre: `${alumno.nombre} ${alumno.apellido}`,
        bus_placa: busPlaca,
        ruta: ruta,
        timestamp: new Date().toISOString()
      };

      const resultados = [];
      for (const padre of padres) {
        const resultado = await this.sendNotificationToUser(padre.id, title, body, data);
        resultados.push(resultado);
      }

      return { success: true, resultados };

    } catch (error) {
      console.error('❌ Error en notifyStudentDropoff:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notificar al padre cuando bus se acerca (proximidad)
   */
  async notifyBusProximity(alumnoId, busPlaca, distanceMeters) {
    try {
      const alumnoDoc = await admin.firestore().collection('alumnos').doc(alumnoId).get();

      if (!alumnoDoc.exists) return { success: false };

      const alumno = alumnoDoc.data();
      const padres = await this.getPadresDeAlumno(alumnoId);

      if (padres.length === 0) return { success: false };

      let distanceText = '';
      let emoji = '';

      if (distanceMeters <= 200) {
        distanceText = `${distanceMeters}m (muy cerca)`;
        emoji = '🔴';
      } else if (distanceMeters <= 500) {
        distanceText = `${distanceMeters}m`;
        emoji = '🟡';
      }

      const title = `${emoji} El bus se acerca`;
      const body = `El bus ${busPlaca} está a ${distanceText} de la ubicación de ${alumno.nombre}`;

      const data = {
        type: 'bus_proximity',
        alumno_id: alumnoId,
        alumno_nombre: `${alumno.nombre} ${alumno.apellido}`,
        bus_placa: busPlaca,
        distance_meters: distanceMeters.toString(),
        timestamp: new Date().toISOString()
      };

      const resultados = [];
      for (const padre of padres) {
        const resultado = await this.sendNotificationToUser(padre.id, title, body, data);
        resultados.push(resultado);
      }

      return { success: true, resultados };

    } catch (error) {
      console.error('❌ Error en notifyBusProximity:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Exportar instancia única (singleton)
const notificationService = new NotificationService();
module.exports = notificationService;
