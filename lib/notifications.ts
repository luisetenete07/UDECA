import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getUserProfile } from './firestore/users';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Pide permiso y registra el dispositivo para notificaciones push, guardando
 * el token en el perfil del usuario. No hace nada en web (no soportado) ni
 * en simuladores. Requiere haber configurado un proyecto EAS
 * (`extra.eas.projectId` en app.json, generado con `npx eas init`) para
 * poder generar el token — si falta, falla en silencio.
 */
export async function registerForPushNotificationsAsync(uid: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync();
    await updateDoc(doc(db, 'users', uid), { pushToken });
  } catch {
    // Sin projectId de EAS configurado, o dispositivo sin Play/App Store
    // services: nos degradamos a solo notificaciones locales.
  }
}

/** Envía una notificación push a través de la API de Expo (sin backend propio). */
export async function sendPushNotification(
  pushToken: string | undefined | null,
  title: string,
  body: string
): Promise<void> {
  if (!pushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body }),
    });
  } catch {
    // Si falla el envío (sin conexión, token inválido...) lo ignoramos:
    // la notificación es un extra, nunca debe romper la acción principal.
  }
}

/** Busca el push token de un usuario por su uid y le envía una notificación. */
export async function notifyUser(uid: string, title: string, body: string): Promise<void> {
  const profile = await getUserProfile(uid);
  await sendPushNotification(profile?.pushToken, title, body);
}

/** Programa un recordatorio local (no requiere token ni conexión). */
export async function scheduleLocalReminder(
  title: string,
  body: string,
  secondsFromNow: number
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
        repeats: false,
      },
    });
  } catch {
    // No crítico: si falla, el usuario simplemente no recibe el recordatorio local.
  }
}

const WORKOUT_REMINDER_ID = 'daily-workout-reminder';

/**
 * Programa (o reprograma) un recordatorio diario de entrenamiento a la hora
 * indicada. Cancela primero el anterior para no acumular duplicados.
 * Devuelve true si quedó programado. En web no está soportado.
 */
export async function scheduleWorkoutReminder(hour: number, minute: number): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return false;

    await cancelWorkoutReminder();
    await Notifications.scheduleNotificationAsync({
      identifier: WORKOUT_REMINDER_ID,
      content: {
        title: 'Hora de entrenar',
        body: 'Tu sesión de hoy te espera. ¡Vamos a por ella!',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelWorkoutReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(WORKOUT_REMINDER_ID);
  } catch {
    // Si no existía, no pasa nada.
  }
}

const CHECKIN_REMINDER_ID = 'weekly-checkin-reminder';

/**
 * Recordatorio semanal para hacer el check-in (domingos a las 19:00). Ayuda a
 * mantener la comunicación coach-alumno. En web no está soportado.
 */
export async function scheduleCheckinReminder(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return false;

    await cancelCheckinReminder();
    await Notifications.scheduleNotificationAsync({
      identifier: CHECKIN_REMINDER_ID,
      content: {
        title: 'Check-in semanal',
        body: 'Cuéntale a tu entrenador cómo ha ido la semana: energía, sueño y sensaciones.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // 1 = domingo
        hour: 19,
        minute: 0,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelCheckinReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(CHECKIN_REMINDER_ID);
  } catch {
    // Si no existía, no pasa nada.
  }
}
