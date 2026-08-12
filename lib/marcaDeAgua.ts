import type { UserProfile } from './types';

/**
 * Proteger los vídeos de los cursos.
 *
 * Conviene decir con claridad qué se puede y qué no, porque prometer lo
 * segundo es peor que no hacer nada:
 *
 *  - En ANDROID se puede bloquear de verdad. FLAG_SECURE hace que la captura
 *    salga en negro y que la grabación de pantalla no registre nada. Lo pone
 *    expo-screen-capture.
 *  - En iOS se bloquea la captura y la grabación desde iOS 11/13, con el mismo
 *    módulo. En versiones anteriores no hace nada.
 *  - En WEB no hay forma de impedirlo. Un navegador no puede prohibir que el
 *    sistema operativo grabe la pantalla, y quien diga lo contrario está
 *    vendiendo humo.
 *  - Y CONTRA UNA CÁMARA APUNTANDO A LA PANTALLA no hay defensa técnica
 *    ninguna, en ninguna plataforma.
 *
 * De ahí que la protección de verdad sea la MARCA DE AGUA: el nombre de quien
 * está viendo el vídeo, encima del vídeo. No impide copiar; hace que la copia
 * lleve el nombre de quien la filtró. Es lo que usan las plataformas de
 * formación serias, y funciona por la razón por la que funcionan las cosas de
 * este tipo: nadie reparte un vídeo con su nombre puesto.
 *
 * La marca se MUEVE. Fija en una esquina se recorta en diez segundos; saltando
 * por la pantalla habría que recortar el vídeo entero, y entonces ya no queda
 * vídeo que repartir.
 */

/** Cada cuánto salta la marca de sitio. */
export const PASO_MS = 7000;

/**
 * Hasta dónde puede bajar la marca.
 *
 * Por debajo de esto está la barra de controles del reproductor blindado, y
 * una marca encima de los botones tapa el tiempo y estorba justo a quien está
 * viendo la clase de buena fe.
 */
export const SUELO = 0.72;

/**
 * Las posiciones por las que va pasando, en fracción del ancho y del alto.
 *
 * Ninguna está en el centro: la marca tiene que molestar al que la quiera
 * quitar, no al que está viendo la clase. Y ninguna baja de `SUELO`, que es
 * donde empiezan los controles.
 */
export const POSICIONES: { x: number; y: number }[] = [
  { x: 0.06, y: 0.08 },
  { x: 0.58, y: 0.7 },
  { x: 0.62, y: 0.1 },
  { x: 0.08, y: 0.66 },
  { x: 0.34, y: 0.42 },
];

/**
 * El texto que se estampa: quién está viendo esto.
 *
 * Lleva el nombre y un código corto de la cuenta. El nombre es lo que hace que
 * nadie lo reenvíe; el código es lo que permite saber DE QUÉ CUENTA salió
 * cuando dos alumnos se llaman igual. No lleva el correo entero a propósito:
 * una captura de pantalla de una clase no tiene por qué acabar publicando la
 * dirección de nadie.
 */
export function textoDeMarca(p: Pick<UserProfile, 'name' | 'uid'> | null | undefined): string {
  if (!p) return 'UDECA';
  const nombre = (p.name ?? '').trim();
  const codigo = (p.uid ?? '').slice(-5).toUpperCase();
  if (!nombre) return codigo ? `UDECA · ${codigo}` : 'UDECA';
  return codigo ? `${nombre} · ${codigo}` : nombre;
}

/** En qué posición toca según el tiempo que lleva abierto. */
export function posicionDeMarca(paso: number): { x: number; y: number } {
  const i = ((Math.floor(paso) % POSICIONES.length) + POSICIONES.length) % POSICIONES.length;
  return POSICIONES[i];
}

/**
 * Qué se le puede prometer al usuario en esta plataforma.
 *
 * Se usa para el aviso que ve el alumno: decirle que el vídeo está protegido
 * donde no lo está sería mentirle, y decírselo donde sí lo está es justo lo
 * que hace que se lo piense dos veces.
 */
export function avisoDeProteccion(plataforma: string): string {
  if (plataforma === 'web') {
    return 'Clase protegida: sin descargas, sin menú y con tu nombre marcado encima. No la compartas ni la grabes.';
  }
  return 'Clase protegida: no se puede grabar la pantalla ni hacer capturas, y lleva tu nombre marcado encima.';
}

/**
 * Lo que se lee al destapar la clase después de una captura.
 *
 * Lleva el nombre a propósito, y en segunda persona. El disuasorio de verdad
 * de una marca de agua no es que exista: es acordarse de que existe justo en
 * el momento de hacer la copia.
 */
export function avisoDeCaptura(nombre?: string | null): string {
  const quien = (nombre ?? '').trim().split(' ')[0];
  return quien
    ? `${quien}, esta clase va marcada con tu nombre: cualquier copia lleva tu cuenta encima. Compartirla es motivo de baja.`
    : 'Esta clase va marcada con tu nombre: cualquier copia lleva tu cuenta encima. Compartirla es motivo de baja.';
}
