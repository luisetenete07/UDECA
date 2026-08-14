/*
 * El cobro único: hasta una fecha y un importe (lib/billing.ts).
 *
 * El caso: un alumno paga 180 € por seis meses el primer día. Antes había que
 * apañarlo con "añadir N días" y luego acordarse de que ese importe no era la
 * cuota, así que el ingreso más grande del año era justo el peor apuntado.
 *
 * Lo que se protege aquí es que una fecha PASADA no entre: dejaría al alumno
 * pagado y vencido el mismo día, y el aviso de impago le saltaría a él, que
 * acaba de pagar.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-cobro-unico.mjs
 */
import {
  fechaDeTexto,
  importeDeTexto,
  mensajeDeCobroUnico,
  validaCobroUnico,
} from '../lib/billing.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés:
// sin fijarlo estas comprobaciones leerían el texto en inglés y el resultado
// dependería de dónde se ejecuten.
setIdioma('es');


let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const DIA = 86400000;
const HOY = new Date(2026, 7, 13, 15, 30, 0).getTime();

console.log('\nUn pago de seis meses');
{
  const seisMeses = new Date(2027, 1, 13).getTime();
  const r = validaCobroUnico(seisMeses, 180, HOY);
  comprueba('se acepta', r.ok);
  comprueba('la fecha queda a las 00:00', r.ok && new Date(r.cobro.hasta).getHours() === 0);
  comprueba('y el importe entero', r.ok && r.cobro.importe === 180, r.ok ? String(r.cobro.importe) : '');
  comprueba('los céntimos se respetan', validaCobroUnico(seisMeses, 179.99, HOY).cobro.importe === 179.99);
  comprueba('y no se arrastran decimales de coma flotante',
    validaCobroUnico(seisMeses, 0.1 + 0.2, HOY).cobro.importe === 0.3,
    String(validaCobroUnico(seisMeses, 0.1 + 0.2, HOY).cobro.importe));
}

console.log('\nLo que no puede pasar');
{
  // ESTE es el que hace daño: pagado y vencido el mismo día.
  const ayer = validaCobroUnico(HOY - DIA, 180, HOY);
  comprueba('una fecha pasada se rechaza', !ayer.ok && ayer.error === 'pasada');
  const hoyMismo = validaCobroUnico(HOY, 180, HOY);
  comprueba('hoy tampoco vale', !hoyMismo.ok && hoyMismo.error === 'pasada');
  comprueba('mañana sí', validaCobroUnico(HOY + DIA, 180, HOY).ok);

  comprueba('sin fecha, se dice', validaCobroUnico(undefined, 180, HOY).error === 'fecha');
  comprueba('sin importe, también', validaCobroUnico(HOY + 30 * DIA, undefined, HOY).error === 'importe');
  comprueba('un importe a cero no es un cobro', validaCobroUnico(HOY + 30 * DIA, 0, HOY).error === 'importe');
  comprueba('ni uno negativo', validaCobroUnico(HOY + 30 * DIA, -50, HOY).error === 'importe');
}

console.log('\nLos avisos se entienden');
{
  for (const e of ['fecha', 'pasada', 'importe']) {
    const m = mensajeDeCobroUnico(e);
    comprueba(`"${e}" tiene su frase`, m.length > 10 && !/error|undefined/i.test(m), m);
  }
}

console.log('\nLa fecha, escrita a mano');
{
  const d = fechaDeTexto('13/02/2027');
  comprueba('DD/MM/AAAA', d !== undefined && new Date(d).getDate() === 13 && new Date(d).getMonth() === 1,
    String(d && new Date(d)));
  comprueba('con guiones también', fechaDeTexto('13-02-2027') !== undefined);
  comprueba('un solo dígito vale', fechaDeTexto('3/2/2027') !== undefined);
  // El 31 de febrero existe para Date (sale 3 de marzo) y sería una fecha
  // silenciosamente equivocada.
  comprueba('el 31 de febrero no existe', fechaDeTexto('31/02/2027') === undefined);
  comprueba('ni el mes 13', fechaDeTexto('01/13/2027') === undefined);
  comprueba('ni un texto cualquiera', fechaDeTexto('seis meses') === undefined);
  comprueba('ni vacío', fechaDeTexto('') === undefined);
  comprueba('sale a las 00:00', new Date(fechaDeTexto('13/02/2027')).getHours() === 0);
}

console.log('\nEl importe, escrito a mano');
{
  comprueba('un entero', importeDeTexto('180') === 180);
  comprueba('con coma', importeDeTexto('180,50') === 180.5);
  comprueba('con punto', importeDeTexto('180.50') === 180.5);
  comprueba('con el euro pegado', importeDeTexto('180 €') === 180, String(importeDeTexto('180 €')));
  comprueba('vacío no', importeDeTexto('') === undefined);
  comprueba('cero no', importeDeTexto('0') === undefined);
  comprueba('un disparate no', importeDeTexto('999999999') === undefined);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
