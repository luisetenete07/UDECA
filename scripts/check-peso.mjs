/*
 * El peso, ya dentro de nutrición (lib/peso.ts).
 *
 * Lo que hay que proteger: que las variaciones digan la verdad. "Has bajado
 * 2 kg esta semana" es una frase que cambia lo que alguien come al día
 * siguiente; sacarla de una cuenta mal hecha —comparando contra el primer
 * registro de hace un año, o inventándose un cero cuando no hay con qué
 * comparar— es peor que no decir nada.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-peso.mjs
 */
import {
  conSigno,
  kgCorto,
  pesoDeTexto,
  resumenDePeso,
  textoDelObjetivo,
} from '../lib/peso.ts';
import { masDias } from '../lib/fechas.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const AHORA = Date.parse('2026-08-12T10:00:00Z');
const log = (dias, kg) => ({ id: `l${dias}-${kg}`, date: masDias(AHORA, -dias), weightKg: kg });

console.log('\nUn peso escrito a mano');
{
  comprueba('con punto', pesoDeTexto('66.4') === 66.4);
  comprueba('con coma, que es como se teclea', pesoDeTexto('66,4') === 66.4);
  comprueba('entero', pesoDeTexto('70') === 70);
  comprueba('con espacios', pesoDeTexto('  72,5 ') === 72.5);
  comprueba('se queda en un decimal', pesoDeTexto('66,47') === 66.5);

  comprueba('vacío no', pesoDeTexto('') === undefined);
  comprueba('texto no', pesoDeTexto('bastante') === undefined);
  comprueba('cero no', pesoDeTexto('0') === undefined);
  comprueba('negativo no', pesoDeTexto('-70') === undefined);
  // Un dedo torpe deforma la gráfica de meses enteros.
  comprueba('7 kg no es un peso', pesoDeTexto('7') === undefined);
  comprueba('700 tampoco', pesoDeTexto('700') === undefined);
}

console.log('\nCómo va el peso');
{
  const logs = [log(90, 82), log(30, 78), log(7, 76), log(0, 75)];
  const r = resumenDePeso(logs, undefined, AHORA);
  comprueba('el actual es el último', r.actual === 75);
  comprueba('esta semana, contra el de hace una semana', r.semana === -1, String(r.semana));
  comprueba('este mes, contra el de hace un mes', r.mes === -3, String(r.mes));

  // El orden de la lista no puede cambiar el resultado: llega como llegue.
  const revuelto = [log(0, 75), log(90, 82), log(7, 76), log(30, 78)];
  const r2 = resumenDePeso(revuelto, undefined, AHORA);
  comprueba('da igual el orden en que lleguen', r2.actual === 75 && r2.semana === -1 && r2.mes === -3);

  // Subir también se cuenta, y con su signo.
  const subiendo = resumenDePeso([log(7, 70), log(0, 71.5)], undefined, AHORA);
  comprueba('subir sale en positivo', subiendo.semana === 1.5, String(subiendo.semana));
}

console.log('\nCuando no hay con qué comparar');
{
  const nuevo = resumenDePeso([log(0, 75)], undefined, AHORA);
  comprueba('con un solo registro hay peso', nuevo.actual === 75);
  // Decir "0 kg esta semana" sería inventarse una semana que no existe.
  comprueba('pero no hay variación semanal', nuevo.semana === undefined);
  comprueba('ni mensual', nuevo.mes === undefined);

  // Con dos días apuntados, la semana y el mes dan el mismo número, y está
  // bien: es el cambio en todo lo que se sabe. Callarlo hasta tener un mes
  // entero dejaría en blanco justo los días en que más se mira.
  const dosDias = resumenDePeso([log(2, 76), log(0, 75)], undefined, AHORA);
  comprueba('con dos días sí hay semana', dosDias.semana === -1, String(dosDias.semana));
  comprueba('y el mes dice lo mismo', dosDias.mes === -1, String(dosDias.mes));

  // Pero si el único peso anterior es de hace dos meses, esta semana NO se
  // sabe: decir que ha bajado 5 kg en siete días sería mentir.
  const viejo = resumenDePeso([log(45, 80), log(0, 75)], undefined, AHORA);
  comprueba('sin nada reciente, no hay semana', viejo.semana === undefined, String(viejo.semana));
  comprueba('pero el mes sí sale', viejo.mes === -5, String(viejo.mes));

  const vacio = resumenDePeso([], undefined, AHORA);
  comprueba('sin registros, sin nada', vacio.actual === undefined && !vacio.enObjetivo);
}

console.log('\nEl objetivo');
{
  const bajando = resumenDePeso([log(30, 80), log(0, 78)], 75, AHORA);
  comprueba('dice cuánto falta', bajando.aObjetivo === -3, String(bajando.aObjetivo));
  comprueba('y que aún no está', !bajando.enObjetivo);
  comprueba('lo cuenta en una frase', /3,0 kg/.test(textoDelObjetivo(bajando, 75) ?? ''),
    String(textoDelObjetivo(bajando, 75)));
  // "Te faltan 3 kg" pesando 78 con objetivo 75 se lee como que hay que
  // ganarlos, que es lo contrario de lo que quiere esa persona. El verbo lo
  // resuelve sin gastar una línea.
  comprueba('y dice si hay que PERDERLOS', /faltan perder/.test(textoDelObjetivo(bajando, 75) ?? ''),
    String(textoDelObjetivo(bajando, 75)));

  const subiendo = resumenDePeso([log(0, 70)], 75, AHORA);
  comprueba('subir de peso también es un objetivo', subiendo.aObjetivo === 5);
  comprueba('y ahí dice GANAR', /faltan ganar/.test(textoDelObjetivo(subiendo, 75) ?? ''),
    String(textoDelObjetivo(subiendo, 75)));

  // Medio kilo de margen: el peso baila eso entre la mañana y la noche.
  const casi = resumenDePeso([log(0, 75.3)], 75, AHORA);
  comprueba('a 300 gramos ya está en su objetivo', casi.enObjetivo, String(casi.aObjetivo));
  comprueba('y se le dice', /Estás en tu objetivo/.test(textoDelObjetivo(casi, 75) ?? ''));

  const lejos = resumenDePeso([log(0, 76)], 75, AHORA);
  comprueba('a un kilo, todavía no', !lejos.enObjetivo);

  // Sin objetivo no se le empuja a ponerse uno: hay quien solo vigila.
  const sinObjetivo = resumenDePeso([log(0, 75)], undefined, AHORA);
  comprueba('sin objetivo no se dice nada', textoDelObjetivo(sinObjetivo, undefined) === null);
  comprueba('un objetivo a cero es no tenerlo', resumenDePeso([log(0, 75)], 0, AHORA).aObjetivo === undefined);
}

console.log('\nCómo se escribe');
{
  comprueba('con coma, como en español', kgCorto(66.4) === '66,4');
  comprueba('un entero sin decimales de adorno', kgCorto(70) === '70');
  comprueba('se redondea a un decimal', kgCorto(66.47) === '66,5');

  comprueba('bajar lleva su menos', conSigno(-1.2) === '-1,2 kg');
  comprueba('subir lleva su más', conSigno(0.4) === '+0,4 kg');
  comprueba('sin cambio, ni uno ni otro', conSigno(0) === '0,0 kg');
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
