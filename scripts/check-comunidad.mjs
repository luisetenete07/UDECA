/*
 * Cómo se llama la comunidad (lib/comunidad.ts).
 *
 * Lo que se protege: que la app no le ponga su propia marca por delante al
 * entrenador que cobra, y que un nombre raro (vacío, con espacios de más, de
 * una sola palabra) no deje un rótulo roto tipo "Comunidad ".
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-comunidad.mjs
 */
import { COMUNIDAD_SIN_NOMBRE, tituloDeComunidad } from '../lib/comunidad.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nEl nombre del entrenador manda');
{
  comprueba('usa el nombre de pila', tituloDeComunidad('Luis Tena') === 'Comunidad Luis',
    tituloDeComunidad('Luis Tena'));
  comprueba('con un solo nombre, igual', tituloDeComunidad('Marta') === 'Comunidad Marta');
  comprueba('los espacios de más no cuentan', tituloDeComunidad('  Luis   Tena  ') === 'Comunidad Luis',
    tituloDeComunidad('  Luis   Tena  '));
}

console.log('\nSin nombre, nada roto');
{
  comprueba('vacío', tituloDeComunidad('') === COMUNIDAD_SIN_NOMBRE);
  comprueba('solo espacios', tituloDeComunidad('   ') === COMUNIDAD_SIN_NOMBRE,
    tituloDeComunidad('   '));
  comprueba('sin dato', tituloDeComunidad(undefined) === COMUNIDAD_SIN_NOMBRE);
  comprueba('nulo', tituloDeComunidad(null) === COMUNIDAD_SIN_NOMBRE);
  comprueba('y nunca queda "Comunidad " a medias', !/Comunidad\s*$/.test(tituloDeComunidad('')));
}

console.log('\nLa marca de la app no se cuela');
{
  comprueba('no dice UDECA con entrenador', !/UDECA/i.test(tituloDeComunidad('Luis Tena')));
  comprueba('ni sin él', !/UDECA/i.test(tituloDeComunidad('')));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
