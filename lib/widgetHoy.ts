import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/*
 * EL WIDGET "HOY" DE LA PANTALLA DEL MÓVIL (Android).
 *
 * Lo de hoy sin abrir la app: qué entreno toca (o si ya está hecho) y los
 * pasos. El widget no puede preguntar nada a Firestore —vive fuera de la app,
 * sin sesión—, así que la app le deja apuntado lo que tiene que enseñar cada
 * vez que se abre el inicio, y le pide que se repinte.
 *
 * En iPhone hace falta otra pieza (un "App Group" de Apple) que no se puede
 * crear desde aquí; esto es solo Android, y en el resto no hace nada.
 */

import { migrarClavesAntiguas } from './clavesAntiguas';

export const CLAVE_DEL_WIDGET = 'calico-widget-hoy';
export const NOMBRE_DEL_WIDGET = 'Hoy';

export { datosDelWidget, type DatosDelWidget } from './widgetDatos';
import type { DatosDelWidget } from './widgetDatos';

export async function leerDatosDelWidget(): Promise<DatosDelWidget | null> {
  try {
    // El widget puede pintarse antes de que se abra la app tras actualizar:
    // que encuentre sus datos con la clave nueva (lib/clavesAntiguas.ts).
    await migrarClavesAntiguas();
    const t = await AsyncStorage.getItem(CLAVE_DEL_WIDGET);
    return t ? (JSON.parse(t) as DatosDelWidget) : null;
  } catch {
    return null;
  }
}

/** Lo apunta y, en Android, repinta los widgets que haya puestos. */
export async function guardarDatosDelWidget(d: DatosDelWidget): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const nuevo = JSON.stringify(d);
    if ((await AsyncStorage.getItem(CLAVE_DEL_WIDGET)) === nuevo) return;
    await AsyncStorage.setItem(CLAVE_DEL_WIDGET, nuevo);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestWidgetUpdate } = require('react-native-android-widget');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { pintarWidgetHoy } = require('../components/WidgetHoy');
    await requestWidgetUpdate({
      widgetName: NOMBRE_DEL_WIDGET,
      renderWidget: () => pintarWidgetHoy(d, Date.now()),
    });
  } catch {
    // Sin widget puesto, o en una compilación sin él: no pasa nada.
  }
}
