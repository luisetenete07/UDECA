/*
 * Comprobación del orden guardado del panel (lib/panelOrder.ts).
 *
 * El riesgo aquí no es que se vea raro: es que una preferencia guardada hace
 * meses ESCONDA un bloque que se añadió después. Si el cruce entre lo guardado
 * y lo que existe hoy falla, un entrenador puede dejar de ver sus cobros sin
 * enterarse y sin manera de entender por qué.
 *
 *   node --import ./scripts/_ts-hook.mjs scripts/check-panel-order.mjs
 */
import { mezclarOrden } from '../lib/panelOrder.ts';

let fallos = 0;
function comprueba(nombre, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (ok) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre} — esperaba [${esperado}] y salió [${obtenido}]`);
    fallos++;
  }
}

console.log('Orden del panel:');

comprueba('sin nada guardado, manda el orden de fábrica', mezclarOrden([], ['a', 'b', 'c']), [
  'a',
  'b',
  'c',
]);

comprueba('lo guardado se respeta', mezclarOrden(['c', 'a', 'b'], ['a', 'b', 'c']), [
  'c',
  'a',
  'b',
]);

// El caso que de verdad importa: se añade un bloque nuevo a la app y alguien
// tiene ya un orden guardado de antes. Tiene que aparecer, no desaparecer.
comprueba('un bloque NUEVO se añade al final', mezclarOrden(['c', 'a'], ['a', 'b', 'c']), [
  'c',
  'a',
  'b',
]);

comprueba('un bloque que ya no existe se cae', mezclarOrden(['c', 'z', 'a', 'b'], ['a', 'b', 'c']), [
  'c',
  'a',
  'b',
]);

comprueba('un guardado inservible no pierde nada', mezclarOrden(['z'], ['a', 'b']), ['a', 'b']);

comprueba('no se cuela ningún duplicado', mezclarOrden(['a', 'a', 'b'], ['a', 'b']), ['a', 'b']);

if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallida(s).`);
  process.exit(1);
}
console.log('\nTodo correcto.');
