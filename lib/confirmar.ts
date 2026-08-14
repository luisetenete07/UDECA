import { Alert, Platform } from 'react-native';
import { t } from './idioma';

/**
 * "¿Seguro?", una sola vez y en un solo sitio.
 *
 * Esta función estaba copiada y pegada en tres pantallas, y en otras tres
 * faltaba: había borrados que se ejecutaban al primer toque. Un pago
 * registrado, por ejemplo, es dinero cobrado a un alumno; que desapareciera
 * porque el dedo rozó una papelera no es un fallo de diseño, es un fallo de
 * contabilidad.
 *
 * La pregunta es bloqueante a propósito. Un aviso que se puede deshacer
 * después ("Borrado · Deshacer") es mejor experiencia, pero exige guardar lo
 * borrado en algún sitio y devolverlo; mientras eso no exista, preguntar antes
 * es lo honesto.
 *
 * Para lo grande —un curso entero, un ejercicio de la biblioteca— no se usa
 * esto, sino una ventana propia que explica QUÉ se lleva por delante. Ahí el
 * usuario necesita leer, no solo confirmar.
 */
export function confirmar(mensaje: string, titulo = 'Borrar'): Promise<boolean> {
  // Se traduce aquí dentro, que es el único sitio por el que pasan todas las
  // confirmaciones de la app.
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(window.confirm(t(mensaje)));
  }
  return new Promise((resolve) => {
    Alert.alert(t(titulo), t(mensaje), [
      { text: t('Cancelar'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('Borrar'), style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
