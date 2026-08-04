/*
 * Comprobación de las plantillas de plan (lib/planTemplates.ts).
 *
 * Lo delicado es que una plantilla NO lleva fechas: si se colara una, un plan
 * de septiembre aplicado en enero aparecería en el pasado y nadie entendería
 * por qué. Aquí se comprueba que la estructura sobreviva y que el calendario se
 * calcule entero al aplicarla.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-plan-templates.mjs
 */
import {
  cyclesFromTemplate,
  suggestProgression,
  templateFromCycles,
  templateSessions,
  templateWeeks,
} from '../lib/planTemplates.ts';

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

// Un plan real: 2 bloques (3 y 2 semanas), la última de cada uno de descarga,
// y la semana 2 con números propios.
const L0 = lunesDe(new Date(2026, 5, 1).getTime());
const macro = {
  id: 'm', trainerId: 't', clientId: 'a', level: 'macro', name: 'Temporada',
  goal: 'Muscle up', startDate: L0, endDate: L0 + 5 * WEEK - DAY, orderIndex: 1,
  createdAt: 0, updatedAt: 0,
};
const bloques = [
  { id: 'b1', parentId: 'm', level: 'meso', name: 'Acumulación', goal: 'Volumen',
    orderIndex: 1, startDate: L0, endDate: L0 + 3 * WEEK - DAY,
    trainerId: 't', clientId: 'a', createdAt: 0, updatedAt: 0 },
  { id: 'b2', parentId: 'm', level: 'meso', name: 'Intensificación',
    orderIndex: 2, startDate: L0 + 3 * WEEK, endDate: L0 + 5 * WEEK - DAY,
    trainerId: 't', clientId: 'a', createdAt: 0, updatedAt: 0 },
];
const semanas = [
  ['b1', 1, 'Semana 1', false, 4, null],
  ['b1', 2, 'Semana 2', false, 4, [{ exerciseId: 'dom', sets: 5, reps: '6', rir: 1 }]],
  ['b1', 3, 'Semana 3 · descarga', true, 3, null],
  ['b2', 1, 'Semana 1', false, 4, null],
  ['b2', 2, 'Semana 2 · descarga', true, 3, null],
].map(([padre, orden, nombre, descarga, meta, plan], i) => ({
  id: `w${i}`, parentId: padre, level: 'micro', name: nombre, orderIndex: orden,
  startDate: L0 + i * WEEK, endDate: L0 + i * WEEK + 6 * DAY,
  ...(descarga ? { isDeload: true } : {}),
  targetSessions: meta,
  ...(plan ? { weekPlan: plan } : {}),
  trainerId: 't', clientId: 'a', createdAt: 0, updatedAt: 0,
}));
const todos = [macro, ...bloques, ...semanas];

console.log('\n1) De plan a plantilla');
const tpl = templateFromCycles(macro, todos, '  Mi método  ');
comprueba('se queda con el nombre que se le da, sin espacios', tpl.name === 'Mi método');
comprueba('conserva el objetivo del plan', tpl.goal === 'Muscle up');
comprueba('dos bloques', tpl.blocks.length === 2);
comprueba('3 semanas en el primero, 2 en el segundo',
  tpl.blocks[0].weeks.length === 3 && tpl.blocks[1].weeks.length === 2);
comprueba('los bloques salen en orden', tpl.blocks[0].name === 'Acumulación');
comprueba('la descarga se conserva', tpl.blocks[0].weeks[2].isDeload === true);
comprueba('las metas de sesiones también', tpl.blocks[0].weeks[2].targetSessions === 3);
comprueba('y la programación de la semana 2',
  tpl.blocks[0].weeks[1].weekPlan?.[0].sets === 5);
comprueba('una semana sin programar no guarda un array vacío',
  tpl.blocks[0].weeks[0].weekPlan === undefined);

const json = JSON.stringify(tpl);
comprueba('NINGUNA fecha viaja en la plantilla',
  !json.includes('startDate') && !json.includes('endDate'),
  json.slice(0, 120));
comprueba('5 semanas en total', templateWeeks(tpl) === 5);
comprueba('18 entrenos previstos', templateSessions(tpl) === 18, String(templateSessions(tpl)));

console.log('\n2) De plantilla a plan, en otra fecha');
// Se aplica un miércoles, siete meses después: tiene que alinearse al lunes.
const nueva = new Date(2027, 0, 6, 15, 0, 0).getTime();
const ciclos = cyclesFromTemplate({ ...tpl, id: 'x', trainerId: 't', createdAt: 0 }, nueva);
const macros = ciclos.filter((c) => c.level === 'macro');
const mesos = ciclos.filter((c) => c.level === 'meso');
const micros = ciclos.filter((c) => c.level === 'micro');

comprueba('1 macro + 2 mesos + 5 micros', ciclos.length === 8, String(ciclos.length));
comprueba('empieza el lunes de esa semana', new Date(macros[0].startDate).getDay() === 1);
comprueba('el macro dura 5 semanas',
  macros[0].endDate - macros[0].startDate === 5 * WEEK - DAY);
comprueba('los bloques encajan sin huecos',
  mesos[1].startDate === mesos[0].endDate + DAY);
comprueba('las semanas son consecutivas',
  micros.every((m, i) => i === 0 || m.startDate === micros[i - 1].endDate + DAY));
comprueba('el último micro termina donde el macro',
  micros[4].endDate === macros[0].endDate);
comprueba('la descarga cae donde tocaba', micros[2].isDeload === true);
comprueba('la programación viaja con la semana', micros[1].weekPlan?.[0].sets === 5);
comprueba('cada micro cuelga de su meso', micros[3].parentKey === mesos[1].key);
comprueba('el nombre del bloque se conserva', mesos[0].name === 'Acumulación');

console.log('\n3) Ida y vuelta');
// Aplicar la plantilla y volver a guardarla tiene que dar lo mismo.
const comoCiclos = ciclos.map((c, i) => ({
  id: `n${i}`, trainerId: 't', clientId: 'b', level: c.level, name: c.name,
  parentId: c.parentKey ? `n${ciclos.findIndex((x) => x.key === c.parentKey)}` : undefined,
  orderIndex: c.orderIndex, startDate: c.startDate, endDate: c.endDate,
  isDeload: c.isDeload, targetSessions: c.targetSessions, weekPlan: c.weekPlan,
  goal: c.goal, createdAt: 0, updatedAt: 0,
}));
const otraVez = templateFromCycles(comoCiclos[0], comoCiclos, 'Mi método');
comprueba('la estructura sobrevive al viaje',
  JSON.stringify(otraVez.blocks) === JSON.stringify(tpl.blocks));

console.log('\n4) La progresión sugerida');
const sug = suggestProgression([
  { exerciseId: 'a', sets: 4, reps: '8' },
  { exerciseId: 'b', sets: 3, reps: '8-12' },
  { exerciseId: 'c', sets: 3, reps: 'AMRAP' },
  { exerciseId: 'd', sets: 3 },
]);
comprueba('un número exacto sube una repetición', sug[0].reps === '9');
comprueba('un rango no se toca', sug[1].reps === '8-12');
comprueba('un texto tampoco', sug[2].reps === 'AMRAP');
comprueba('sin objetivo no inventa nada', sug[3].reps === undefined);
comprueba('las series no se tocan', sug.every((e, i) => e.sets === [4, 3, 3, 3][i]));

console.log(fallos === 0 ? '\nTodo correcto ✔\n' : `\n${fallos} fallo(s) ✖\n`);
process.exit(fallos === 0 ? 0 : 1);
