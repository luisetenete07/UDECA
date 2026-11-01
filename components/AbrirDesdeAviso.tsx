import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

/**
 * Tocar el aviso del móvil "Rutina actualizada" abre las notificaciones, con
 * el día que ha cambiado, en vez de dejar al alumno en el inicio buscándolo.
 *
 * Lo dice el propio aviso (`data.abrir`, ver `notifyUser`). Se borra al usarlo:
 * si no, cada vez que se montara esto volvería a abrir la misma pantalla.
 *
 * Solo en el móvil: en la web no hay avisos que tocar.
 */
export function AbrirDesdeAviso() {
  const respuesta = Notifications.useLastNotificationResponse();
  const router = useRouter();
  useEffect(() => {
    if (!respuesta || respuesta.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (respuesta.notification.request.content.data?.abrir !== 'notificaciones') return;
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      /* si no se puede borrar, como mucho se abre otra vez la misma pantalla */
    }
    router.push('/(client)/notificaciones');
  }, [respuesta, router]);
  return null;
}
