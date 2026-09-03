/*
 * R8 encendido, y las reglas que hacen que siga funcionando.
 *
 * DE DÓNDE SALE ESTO
 *
 * Google Play avisó de que la app estaba "por debajo de nuestro umbral" de
 * optimización, con un 1 % de ofuscación, y de que eso puede afectar a la
 * visibilidad y a poder publicar. El 1 % era literal: la app se empaquetaba sin
 * minificar, porque el proyecto que genera Expo trae los dos interruptores
 * apagados.
 *
 * Lo que se protege aquí son las dos formas de romperlo sin enterarse:
 *
 *  - Que alguien quite el plugin de `app.json` y las compilaciones vuelvan a
 *    salir sin minificar. No falla nada; solo vuelve el aviso de Play, semanas
 *    después.
 *  - Que se caigan las reglas que hacen legible un informe de fallo. Sin ellas
 *    las trazas de producción llegan con los nombres cambiados, y entonces ya
 *    no se puede arreglar lo que se rompa.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-optimizar-android.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugin = require('../plugins/optimizar-android.js');

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

console.log('\nLos dos interruptores, con el nombre exacto');
{
  const claves = plugin.PROPIEDADES.map(([k]) => k);
  /*
   * Los nombres NO son de invención nuestra: son los que lee el build.gradle
   * que genera Expo.
   *
   *   def enableMinifyInReleaseBuilds =
   *     (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()
   *
   * Una letra distinta y `findProperty` devuelve nada, se queda el `?: false`,
   * y la compilación sale igual que antes SIN dar ningún error. Por eso se
   * comprueban letra por letra y no por parecido.
   */
  ok('minificar', claves.includes('android.enableMinifyInReleaseBuilds'), claves.join(', '));
  ok('reducir recursos', claves.includes('android.enableShrinkResourcesInReleaseBuilds'), claves.join(', '));
  ok('y las dos a true', plugin.PROPIEDADES.every(([, v]) => v === 'true'));
}

console.log('\nCómo se escriben en gradle.properties');
{
  const antes = [{ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx6144m' }];
  const despues = plugin.conPropiedades(antes);
  ok('se añaden si no estaban', despues.length === antes.length + 2);
  ok('y no se pisa lo que ya había', despues[0].value === '-Xmx6144m');
  ok('no se modifica la lista original', antes.length === 1);

  // Dos veces la misma clave en gradle.properties gana la última. Duplicar es
  // una forma silenciosa de que acabe mandando la que no es.
  const dosVeces = plugin.conPropiedades(plugin.conPropiedades(antes));
  ok('pasar dos veces no duplica', dosVeces.length === despues.length, `${dosVeces.length} vs ${despues.length}`);

  // Y si alguien la dejó apagada a mano, esto la enciende.
  const apagada = plugin.conPropiedades([
    { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
  ]);
  ok('una apagada a mano se enciende',
    apagada.find((p) => p.key === 'android.enableMinifyInReleaseBuilds').value === 'true');
}

console.log('\nLas reglas que no trae ninguna librería');
{
  const r = plugin.REGLAS;
  // Lo primero: que un fallo en producción se pueda leer.
  ok('se guarda el fichero y la línea', /-keepattributes SourceFile,LineNumberTable/.test(r));
  ok('y el nombre del fichero no se renombra', /-renamesourcefileattribute SourceFile/.test(r));
  // Las anotaciones son como React Native encuentra los módulos nativos.
  ok('se guardan las anotaciones', /-keepattributes \*Annotation\*/.test(r));
  // El puente con C++ se llama por nombre desde fuera de Java: R8 no puede ver
  // que está en uso, así que lo borraría.
  ok('el puente nativo se conserva', /-keep class com\.facebook\.jni\./.test(r));
  ok('y el motor de JavaScript', /-keep class com\.facebook\.hermes\./.test(r));
  // El reproductor de los cursos carga sus piezas por reflexión.
  ok('media3 se conserva', /-keep class androidx\.media3\./.test(r));
}

console.log('\nEstá enchufado de verdad');
{
  const app = JSON.parse(lee('app.json')).expo;
  const plugins = (app.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
  ok('el plugin está en app.json', plugins.includes('./plugins/optimizar-android'), plugins.join(', '));
  // El de la memoria tiene que seguir: sin él, el build de Android se queda sin
  // metaspace y ni llega a minificar.
  ok('y sigue el de la memoria', plugins.includes('./plugins/memoria-de-gradle'));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
