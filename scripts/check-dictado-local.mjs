/**
 * Entender un entreno dictado, sin IA y sin servidor.
 *
 * Estas comprobaciones son el contrato del parser: si mañana alguien lo toca,
 * lo que NO puede pasar es que apunte series que nadie hizo. Apuntar de menos
 * se corrige en pantalla en diez segundos; apuntar de más ensucia el histórico
 * y las marcas, y eso ya no se ve venir.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-dictado-local.mjs
 */
import { entiendeDictado, aNumeros, normaliza, seriesDe } from '../lib/dictadoLocal.ts';
import { limpiaDictado, resumenDelDictado, cuantasSeries } from '../lib/dictado.ts';
import { setIdioma } from '../lib/idioma.ts';

setIdioma('es');

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

/** El catálogo de alguien de verdad: unos con peso, otros no, otros por tiempo. */
const CATALOGO = [
  { id: 'dom', nombre: 'Dominadas', medida: 'reps', carga: 'weighted' },
  { id: 'fon', nombre: 'Fondos', medida: 'reps', carga: 'weighted' },
  { id: 'flex', nombre: 'Flexiones', medida: 'reps', carga: 'none' },
  { id: 'fl', nombre: 'Front lever', medida: 'seconds', carga: 'none' },
  { id: 'flp', nombre: 'Front lever press', medida: 'reps', carga: 'none' },
  { id: 'sent', nombre: 'Sentadilla búlgara', medida: 'reps', carga: 'weighted' },
];

/** Lo entendido, ya pasado por la misma validación que usaba la IA. */
const entiende = (texto) => limpiaDictado(entiendeDictado(texto, CATALOGO), CATALOGO);
const marcasDe = (d, id) =>
  (d.ejercicios.find((e) => e.id === id)?.series ?? []).map((s) => s.marca).join(',');

console.log('\nLos números se dicen con letras');
ok('cuatro → 4', aNumeros(normaliza('cuatro')) === '4');
ok('treinta y cinco → 35', aNumeros(normaliza('treinta y cinco')) === '35');
ok('cuarenta y dos → 42', aNumeros(normaliza('cuarenta y dos')) === '42');
ok('y el "y" de una lista no une', aNumeros(normaliza('ocho y siete')) === '8 y 7');
ok('en inglés también', aNumeros(normaliza('twelve')) === '12');

console.log('\nUna lista de series es una serie por número');
ok('ocho, siete, seis y cinco', seriesDe(' 8, 7, 6 y 5').join(',') === '8,7,6,5');

console.log('\nY "3 de 8" son TRES series de ocho, no dos series');
ok('3 de 8', seriesDe(' 3 de 8').join(',') === '8,8,8');
ok('3x8', seriesDe(' 3x8').join(',') === '8,8,8');
ok('cuatro series de diez', seriesDe(aNumeros(' cuatro series de diez')).join(',') === '10,10,10,10');

console.log('\nEl dictado de ejemplo, entero');
{
  const d = entiende(
    'Cuatro series de dominadas: ocho, siete, seis y cinco. ' +
      'Fondos con diez kilos, tres de ocho. Duró unos cuarenta minutos.'
  );
  ok('saca los dos ejercicios', d.ejercicios.length === 2, JSON.stringify(d.ejercicios));
  ok('las dominadas, una serie por número', marcasDe(d, 'dom') === '8,7,6,5', marcasDe(d, 'dom'));
  ok('los fondos, tres series de ocho', marcasDe(d, 'fon') === '8,8,8', marcasDe(d, 'fon'));
  const fondos = d.ejercicios.find((e) => e.id === 'fon');
  ok('con sus diez kilos en cada una', fondos?.series.every((s) => s.peso === '10'));
  ok('y la duración no se cuela como serie', d.duracionMin === 40, String(d.duracionMin));
  ok('en total, siete series', cuantasSeries(d) === 7, String(cuantasSeries(d)));
}

console.log('\nLo que se dice sin florituras también vale');
{
  const d = entiende('dominadas 10 8 6, flexiones 20 20');
  ok('dominadas', marcasDe(d, 'dom') === '10,8,6');
  ok('flexiones', marcasDe(d, 'flex') === '20,20');
}

console.log('\nDos ejercicios que empiezan igual no se confunden');
{
  const d = entiende('front lever press 5, 4 y 3');
  ok('gana el nombre largo', d.ejercicios[0]?.id === 'flp', JSON.stringify(d.ejercicios));
  ok('y no aparece el corto', !d.ejercicios.some((e) => e.id === 'fl'));
}
{
  const d = entiende('front lever 20 segundos');
  ok('y el corto sigue saliendo cuando toca', d.ejercicios[0]?.id === 'fl');
}

console.log('\nEl peso solo donde el ejercicio lleva peso');
{
  const d = entiende('flexiones con 20 kilos, 3 de 10');
  ok('a las flexiones no se les cuelgan kilos', marcasDe(d, 'flex') === '10,10,10');
  ok('y el peso queda vacío', d.ejercicios[0]?.series.every((s) => s.peso === ''));
}

console.log('\nDe qué día habla');
ok('ayer', entiende('ayer hice flexiones 20').haceDias === 1);
ok('anteayer', entiende('anteayer flexiones 20').haceDias === 2);
ok('hace 3 días', entiende('hace 3 dias flexiones 20').haceDias === 3);
ok('hoy', entiende('hoy flexiones 20').haceDias === 0);
ok('si no lo dice, no se inventa', entiende('flexiones 20').haceDias === undefined);
ok(
  'y "hace 3 días" no es una serie de 3',
  marcasDe(entiende('hace 3 dias flexiones 20'), 'flex') === '20'
);

console.log('\nAnte la duda, NO inventa');
{
  const d = entiende('hice muscle ups a saco y luego un poco de cardio');
  ok('un ejercicio que no tiene no se apunta', d.ejercicios.length === 0);
  ok('pero se le dice lo que no se entendió', d.sinIdentificar.length > 0, JSON.stringify(d.sinIdentificar));
}
{
  const d = entiende('dominadas');
  ok('un ejercicio sin números no se apunta', d.ejercicios.length === 0);
}
ok('sin texto, nada', entiende('').ejercicios.length === 0);
ok('y no revienta', entiende('....').ejercicios.length === 0);

console.log('\nLos topes de sensatez siguen puestos');
{
  const d = entiende('flexiones 99999');
  ok('una marca imposible no entra', d.ejercicios.length === 0, JSON.stringify(d.ejercicios));
}
{
  const d = entiende('dominadas con 900 kilos, 3 de 5');
  ok('un peso imposible se ignora', d.ejercicios[0]?.series[0]?.peso === '', JSON.stringify(d.ejercicios[0]?.series[0]));
  ok('pero las series se quedan', marcasDe(d, 'dom') === '5,5,5');
}

console.log('\nY lo entendido se puede leer antes de guardar');
{
  const d = entiende('dominadas 8, 7. front lever 20');
  const lineas = resumenDelDictado(d, CATALOGO);
  ok('una línea por ejercicio', lineas.length === 2, JSON.stringify(lineas));
  ok('con el aguante en segundos', lineas.some((l) => l.includes('20s')), JSON.stringify(lineas));
}

console.log('\nEn inglés');
{
  const d = entiende('four sets of ten flexiones, front lever 20 seconds');
  ok('entiende los números en letra', marcasDe(d, 'flex').length > 0, JSON.stringify(d.ejercicios));
}

console.log(fallos === 0 ? '\n✔ El dictado se entiende sin IA' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
