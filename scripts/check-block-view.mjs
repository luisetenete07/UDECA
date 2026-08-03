/*
 * Comprobación de la vista del bloque (lib/blockView.ts): volumen previsto,
 * volumen hecho, frecuencia y avisos.
 *
 * Los avisos son lo delicado: uno que un entrenador serio considere una
 * tontería quema la confianza en todos los demás, así que aquí se comprueba
 * tanto que salgan cuando deben como que NO salgan cuando no deben.
 *
 *   node --experimental-strip-types scripts/check-block-view.mjs
 */
import { buildBlockView } from '../lib/blockView.ts';

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
const L0 = lunesDe(AHORA) - 3 * WEEK; // lunes de hace 3 semanas

// Biblioteca: qué grupo y qué medida tiene cada ejercicio.
const muscleByExercise = {
  dom: 'Tirón',
  mus: 'Tirón',
  fon: 'Empuje',
  fle: 'Empuje',
  fro: 'Core',
  sen: 'Tren inferior',
};
const measureByExercise = { fro: 'seconds' };

// Rutina semanal: 3 días con día de la semana asignado + 1 descanso.
const routine = {
  id: 'r1',
  trainerId: 't',
  clientId: 'a',
  name: 'Fuerza',
  active: true,
  schedule: 'weekly',
  createdAt: 0,
  updatedAt: 0,
  days: [
    {
      id: 'd1',
      name: 'Empuje',
      weekday: 0,
      exercises: [
        { id: 'x1', exerciseId: 'fon', name: 'Fondos', sets: 4, reps: '8' },
        { id: 'x2', exerciseId: 'fle', name: 'Flexiones', sets: 4, reps: '8' },
      ],
    },
    {
      id: 'd2',
      name: 'Tirón',
      weekday: 2,
      exercises: [
        { id: 'x3', exerciseId: 'dom', name: 'Dominadas', sets: 4, reps: '6' },
        { id: 'x4', exerciseId: 'mus', name: 'Muscle up', sets: 2, reps: '3' },
      ],
    },
    {
      id: 'd3',
      name: 'Piernas y core',
      weekday: 4,
      exercises: [
        { id: 'x5', exerciseId: 'sen', name: 'Sentadillas', sets: 4, reps: '10' },
        { id: 'x6', exerciseId: 'fro', name: 'Front lever', sets: 3, reps: '12' },
      ],
    },
    { id: 'd4', name: 'Descanso', isRest: true, exercises: [] },
  ],
};

/** Un entreno con las series completadas que se pidan. */
function entreno(fecha, ejercicios) {
  return {
    id: `l${fecha}`,
    trainerId: 't',
    clientId: 'a',
    routineId: 'r1',
    routineName: 'Fuerza',
    dayName: 'X',
    date: fecha,
    createdAt: fecha,
    exercises: ejercicios.map(([exerciseId, series, reps = '8', weight = '0']) => ({
      exerciseId,
      name: exerciseId,
      sets: Array.from({ length: series }, () => ({ reps, weight, completed: true })),
    })),
  };
}

console.log('\n1) Lo previsto sale de la rutina');
// Semana 1: cumple los tres días. Semana 2: solo uno. Semana 3: dos.
const logs = [
  entreno(L0 + 0 * DAY, [['fon', 4], ['fle', 4]]),
  entreno(L0 + 2 * DAY, [['dom', 4, '8', '5'], ['mus', 2]]),
  entreno(L0 + 4 * DAY, [['fro', 3, '12']]),
  entreno(L0 + WEEK + 0 * DAY, [['fon', 4], ['fle', 4]]),
  entreno(L0 + 2 * WEEK + 0 * DAY, [['fon', 4], ['fle', 4]]),
  entreno(L0 + 2 * WEEK + 2 * DAY, [['dom', 4, '10', '10'], ['mus', 2]]),
];

const v = buildBlockView({
  logs,
  routine,
  muscleByExercise,
  measureByExercise,
  weeks: 4,
  now: AHORA,
});

const fila = (g) => v.rows.find((r) => r.group === g);
comprueba('hay previsión (la rutina no va a sensaciones)', v.hasPlan === true);
comprueba('cuatro semanas', v.weeks.length === 4);
comprueba('3 entrenos previstos por semana', v.weeks[0].sessionsPlanned === 3);
comprueba(
  'Empuje: 8 series por sesión ÷ 3 días × 3 entrenos = 8 previstas',
  fila('Empuje').planned[0] === 8,
  String(fila('Empuje').planned[0])
);
comprueba('Tirón previstas: 6', fila('Tirón').planned[0] === 6, String(fila('Tirón').planned[0]));
comprueba('Core previstas: 3', fila('Core').planned[0] === 3);
comprueba('Tren inferior previstas: 4', fila('Tren inferior').planned[0] === 4);

console.log('\n2) Lo hecho sale de los entrenos');
comprueba('S1 Empuje: 8 hechas', fila('Empuje').done[0] === 8);
comprueba('S1 Tirón: 6 hechas', fila('Tirón').done[0] === 6);
comprueba('S2 Tirón: 0 hechas', fila('Tirón').done[1] === 0);
comprueba('S4 (en curso) sin entrenos: 0', fila('Empuje').done[3] === 0);
comprueba('frecuencia S1 = 3 días', v.weeks[0].sessionsDone === 3);
comprueba('frecuencia S2 = 1 día', v.weeks[1].sessionsDone === 1);
comprueba(
  'el total de Tren inferior es 0 aunque esté programado',
  fila('Tren inferior').totalDone === 0 && fila('Tren inferior').totalPlanned === 16
);

console.log('\n3) Los avisos');
const ids = v.alerts.map((a) => a.id);
comprueba('avisa del grupo programado y sin tocar', ids.includes('cero'));
comprueba(
  'y lo dice nombrando el grupo',
  (v.alerts.find((a) => a.id === 'cero')?.title ?? '').includes('Tren inferior'),
  v.alerts.find((a) => a.id === 'cero')?.title
);
comprueba('avisa de la semana que se cayó', ids.includes('semana-caida'));
comprueba('nunca más de tres avisos', v.alerts.length <= 3);
comprueba(
  'no culpa a la programación de un desequilibrio que causó la semana caída',
  !ids.includes('desequilibrio') && !ids.includes('se-salta'),
  ids.join()
);

// Desequilibrio de verdad: mucho empuje, poquísimo tirón.
const desig = buildBlockView({
  logs: [
    entreno(L0, [['fon', 10], ['fle', 10]]),
    entreno(L0 + WEEK, [['fon', 10], ['fle', 10]]),
    entreno(L0 + 2 * WEEK, [['dom', 4]]),
  ],
  routine: null,
  muscleByExercise,
  weeks: 4,
  now: AHORA,
});
comprueba(
  'sí avisa con 40 contra 4',
  desig.alerts.some((a) => a.id === 'desequilibrio')
);
comprueba('sin rutina no hay previsión', desig.hasPlan === false);
comprueba(
  'sin previsión no se inventa cumplimiento',
  desig.adherence === null && desig.rows.every((r) => r.planned.every((p) => p === null))
);

console.log('\n4) La descarga que no descarga');
const macro = {
  id: 'm1', trainerId: 't', clientId: 'a', level: 'meso', name: 'Bloque',
  startDate: L0, endDate: L0 + 4 * WEEK - DAY, createdAt: 0, updatedAt: 0,
};
const semanas = [0, 1, 2, 3].map((i) => ({
  id: `w${i}`, trainerId: 't', clientId: 'a', level: 'micro', name: `Semana ${i + 1}`,
  parentId: 'm1', orderIndex: i + 1,
  startDate: L0 + i * WEEK, endDate: L0 + i * WEEK + 6 * DAY,
  targetSessions: i === 2 ? 2 : 3, isDeload: i === 2 || undefined,
  createdAt: 0, updatedAt: 0,
}));

const conDescarga = buildBlockView({
  cycle: macro,
  cycles: semanas,
  logs: [
    entreno(L0, [['fon', 6]]),
    entreno(L0 + WEEK, [['fon', 6]]),
    // Semana 3, de descarga: hace MÁS que la anterior.
    entreno(L0 + 2 * WEEK, [['fon', 5]]),
    entreno(L0 + 2 * WEEK + 2 * DAY, [['fon', 5]]),
  ],
  routine,
  muscleByExercise,
  now: AHORA,
});

comprueba('las semanas salen del plan', conDescarga.weeks.length === 4);
comprueba('la tercera va marcada como descarga', conDescarga.weeks[2].isDeload === true);
comprueba(
  'en descarga se prevén menos series',
  conDescarga.rows.find((r) => r.group === 'Empuje').planned[2] === 5,
  String(conDescarga.rows.find((r) => r.group === 'Empuje').planned[2])
);
comprueba(
  'avisa de que la descarga no descargó',
  conDescarga.alerts.some((a) => a.id.startsWith('descarga-'))
);

console.log('\n5) La progresión que sí se celebra');
const subiendo = buildBlockView({
  logs: [
    entreno(L0, [['fon', 3, '10', '0']]),
    entreno(L0 + 2 * DAY, [['fon', 3, '10', '5']]),
    entreno(L0 + WEEK, [['fon', 3, '10', '10']]),
  ],
  routine: null,
  muscleByExercise,
  weeks: 4,
  now: AHORA,
});
const bueno = subiendo.alerts.find((a) => a.tone === 'good');
comprueba('detecta la mejor progresión', !!bueno, subiendo.alerts.map((a) => a.id).join());
comprueba('y la cuenta con marcas reales', !!bueno && bueno.title.includes('10×10'), bueno?.title);

const pocosDatos = buildBlockView({
  logs: [entreno(L0, [['fon', 3, '10', '0']]), entreno(L0 + WEEK, [['fon', 3, '10', '20']])],
  routine: null,
  muscleByExercise,
  weeks: 4,
  now: AHORA,
});
comprueba(
  'con dos sesiones no canta victoria',
  !pocosDatos.alerts.some((a) => a.tone === 'good')
);

console.log(fallos === 0 ? '\nTodo correcto ✔\n' : `\n${fallos} fallo(s) ✖\n`);
process.exit(fallos === 0 ? 0 : 1);
