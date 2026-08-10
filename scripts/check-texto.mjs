/*
 * Juntar trozos de texto (lib/texto.ts).
 *
 * Un separador colgando —"Días sueltos ·  · Int. 7/10"— no dice "falta un
 * dato", dice "esta app está a medio hacer", y sale justo en las pantallas que
 * más se miran. Estas comprobaciones son las cuatro formas en que un dato
 * puede no estar.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-texto.mjs
 */
import { SEPARADOR, unido } from '../lib/texto.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nLo normal');
{
  comprueba('dos trozos', unido('Empuje', '3 ejercicios') === `Empuje${SEPARADOR}3 ejercicios`);
  comprueba('uno solo, sin separador', unido('Empuje') === 'Empuje');
  comprueba('los números también valen', unido('Serie', 3) === `Serie${SEPARADOR}3`);
  comprueba('el cero es un dato, no un hueco', unido('Series', 0) === `Series${SEPARADOR}0`);
}

console.log('\nLas cuatro formas de que un dato no esté');
{
  comprueba('undefined', unido('A', undefined, 'B') === `A${SEPARADOR}B`);
  comprueba('null', unido('A', null, 'B') === `A${SEPARADOR}B`);
  comprueba('cadena vacía', unido('A', '', 'B') === `A${SEPARADOR}B`);
  comprueba('solo espacios', unido('A', '   ', 'B') === `A${SEPARADOR}B`);
  comprueba(
    'y el false de una condición sin cumplir',
    unido('A', false, 'B') === `A${SEPARADOR}B`
  );
}

console.log('\nLos casos que se veían en pantalla');
{
  // El de la tarjeta de hoy: sin etiqueta de ciclo salía "Días sueltos ·  · Int".
  comprueba(
    'sin etiqueta de ciclo no queda punto colgando',
    unido('Días sueltos', undefined, 'Int. 7/10') === `Días sueltos${SEPARADOR}Int. 7/10`
  );
  // El del resumen del entreno: terminaba en "Bloque de fuerza · ".
  comprueba(
    'sin día no termina en separador',
    unido('Bloque de fuerza', undefined) === 'Bloque de fuerza'
  );
  comprueba('sin nada, cadena vacía', unido() === '');
  comprueba('todo vacío, cadena vacía', unido(null, undefined, '', false) === '');
  comprueba(
    'solo el del medio falta',
    unido('A', null, 'C') === `A${SEPARADOR}C`
  );
}

console.log('\nLos espacios de los bordes no cuentan');
{
  comprueba('se recortan', unido('  A  ', ' B ') === `A${SEPARADOR}B`);
  comprueba('pero los de dentro no', unido('Muscle up', 'Front lever') === `Muscle up${SEPARADOR}Front lever`);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
