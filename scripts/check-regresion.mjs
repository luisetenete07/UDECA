/*
 * Series en REGRESIÓN (LoggedSet.regresion, ver `cuentaComoMarca` en lib/types.ts).
 *
 * El alumno marca que una serie la hizo en una progresión más fácil, sin decir
 * cuál. Esas marcas son de otro ejercicio: no pueden ser récord, ni mover la
 * gráfica de progresión, ni cumplir un objetivo del ciclo, ni pedir que se suba
 * el objetivo. Sí se ven, marcadas, y el entrenador se entera.
 *
 * Lo que se vigila son los fallos que no dan error: un sitio que mide el
 * progreso y se olvida de la regresión celebra un retroceso como récord.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-regresion.mjs
 */
import { readFileSync } from 'node:fs';
import { cuentaComoMarca } from '../lib/types.ts';
import {
  bestsByExercise,
  detectNewPRs,
  exerciseProgression,
  exerciseSessions,
  lastPerformanceByExercise,
  textoDeSerieAnterior,
} from '../lib/stats.ts';
import { sugerenciaDeProgresion } from '../lib/progresion.ts';
import { mejorMarca } from '../lib/objetivosDeCiclo.ts';
import { cuentaDestacada, loQueDestaca } from '../lib/bandeja.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');

const DIA = 86_400_000;
const serie = (reps, extra = {}) => ({ reps: String(reps), weight: '', completed: true, ...extra });
const reg = (reps) => serie(reps, { regresion: true });
const entreno = (id, dias, sets) => ({
  id,
  trainerId: 't',
  clientId: 'c',
  routineId: 'r',
  routineName: 'R',
  dayName: 'Día',
  date: Date.now() - dias * DIA,
  createdAt: 0,
  exercises: [{ exerciseId: 'dom', name: 'Dominadas', sets, measure: 'reps' }],
});

console.log('\nQué cuenta como marca');
{
  ok('una serie hecha, sí', cuentaComoMarca({ completed: true }));
  ok('una sin hacer, no', !cuentaComoMarca({ completed: false }));
  ok('una en regresión, no', !cuentaComoMarca({ completed: true, regresion: true }));
}

console.log('\nNo hay récord en regresión');
{
  const antes = [entreno('a', 10, [serie(8), serie(7)])];
  const hoyReg = entreno('h', 0, [reg(12), reg(11)]).exercises;
  ok('12 en regresión no bate 8', detectNewPRs(antes, hoyReg).length === 0);
  const hoyMixto = entreno('h', 0, [serie(9), reg(15)]).exercises;
  const prs = detectNewPRs(antes, hoyMixto);
  ok('9 de verdad sí, y el récord es el 9 (no el 15)', prs.length === 1 && /9/.test(prs[0].label) && !/15/.test(prs[0].label));
  const bests = bestsByExercise([entreno('x', 1, [serie(6), reg(20)])]);
  ok('la mejor marca guardada no es la de regresión', bests.dom.bestReps === 6);
}

console.log('\nLa progresión es la del ejercicio');
{
  const logs = [entreno('a', 3, [serie(6)]), entreno('b', 2, [reg(10), reg(10)]), entreno('c', 1, [serie(7), reg(12)])];
  const p = exerciseProgression(logs, 'dom');
  ok('un día entero en regresión no es un punto (sería un cero)', p.points.length === 2);
  ok('y en un día mixto cuenta solo lo de verdad', p.points[1].reps === 7);
  const ses = exerciseSessions(logs, 'dom');
  ok('en el historial se ven, marcadas', ses.some((s) => s.sets.some((x) => x.regresion)));
  ok('"la última vez" salta los días en regresión', lastPerformanceByExercise([entreno('a', 3, [serie(6)]), entreno('b', 1, [reg(10)])]).dom.reps === '6');
  ok('y la serie de antes dice que fue en regresión', /regresión/.test(textoDeSerieAnterior(reg(10))));
}

console.log('\nNi objetivos ni sugerencias de subir');
{
  ok('un objetivo del ciclo no se cumple en regresión', mejorMarca([entreno('a', 1, [serie(5), reg(15)])], 'dom', 'reps') === 5);
  const plan = { exerciseId: 'dom', reps: '6-8', sets: 2, measure: 'reps' };
  const deSobra = [entreno('a', 2, [serie(8), serie(8)]), entreno('b', 1, [serie(8), serie(8)])];
  ok('llegando arriba de verdad, se sugiere subir', sugerenciaDeProgresion(deSobra, plan) !== null);
  const enReg = [entreno('a', 2, [reg(8), reg(8)]), entreno('b', 1, [reg(8), reg(8)])];
  ok('llegando arriba en regresión, no', sugerenciaDeProgresion(enReg, plan) === null);
}

console.log('\nEl entrenador se entera');
{
  const log = entreno('h', 0, [serie(6), reg(8)]);
  ok('se cuenta en "Por revisar"', cuentaDestacada(log, []).enRegresion === 1);
  ok('con su pastilla', loQueDestaca(log, []).some((d) => /regresión/.test(d.texto)));
  ok('y en la sesión, serie a serie (solo en las hechas)', /set\.completed && set\.regresion \?/.test(lee('app/(trainer)/clients/[id]/session.tsx')));
}

console.log('\nEl alumno la marca al apuntar');
{
  const fila = lee('components/FilaDeSerie.tsx');
  ok('la fila de la serie tiene el botón', /onRegresion\?: \(\) => void;/.test(fila) && /Regresión/.test(fila));
  ok('en la serie que toca y en las que ya la llevan', /const verRegresion = !!onRegresion && \(esAhora \|\| regresion\);/.test(fila));
  const entrenoTsx = lee('app/(client)/workout.tsx');
  ok('en series sueltas y en superseries', (entrenoTsx.match(/onRegresion=\{\(\) => alternarRegresion\(/g) ?? []).length === 2);
  ok('se pone también en las que quedan por hacer', /j !== serie && \(j < serie \|\| st\.completed\)/.test(entrenoTsx));
  ok('y al apuntar otro día, por ejercicio', /alternarRegresion/.test(lee('app/(client)/registrar.tsx')));
  ok('el historial no compara con lo hecho en regresión', /const deVerdad = sesiones\.filter/.test(lee('components/ExerciseHistory.tsx')));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
