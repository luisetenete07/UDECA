/*
 * Los permisos de fotos y vídeos que Google Play no perdona.
 *
 * QUÉ PASÓ
 *
 * Play rechazó la subida con esto:
 *
 *   "Tu aplicación debe usar el selector de fotos de Android u otros
 *    selectores del sistema, en lugar de solicitar los permisos
 *    READ_MEDIA_IMAGES o READ_MEDIA_VIDEO."
 *
 * Y lo primero que se piensa es que viene del selector de fotos de la app
 * —subir la foto de perfil, las de progreso, las libretas de comidas—. No es
 * eso: `expo-image-picker` ya usa el selector del sistema y no pide ninguno de
 * los dos.
 *
 * Lo declara `expo-screen-capture`, el módulo que protege los vídeos de los
 * cursos. Lo pide para poder AVISAR de una captura en Android 13 exacto,
 * mirando la galería. En Android 14 y siguientes usa DETECT_SCREEN_CAPTURE, y
 * en Android 12 y anteriores, READ_EXTERNAL_STORAGE.
 *
 * QUÉ SE PIERDE AL QUITARLO: NADA
 *
 * En Android la captura no se avisa, se IMPIDE: `preventScreenCaptureAsync`
 * pone FLAG_SECURE y la pantalla sale en negro. El aviso es el plan B para un
 * iPhone viejo, donde el bloqueo no llega. Quitando el permiso, en Android 13
 * deja de saltar un aviso de algo que en Android no puede pasar.
 *
 * CÓMO SE QUITA
 *
 * Con `blockedPermissions` de Expo, que mete `tools:node="remove"` en el
 * manifiesto final. No basta con no pedirlo: lo añade una librería, y la fusión
 * de manifiestos de Android lo mete igual.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-permisos-de-fotos.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

const app = JSON.parse(lee('app.json')).expo;

console.log('\nLos dos permisos que Play rechaza, fuera del manifiesto');
{
  const bloqueados = app.android?.blockedPermissions ?? [];
  ok('READ_MEDIA_IMAGES está bloqueado', bloqueados.includes('android.permission.READ_MEDIA_IMAGES'));
  ok('READ_MEDIA_VIDEO también', bloqueados.includes('android.permission.READ_MEDIA_VIDEO'));
  // Y que no se cuelen pedidos a mano por otro lado.
  const pedidos = app.android?.permissions ?? [];
  ok('y no se piden por su cuenta', !pedidos.some((x) => /READ_MEDIA_(IMAGES|VIDEO)/.test(x)), pedidos.join(', '));
}

console.log('\nQuién los traía, para saber dónde mirar si vuelven');
{
  /*
   * Se comprueba contra el paquete instalado. El día que expo-screen-capture
   * deje de pedirlo —o que empiece a pedirlo otro— este renglón lo dice, y
   * entonces se sabe si el bloqueo sigue haciendo falta o si hay uno nuevo.
   */
  let manifiesto = '';
  try {
    manifiesto = lee('node_modules/expo-screen-capture/android/src/main/AndroidManifest.xml');
  } catch {
    /* si el paquete ya no está, tampoco trae el permiso */
  }
  const loPide = /READ_MEDIA_IMAGES/.test(manifiesto);
  ok(
    'el permiso sigue viniendo de expo-screen-capture',
    loPide || manifiesto === '',
    'ya no lo pide: comprueba si ahora lo trae otro paquete antes de quitar el bloqueo'
  );
}

console.log('\nY la protección de los vídeos sigue siendo real');
{
  const marca = lee('components/MarcaDeAgua.tsx');
  // Esto es lo que de verdad protege en Android, y no depende de ningún permiso.
  ok('se bloquea la captura, no solo se avisa', /preventScreenCaptureAsync\(CLAVE\)/.test(marca));
  ok('y se suelta al cerrar el vídeo', /allowScreenCaptureAsync\(CLAVE\)/.test(marca));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
