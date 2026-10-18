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
import {
  ajustesDeFusion,
  combinarRutinas,
  comoSeCombinan,
  juntarTramos,
  ordenParaFusionar,
  primerasRondas,
  rondasDeLaCombinacion,
  segundosDeMinutos,
  textoDeDescanso,
} from '../lib/combinarRutinas.ts';
import { bloqueDe, descansoDelBloque, esSuperserie } from '../lib/superserie.ts';
import { POR_DEFECTO } from '../lib/planPersonalizado.ts';

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
ok('un plan nuevo no lo trae puesto', POR_DEFECTO.combinar === undefined && comoSeCombinan(POR_DEFECTO) === 'seguidas');
ok('un valor raro no fusiona', comoSeCombinan({ combinar: 'otra' }) === 'seguidas');

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
  ok(
    'lo que se enseña antes de empezar',
    JSON.stringify(rondasDeLaCombinacion(r).map((x) => x.nombres)) === JSON.stringify([['Flexiones', 'Dominadas'], ['Fondos', 'Remo'], ['Pike']])
  );
}

console.log('\nSerie a serie: planche (tuck ×6) con front (press ×2, hold ×2, dominadas ×2)');
{
  const planche = { exercises: [ej('Tuck', { sets: 6 })] };
  const front = { exercises: [ej('Press', { sets: 2 }), ej('Hold', { sets: 2 }), ej('Dominadas', { sets: 2 })] };
  const r = combinarRutinas([planche, front], 'superseries', { descanso: 360 });
  const rondas = primerasRondas(r, 99).map((x) => x.join('–'));
  ok(
    'tuck–press, tuck–press, tuck–hold, tuck–hold, tuck–dominadas, tuck–dominadas',
    JSON.stringify(rondas) === JSON.stringify(['Tuck–Press', 'Tuck–Press', 'Tuck–Hold', 'Tuck–Hold', 'Tuck–Dominadas', 'Tuck–Dominadas']),
    JSON.stringify(rondas)
  );
  ok('y no seis de tuck con dos de press', !r.some((e) => e.name === 'Tuck' && e.sets === 6));
  ok('el tuck va en tres tramos de 2, cada uno con su id', r.filter((e) => e.name === 'Tuck').map((e) => `${e.id}:${e.sets}`).join(' ') === 'Tuck:2 Tuck~2:2 Tuck~3:2');
  ok('cada tramo es una superserie en pantalla', esSuperserie(bloqueDe(r, 0)) && esSuperserie(bloqueDe(r, 2)) && esSuperserie(bloqueDe(r, 4)));
  ok('con el descanso de la fusión tras cada ronda', descansoDelBloque(r, bloqueDe(r, 2)) === 360);
  ok(
    'la vista previa: tres tramos ×2',
    JSON.stringify(rondasDeLaCombinacion(r).map((x) => `${x.nombres.join('+')}×${x.series}`)) === JSON.stringify(['Tuck+Press×2', 'Tuck+Hold×2', 'Tuck+Dominadas×2'])
  );
  const alReves = primerasRondas(combinarRutinas([front, planche], 'superseries'), 3).map((x) => x.join('–'));
  ok('al revés: press–tuck', alReves[0] === 'Press–Tuck' && alReves[2] === 'Hold–Tuck', JSON.stringify(alReves));
  const corta = { exercises: [ej('Press', { sets: 2 }), ej('Hold', { sets: 2 })] };
  const r2 = combinarRutinas([planche, corta], 'superseries');
  ok('si una se acaba, lo que queda de la otra va solo', rondasDeLaCombinacion(r2).map((x) => `${x.nombres.join('+')}×${x.series}`).join(' ') === 'Tuck+Press×2 Tuck+Hold×2 Tuck×2');
  // Al guardar, el tuck vuelve a ser una fila con sus 6 series, en orden.
  const log = r.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: Array.from({ length: e.sets }, (_, k) => ({ reps: `${e.id}-${k}`, completed: true })) }));
  const guardado = juntarTramos(log, r);
  ok('al guardar: tuck ×6, press ×2, hold ×2, dominadas ×2', guardado.map((e) => `${e.name}×${e.sets.length}`).join(' ') === 'Tuck×6 Press×2 Hold×2 Dominadas×2', guardado.map((e) => `${e.name}×${e.sets.length}`).join(' '));
  ok('con las series en el orden en que se hicieron', guardado[0].sets.map((x) => x.reps).join(',') === 'Tuck-0,Tuck-1,Tuck~2-0,Tuck~2-1,Tuck~3-0,Tuck~3-1');
  const dosVeces = [{ id: 'a' }, { id: 'b' }];
  ok('un ejercicio puesto dos veces a propósito sigue siendo dos', juntarTramos([{ exerciseId: 'x', name: 'X', sets: [] }, { exerciseId: 'x', name: 'X', sets: [] }], dosVeces).length === 2);
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

console.log('\nLos tiempos del entrenador');
{
  const r = combinarRutinas([empuje, tiron], 'superseries', { descanso: 360, transicion: 30 });
  ok('tras cada superserie, sus 6 minutos', descansoDelBloque(r, bloqueDe(r, 0)) === 360 && descansoDelBloque(r, bloqueDe(r, 2)) === 360);
  ok('entre un ejercicio y otro, sus 30 s', r[1].transicionSegundos === 30 && r[0].transicionSegundos === undefined);
  ok('sin decir nada, seguido', combinarRutinas([empuje, tiron], 'superseries')[1].transicionSegundos === undefined);
  ok('ajustes limpios: un cero no es un tiempo', JSON.stringify(ajustesDeFusion({ descansoFusion: 0, transicionFusion: -5 })) === '{}');
  ok('se leen del plan', ajustesDeFusion({ descansoFusion: 360, transicionFusion: 15 }).descanso === 360);
  ok('"6" son 6 min, "2:30" y "2,5" son 150 s', segundosDeMinutos('6') === 360 && segundosDeMinutos('2:30') === 150 && segundosDeMinutos('2,5') === 150);
  ok('lo vacío o raro no vale', segundosDeMinutos('') === undefined && segundosDeMinutos('abc') === undefined && segundosDeMinutos('0') === undefined);
  ok('se escribe como lo diría', textoDeDescanso(360) === '6 min' && textoDeDescanso(150) === '2:30 min' && textoDeDescanso(30) === '30 s');
}

console.log('\nEjercicios aislados (la parte de hipertrofia)');
{
  const skillsA = { exercises: [ej('Plancha'), ej('Pino'), ej('Curl', { aislado: true, restSeconds: 60 }), ej('Press', { aislado: true, restSeconds: 75 })] };
  const skillsB = { exercises: [ej('Front'), ej('Muscle up'), ej('Remo', { aislado: true, restSeconds: 60 })] };
  const r = combinarRutinas([skillsA, skillsB], 'superseries', { descanso: 360 });
  ok('las skills fusionadas y la hipertrofia después, cada una sola', nombres(r) === 'Plancha +Front Pino +Muscle up Curl Press Remo', nombres(r));
  const curl = r.findIndex((e) => e.name === 'Curl');
  ok('el aislado no va en superserie', !esSuperserie(bloqueDe(r, curl)));
  ok('y descansa lo suyo, no los 6 minutos', descansoDelBloque(r, bloqueDe(r, curl)) === 60);
  ok('la vista previa lo dice', rondasDeLaCombinacion(r).filter((x) => x.aislado).length === 3);
  const conCalentamiento = { exercises: [ej('Movilidad', { aislado: true }), ej('Plancha')] };
  const r2 = combinarRutinas([conCalentamiento, { exercises: [ej('Front')] }], 'superseries');
  ok('un aislado al principio de su rutina va antes de las superseries', nombres(r2) === 'Movilidad Plancha +Front', nombres(r2));
  ok('una detrás de otra no cambia nada', nombres(combinarRutinas([skillsA, skillsB], 'seguidas')) === 'Plancha Pino Curl Press Front Muscle up Remo');
}

console.log('\nQué rutina va primero');
{
  const A = { id: 'a' }, B = { id: 'b' };
  ok('la que marque el alumno', ordenParaFusionar([B, A], [A, B], undefined)[0] === B);
  ok('o la de más arriba en el plan, si lo decide el entrenador', ordenParaFusionar([B, A], [A, B], 'plan')[0] === A);
}

console.log('\nPantallas');
{
  const entreno = readFileSync('app/(client)/workout.tsx', 'utf8');
  ok('el entreno combina con lo que decidió el entrenador', /combinarRutinas\(chosen, modoCombinar, fusion\)/.test(entreno));
  ok('y al guardar junta los tramos', /juntarTramos\(baseLog, day\.exercises\)/.test(entreno));
  ok('y enseña cómo queda antes de empezar', /rondasDeLaCombinacion\(/.test(entreno));
  const editor = readFileSync('app/(trainer)/clients/[id]/routine.tsx', 'utf8');
  ok('el entrenador lo elige en su plan', /cambiaPerso\(\{ combinar:/.test(editor));
  ok('y sus tiempos, su orden y qué va aislado', /descansoFusion:/.test(editor) && /transicionFusion:/.test(editor) && /ordenFusion:/.test(editor) && /setAislado\(/.test(editor));
  ok('el entreno usa sus tiempos', /combinarRutinas\(chosen, modoCombinar, fusion\)/.test(entreno) && /transicionSegundos/.test(entreno));
  // Solo lo decide el entrenador: el alumno lo lee de su plan y no tiene con
  // qué cambiarlo, y la vista previa en superseries solo sale si es lo que hay.
  ok('el alumno no lo puede cambiar', /const modoCombinar = comoSeCombinan\(perso\)/.test(entreno) && !/combinar:/.test(entreno));
  ok('la vista de superseries, solo si el plan lo dice', /modoCombinar === 'superseries' \? \(\s*<>/.test(entreno));
}

console.log(fallos === 0 ? '\n✔ Las rutinas se combinan como dice el entrenador' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
