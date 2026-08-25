/*
 * Girar el carné sin que la pantalla se mueva.
 *
 * POR QUÉ EXISTE
 *
 * El carné se gira arrastrándolo. Vive dentro de una pantalla que se desplaza,
 * y en el móvil los dos gestos son el mismo: apoyar el dedo y moverlo. Ganaba
 * la pantalla, así que la tarjeta no había forma de girarla.
 *
 * La cadena que lo arregla tiene tres eslabones en tres ficheros distintos, y
 * si falta uno no pasa nada visible en el navegador —donde se prueba— pero en
 * el móvil vuelve a no girar:
 *
 *   1. `lib/bloqueoDeScroll.ts` reparte el aviso por contexto.
 *   2. `ScreenContainer` lo escucha y apaga el desplazamiento.
 *   3. `ProgressCard` lo pide al agarrar, y lo suelta SIEMPRE.
 *
 * El tercero es el que da miedo: si se pide quieto y no se suelta, la pantalla
 * se queda muerta y hay que cerrar la app. Por eso aquí se cuenta que haya
 * tantas sueltas como bloqueos, y que una de ellas esté en el desmontaje —el
 * caso de irse de la pantalla con el dedo encima.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-arrastre.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** El código sin comentarios: una promesa escrita en un comentario no cumple nada. */
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const contexto = sinComentarios(lee('lib/bloqueoDeScroll.ts'));
const pantalla = sinComentarios(lee('components/ScreenContainer.tsx'));
const tarjeta = sinComentarios(lee('components/ProgressCard.tsx'));

console.log('\n1 · El aviso llega de la tarjeta a la pantalla');
ok('el contexto existe', /createContext/.test(contexto) && /ContextoDeBloqueo/.test(contexto));
ok('con bloquear y soltar', /bloquear/.test(contexto) && /soltar/.test(contexto));
// Sin proveedor no puede reventar: la tarjeta se usa en pantallas sin scroll.
ok(
  'y sin proveedor no hace nada, en vez de romper',
  /bloquear: \(\) => \{\}/.test(contexto) && /soltar: \(\) => \{\}/.test(contexto)
);

console.log('\n2 · La pantalla se queda quieta cuando se lo piden');
ok('ScreenContainer reparte el bloqueo', /ContextoDeBloqueo\.Provider/.test(pantalla));
ok('y apaga el desplazamiento', /scrollEnabled=\{bloqueos === 0\}/.test(pantalla));
// Con dos cosas pidiendo quieto a la vez, la primera en soltar no puede
// devolver el movimiento mientras la otra sigue.
ok('se cuentan los bloqueos, no se encienden y apagan', /setBloqueos\(\(n\) => n \+ 1\)/.test(pantalla));
ok('y no baja de cero', /Math\.max\(0, n - 1\)/.test(pantalla));

console.log('\n3 · La tarjeta lo pide, y lo suelta siempre');
ok('la tarjeta usa el bloqueo', /useBloqueoDeScroll/.test(tarjeta));
ok('lo pide al agarrarla', /quietaLaPantalla\(\)/.test(tarjeta));
// El fallo que dejaría la app inutilizable: pedir quieto y no soltar.
const pide = (tarjeta.match(/quietaLaPantalla\(\)/g) ?? []).length;
const suelta = (tarjeta.match(/devuelveLaPantalla/g) ?? []).length;
ok('lo suelta al menos tantas veces como lo pide', suelta >= pide, `pide ${pide}, suelta ${suelta}`);
ok('lo suelta al soltar el dedo', /onPanResponderRelease: volver/.test(tarjeta));
ok('y si el gesto se corta', /onPanResponderTerminate: volver/.test(tarjeta));
ok(
  'y al irse de la pantalla con el dedo encima',
  /useEffect\(\(\) => devuelveLaPantalla, \[\]\)/.test(tarjeta)
);
// Es lo que impide que la tarjeta se caiga de las manos a media vuelta.
ok(
  'agarrada, no cede el gesto al ScrollView',
  /onPanResponderTerminationRequest: \(\) => !agarrada\.current/.test(tarjeta)
);

console.log('\n4 · Se puede girar en cualquier dirección, no solo en horizontal');
ok('agarrada, cualquier movimiento cuenta', /agarrada\.current \|\| horizontal/.test(tarjeta));
ok('un arrastre horizontal la gira sin agarrarla antes', /Math\.abs\(g\.dx\) > 6/.test(tarjeta));
// Quien empieza a bajar por el perfil desde encima de la tarjeta, baja.
ok('moverse pronto cancela el agarre', /clearTimeout\(espera\.current\)/.test(tarjeta));
ok('y se nota cuándo la tienes cogida', /alzada/.test(tarjeta));

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
