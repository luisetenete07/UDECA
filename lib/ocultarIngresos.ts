import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * El ojo que tapa los ingresos en el inicio del entrenador.
 *
 * ES UNA MARCA DEL APARATO, NO DE LA CUENTA, y esa es toda la decisión.
 * Taparlos no es una preferencia de producto, es una reacción a quién tienes al
 * lado: se enseña el móvil a un alumno para apuntar una serie, se abre el
 * portátil en la cafetería del gimnasio, alguien mira por encima del hombro. Si
 * se guardara en la cuenta, taparlo en el gimnasio lo taparía también en casa,
 * que es justo donde se quieren ver.
 *
 * Y por eso se queda puesto entre sesiones: quien lo tapa una vez lo tapa
 * porque ese aparato se enseña, y volver a taparlo cada mañana sería pedir un
 * gesto diario para un problema que no cambia.
 *
 * Si el almacenamiento falla, se enseñan. Un número tapado que no se puede
 * destapar es peor que un número visible: lo segundo se arregla con el ojo, lo
 * primero no se arregla con nada.
 */

const CLAVE = 'udeca-ingresos-ocultos';

export async function ingresosOcultos(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE)) === '1';
  } catch {
    return false;
  }
}

export async function guardarIngresosOcultos(ocultos: boolean): Promise<void> {
  try {
    if (ocultos) await AsyncStorage.setItem(CLAVE, '1');
    else await AsyncStorage.removeItem(CLAVE);
  } catch {
    // Como mucho, el ojo no se recuerda al volver. No merece romper nada.
  }
}

/**
 * Un importe, tapado o no.
 *
 * Los puntos son SIEMPRE los mismos, no uno por cifra: con "•••" para 45 € y
 * "•••••" para 1.250 €, tapar el número seguiría diciendo el orden de magnitud,
 * que es casi todo lo que alguien querría leer por encima del hombro.
 */
export function importeVisible(valor: number | string, ocultos: boolean): string {
  return ocultos ? '•••' : `${valor} €`;
}
