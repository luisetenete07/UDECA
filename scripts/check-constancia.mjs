/*
 * La constancia, referida al bloque (lib/constancia.ts).
 *
 * Lo que se protege: que las dos mitades de la misma tarjeta hablen del MISMO
 * periodo. El reparto del trabajo dice "tu bloque en curso" y la cuadrícula
 * decía "doce semanas": dos periodos distintos pegados, que nadie compara
 * mentalmente y que por eso no se miraban. Si un día alguien vuelve a fijar
 * las semanas a mano, esto lo pilla.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-constancia.mjs
 */
import {
  MAX_SEMANAS,
  resumenDeConstancia,
  SEMANAS_SIN_BLOQUE,
  ventanaDeConstancia,
} from '../lib/constancia.ts';
import { inicioDeLaSemana, inicioDelDia, masDias } from '../lib/fechas.ts';
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
const HOY = new Date(2026, 7, 13, 12, 0, 0).getTime();

console.log('\nCon un bloque, la ventana es la del bloque');
{
  const bloque = {
    id: 'c', name: 'Acumulación', level: 'meso',
    startDate: HOY - 20 * DIA, endDate: HOY + 20 * DIA,
  };
  const v = ventanaDeConstancia(bloque, HOY);
  comprueba('lleva el nombre del bloque', v.titulo === 'Acumulación', v.titulo);
  comprueba('y se sabe que hay bloque', v.hayBloque);
  comprueba('empieza en el lunes de su primera semana',
    v.desde === inicioDeLaSemana(inicioDelDia(bloque.startDate)), String(new Date(v.desde)));
  // No se pinta el futuro: el bloque acaba dentro de 20 días y esos no son
  // días fallados, es que aún no han pasado.
  comprueba('no llega más allá de hoy', v.hasta === inicioDelDia(HOY), String(new Date(v.hasta)));
  comprueba('con las semanas justas', v.semanas >= 3 && v.semanas <= 5, String(v.semanas));
}

console.log('\nSin bloque, las mismas semanas que el reparto');
{
  const v = ventanaDeConstancia(null, HOY);
  comprueba(`son ${SEMANAS_SIN_BLOQUE} semanas`, v.semanas === SEMANAS_SIN_BLOQUE, String(v.semanas));
  comprueba('y se dice en el rótulo', /4 semanas/.test(v.titulo), v.titulo);
  comprueba('sin fingir que hay bloque', !v.hayBloque);
  comprueba('sin fecha de inicio, igual', ventanaDeConstancia({ id: 'x', name: 'Sin fecha' }, HOY).semanas === SEMANAS_SIN_BLOQUE);
}

console.log('\nUn bloque terminado no arrastra semanas que no son suyas');
{
  const viejo = {
    id: 'v', name: 'El de antes',
    startDate: HOY - 60 * DIA, endDate: HOY - 30 * DIA,
  };
  const v = ventanaDeConstancia(viejo, HOY);
  comprueba('acaba donde acabó él', v.hasta === inicioDelDia(viejo.endDate), String(new Date(v.hasta)));
  comprueba('y no llega hasta hoy', v.hasta < inicioDelDia(HOY));
}

console.log('\nUn macrociclo largo no rompe la cuadrícula');
{
  const macro = { id: 'm', name: 'Temporada', startDate: HOY - 300 * DIA, endDate: HOY + 60 * DIA };
  const v = ventanaDeConstancia(macro, HOY);
  // Con 43 columnas las celdas se quedan en un píxel y no se ve nada.
  comprueba('se corta en el tope', v.semanas === MAX_SEMANAS, String(v.semanas));
}

console.log('\nLa frase dice lo que la cuadrícula no');
{
  const bloque = { id: 'c', name: 'Bloque', startDate: HOY - 13 * DIA, endDate: HOY + 7 * DIA };
  const v = ventanaDeConstancia(bloque, HOY);

  const dias = new Set([HOY, HOY - 2 * DIA, HOY - 5 * DIA].map((d) => inicioDelDia(d)));
  const r = resumenDeConstancia(dias, v, HOY);
  comprueba('cuenta los entrenados', r.entrenados === 3, String(r.entrenados));
  comprueba('y los días que llevan pasados', r.transcurridos > 13, String(r.transcurridos));
  comprueba('nunca cuenta el futuro como fallado', r.transcurridos <= 21, String(r.transcurridos));
  comprueba('lo dice en cristiano', /3 días entrenados de \d+/.test(r.texto), r.texto);

  // Lo que hace levantarse del sofá y no sale en ninguna cuadrícula.
  const parado = resumenDeConstancia(new Set([inicioDelDia(HOY - 9 * DIA)]), v, HOY);
  comprueba('avisa si llevas días parado', /sin entrenar/.test(parado.texto), parado.texto);
  comprueba('y cuenta cuántos', parado.sinEntrenar === 9, String(parado.sinEntrenar));

  const ayer = resumenDeConstancia(new Set([inicioDelDia(masDias(HOY, -1))]), v, HOY);
  comprueba('un día de descanso no es un sermón', !/sin entrenar/.test(ayer.texto), ayer.texto);

  const vacio = resumenDeConstancia(new Set(), v, HOY);
  comprueba('sin nada, lo dice y no da un cero seco', /Aún no has entrenado en este bloque/.test(vacio.texto), vacio.texto);
  comprueba('y el ratio es cero', vacio.ratio === 0);
}

console.log('\nSin bloque también funciona');
{
  const v = ventanaDeConstancia(null, HOY);
  const r = resumenDeConstancia(new Set(), v, HOY);
  comprueba('habla de semanas, no de bloque', /estas semanas/.test(r.texto), r.texto);
  comprueba('sin dividir por cero', Number.isFinite(r.ratio));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
