/**
 * Varias rutinas en un mismo entreno (lib/combinarRutinas.ts).
 *
 * Lo que se protege:
 *  - Sin decir nada el entrenador, van una detrás de otra (lo de siempre).
 *  - En superseries, el bloque 1 de una con el bloque 1 de la otra, y así; el
 *    orden es el que marcó el alumno, y lo que sobra va solo.
 *  - Una superserie que ya traía una rutina no se parte.
 *  - Tras la ronda se descansa lo que pida el más largo.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-combinar.mjs
 */
import { readFileSync } from 'node:fs';
import { combinarRutinas, comoSeCombinan, rondasDeLaCombinacion } from '../lib/combinarRutinas.ts';
import { bloqueDe, descansoDelBloque, esSuperserie } from '../lib/superserie.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const ej = (name, extra = {}) => ({ id: name, exerciseId: name, name, sets: 3, reps: '8', restSeconds: 90, ...extra });
const empuje = { exercises: [ej('Flexiones', { restSeconds: 120 }), ej('Fondos'), ej('Pike')] };
const tiron = { exercises: [ej('Dominadas', { restSeconds: 150, supersetWithPrevious: true }), ej('Remo')] };
const nombres = (lista) => lista.map((e) => `${e.supersetWithPrevious ? '+' : ''}${e.name}`).join(' ');

console.log('\nLo decide el entrenador');
ok('sin decir nada, una detrás de otra', comoSeCombinan(undefined) === 'seguidas' && comoSeCombinan({}) === 'seguidas');
ok('y en superseries si lo elige', comoSeCombinan({ combinar: 'superseries' }) === 'superseries');

console.log('\nUna detrás de otra');
{
  const r = combinarRutinas([empuje, tiron], 'seguidas');
  ok('todas, en orden', nombres(r) === 'Flexiones Fondos Pike Dominadas Remo', nombres(r));
  ok('la segunda rutina empieza suelta (no se encadena con la primera)', r[3].supersetWithPrevious === false);
}

console.log('\nEn superseries');
{
  const r = combinarRutinas([empuje, tiron], 'superseries');
  ok('empuje 1 + tirón 1, empuje 2 + tirón 2, y el que sobra solo', nombres(r) === 'Flexiones +Dominadas Fondos +Remo Pike', nombres(r));
  const alReves = combinarRutinas([tiron, empuje], 'superseries');
  ok('marcando el tirón primero, empieza el tirón', nombres(alReves) === 'Dominadas +Flexiones Remo +Fondos Pike', nombres(alReves));
  const b = bloqueDe(r, 0);
  ok('la pantalla del entreno lo lee como superserie', esSuperserie(b) && b.fin === 1);
  ok('el que sobra va solo', !esSuperserie(bloqueDe(r, 4)));
  ok('tras la ronda, el descanso más largo (2,5 min)', descansoDelBloque(r, bloqueDe(r, 0)) === 150);
  ok('sin tocar las rutinas del entrenador', empuje.exercises[0].supersetWithPrevious === undefined && tiron.exercises[1].restSeconds === 90);
  ok('lo que se enseña antes de empezar', JSON.stringify(rondasDeLaCombinacion(r)) === JSON.stringify([['Flexiones', 'Dominadas'], ['Fondos', 'Remo'], ['Pike']]));
}

console.log('\nUna superserie que ya venía en la rutina');
{
  const conSuya = { exercises: [ej('Flexiones'), ej('Fondos', { supersetWithPrevious: true }), ej('Pike')] };
  const r = combinarRutinas([conSuya, tiron], 'superseries');
  ok('no se parte: Flexiones + Fondos + Dominadas', nombres(r) === 'Flexiones +Fondos +Dominadas Pike +Remo', nombres(r));
}

console.log('\nTres rutinas');
{
  const piernas = { exercises: [ej('Sentadilla')] };
  const r = combinarRutinas([empuje, tiron, piernas], 'superseries');
  ok('una de cada en la primera ronda', nombres(r).startsWith('Flexiones +Dominadas +Sentadilla Fondos +Remo'), nombres(r));
}

console.log('\nPantallas');
{
  const entreno = readFileSync('app/(client)/workout.tsx', 'utf8');
  ok('el entreno combina con lo que decidió el entrenador', /combinarRutinas\(chosen, modoCombinar\)/.test(entreno));
  ok('y enseña cómo queda antes de empezar', /rondasDeLaCombinacion\(/.test(entreno));
  ok('el entrenador lo elige en su plan', /cambiaPerso\(\{ combinar:/.test(readFileSync('app/(trainer)/clients/[id]/routine.tsx', 'utf8')));
}

console.log(fallos === 0 ? '\n✔ Las rutinas se combinan como dice el entrenador' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
