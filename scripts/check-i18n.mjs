/*
 * La app en inglés (lib/i18n.ts).
 *
 * Lo que hay que proteger: que una frase sin traducir NUNCA deje un hueco en
 * blanco ni un identificador a la vista —lo peor que puede pasar es que salga
 * en español, que es lo que pasaba antes con la app entera— y que el
 * diccionario no tenga entradas vacías, que es la forma silenciosa de romper
 * una pantalla.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-i18n.mjs
 */
import { cuantasTraducidas, EN, idiomaDe, IDIOMAS, traducir } from '../lib/i18n.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nTraducir');
{
  comprueba('en español devuelve el español', traducir('Mi entrenamiento', 'es') === 'Mi entrenamiento');
  comprueba('en inglés, el inglés', traducir('Mi entrenamiento', 'en') === 'My training');
  // Lo importante de todo esto: una frase que falta sale en español, nunca en
  // blanco y nunca como un identificador.
  const sinTraducir = 'Una frase que todavía no está en el diccionario';
  comprueba('lo que falta sale en español', traducir(sinTraducir, 'en') === sinTraducir);
  comprueba('y en español también', traducir(sinTraducir, 'es') === sinTraducir);
  comprueba('una cadena vacía no rompe', traducir('', 'en') === '');
}

console.log('\nLos huecos');
{
  // Se sustituyen DESPUÉS de traducir, para que un nombre o una cifra no
  // dependan del idioma.
  comprueba(
    'se rellenan',
    traducir('Hola, {nombre}', 'es', { nombre: 'Luis' }) === 'Hola, Luis'
  );
  comprueba(
    'también en inglés',
    traducir('Hola, {nombre}', 'en', { nombre: 'Luis' }) === 'Hola, Luis'
  );
  comprueba('un hueco sin valor se queda como está', traducir('Hola, {nombre}', 'es', {}) === 'Hola, {nombre}');
  comprueba('sin huecos que rellenar, igual', traducir('Inicio', 'en') === 'Home');
  comprueba('acepta números', traducir('{n} series', 'es', { n: 4 }) === '4 series');
}

console.log('\nQué idioma le toca a cada uno');
{
  comprueba('lo que ha elegido manda', idiomaDe('en', 'es-ES') === 'en');
  comprueba('y al revés', idiomaDe('es', 'en-GB') === 'es');
  comprueba('sin elegir, el del móvil', idiomaDe(undefined, 'en-US') === 'en');
  comprueba('un móvil en español, español', idiomaDe(undefined, 'es-MX') === 'es');
  // Cualquier otro idioma cae en español, que es la lengua de la app: un
  // francés entiende antes el español de una app española que un inglés a
  // medias.
  comprueba('un móvil en francés, español', idiomaDe(undefined, 'fr-FR') === 'es');
  comprueba('sin saber nada, español', idiomaDe(undefined, undefined) === 'es');
  comprueba('una preferencia rara se ignora', idiomaDe('klingon', 'en-US') === 'en');
  comprueba('mayúsculas del sistema dan igual', idiomaDe(undefined, 'EN-us') === 'en');
}

console.log('\nEl diccionario');
{
  const claves = Object.keys(EN);
  comprueba('tiene entradas', claves.length > 100, String(claves.length));
  comprueba('cuantasTraducidas cuadra', cuantasTraducidas() === claves.length);
  // Una entrada vacía es la forma silenciosa de dejar una pantalla sin texto.
  comprueba('ninguna traducción vacía', claves.every((k) => (EN[k] ?? '').trim().length > 0));
  comprueba('ninguna clave vacía', claves.every((k) => k.trim().length > 0));
  // Una traducción idéntica al español casi siempre es un despiste (se copió y
  // no se tradujo). Se permiten las que de verdad se escriben igual.
  const iguales = claves.filter((k) => EN[k] === k);
  const permitidas = new Set(['Grease the groove', 'Social']);
  comprueba(
    'ninguna traducción es una copia del español',
    iguales.every((k) => permitidas.has(k)),
    iguales.filter((k) => !permitidas.has(k)).join(', ')
  );
  comprueba('los dos idiomas están ofrecidos', IDIOMAS.length === 2);
  comprueba('con su nombre en su propio idioma', IDIOMAS.some((i) => i.texto === 'English'));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
