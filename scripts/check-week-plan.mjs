/*
 * Comprobación de la programación por semanas (lib/weekPlan.ts).
 *
 * Es lo que el alumno ve al entrenar, así que un fallo aquí no se queda en una
 * pantalla fea: le hace hacer otras series de las que le tocan.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-week-plan.mjs
 */
import {
  applyWeekPlan,
  currentWeekCycle,
  exerciseNames,
  semanaAnterior,
  weekPlanDraft,
  weekSetsByGroup,
} from '../lib/weekPlan.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés:
// sin fijarlo estas comprobaciones leerían el texto en inglés y el resultado
// dependería de dónde se ejecuten.
setIdioma('es');


const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const lunesDe = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

const AHORA = new Date(2026, 7, 5, 10, 0, 0).getTime(); // miércoles
const L0 = lunesDe(AHORA) - 2 * WEEK;

const routine = {
  id: 'r1', trainerId: 't', clientId: 'a', name: 'Fuerza', active: true,
  schedule: 'weekly', createdAt: 0, updatedAt: 0,
  days: [
    {
      id: 'd1', name: 'Empuje', weekday: 0,
      exercises: [
        { id: 'x1', exerciseId: 'fon', name: 'Fondos', sets: 4, reps: '8', rir: 2, muscleGroup: 'Empuje' },
        { id: 'x2', exerciseId: 'fle', name: 'Flexiones', sets: 3, reps: '10', muscleGroup: 'Empuje' },
      ],
    },
    {
      id: 'd2', name: 'Tirón', weekday: 2,
      exercises: [
        { id: 'x3', exerciseId: 'dom', name: 'Dominadas', sets: 4, reps: '6', muscleGroup: 'Tirón' },
      ],
    },
    { id: 'd3', name: 'Descanso', isRest: true, exercises: [] },
  ],
};

const semanas = [0, 1, 2].map((i) => ({
  id: `w${i}`, trainerId: 't', clientId: 'a', level: 'micro', name: `Semana ${i + 1}`,
  parentId: 'm1', orderIndex: i + 1,
  startDate: L0 + i * WEEK, endDate: L0 + i * WEEK + 6 * DAY,
  createdAt: 0, updatedAt: 0,
}));

console.log('\n1) Qué semana toca');
comprueba('la de hoy es la tercera', currentWeekCycle(semanas, AHORA)?.id === 'w2');
comprueba('sin ciclos no hay semana', currentWeekCycle([], AHORA) === null);
comprueba('la anterior a la tercera es la segunda', semanaAnterior(semanas, semanas[2])?.id === 'w1');
comprueba('la primera no tiene anterior', semanaAnterior(semanas, semanas[0]) === null);

console.log('\n2) Aplicar la programación a la rutina');
const conPlan = semanas.map((w) =>
  w.id === 'w2' ? { ...w, weekPlan: [{ exerciseId: 'fon', sets: 6, reps: '5', rir: 0 }] } : w
);
const aplicada = applyWeekPlan(routine, conPlan, AHORA);
const fondos = aplicada.days[0].exercises[0];
const flexiones = aplicada.days[0].exercises[1];

comprueba('los fondos pasan a 6 series', fondos.sets === 6);
comprueba('y a 5 repeticiones', fondos.reps === '5');
comprueba('y al fallo', fondos.rir === 0);
comprueba('lo que no se tocó se queda igual', flexiones.sets === 3 && flexiones.reps === '10');
comprueba('la rutina original NO se modifica', routine.days[0].exercises[0].sets === 4);
comprueba(
  'sin programación devuelve la misma rutina, sin copiarla',
  applyWeekPlan(routine, semanas, AHORA) === routine
);
comprueba('sin rutina no revienta', applyWeekPlan(null, conPlan, AHORA) === null);
comprueba(
  'la semana pasada no afecta a la de hoy',
  applyWeekPlan(
    routine,
    semanas.map((w) => (w.id === 'w0' ? { ...w, weekPlan: [{ exerciseId: 'fon', sets: 9 }] } : w)),
    AHORA
  ).days[0].exercises[0].sets === 4
);

console.log('\n3) Duplicar y ajustar');
const borradorPrimera = weekPlanDraft(routine, semanas, semanas[0]);
comprueba('la primera semana parte de la rutina', borradorPrimera.length === 3);
comprueba(
  'con sus números',
  borradorPrimera.find((e) => e.exerciseId === 'fon').sets === 4 &&
    borradorPrimera.find((e) => e.exerciseId === 'fon').rir === 2
);

const borradorTercera = weekPlanDraft(routine, conPlan.map((w) =>
  w.id === 'w1' ? { ...w, weekPlan: [{ exerciseId: 'fon', sets: 5, reps: '6' }] } : w
), semanas[2]);
comprueba(
  'la tercera parte de lo que se puso en la segunda',
  borradorTercera.find((e) => e.exerciseId === 'fon').sets === 5,
  String(borradorTercera.find((e) => e.exerciseId === 'fon').sets)
);
comprueba(
  'y para lo que no se programó, de la rutina',
  borradorTercera.find((e) => e.exerciseId === 'dom').sets === 4
);
comprueba('el descanso no aporta ejercicios', borradorPrimera.every((e) => e.exerciseId !== ''));
comprueba('los nombres salen de la rutina', exerciseNames(routine).get('dom') === 'Dominadas');

console.log('\n4) Series por grupo de una semana programada');
const exactas = weekSetsByGroup(conPlan[2], routine, {});
comprueba('Empuje: 6 de fondos + 3 de flexiones', exactas.Empuje === 9, String(exactas?.Empuje));
comprueba('Tirón: los 4 de la rutina', exactas['Tirón'] === 4);
comprueba('sin programación devuelve null', weekSetsByGroup(semanas[2], routine, {}) === null);

console.log(fallos === 0 ? '\nTodo correcto ✔\n' : `\n${fallos} fallo(s) ✖\n`);
process.exit(fallos === 0 ? 0 : 1);
