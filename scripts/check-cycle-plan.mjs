/*
 * Comprobación del calendario de planificación (lib/cyclePlan.ts).
 *
 * Es cálculo puro de fechas, que es justo donde los fallos no se ven: un plan
 * con una semana de más o un bloque que empieza en martes parece correcto en
 * pantalla y descuadra el mes siguiente. Aquí se comprueba con números.
 *
 *   node --experimental-strip-types scripts/check-cycle-plan.mjs
 */
import {
  buildPlan,
  buildCycleTree,
  descendantIds,
  planCalendar,
  planEndDate,
  planSummary,
  startOfWeek,
  totalWeeks,
} from '../lib/cyclePlan.ts';

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

const draft = {
  name: 'Temporada',
  // Un miércoles a propósito: el plan tiene que alinearse al lunes.
  startDate: new Date(2026, 7, 5, 13, 0, 0).getTime(),
  sessionsPerWeek: 4,
  blocks: [
    { name: 'Acumulación', weeks: 4, deloadLast: true },
    { name: 'Intensificación', weeks: 3, deloadLast: false },
  ],
};

console.log('\n1) Construcción del plan');
const plan = buildPlan(draft);
const macro = plan.find((p) => p.level === 'macro');
const mesos = plan.filter((p) => p.level === 'meso');
const micros = plan.filter((p) => p.level === 'micro');

comprueba('7 semanas en total', totalWeeks(draft) === 7);
comprueba('1 macro + 2 mesos + 7 micros', plan.length === 10, `son ${plan.length}`);
comprueba('el macro empieza en lunes', new Date(macro.startDate).getDay() === 1);
comprueba(
  'el macro dura exactamente 7 semanas',
  macro.endDate - macro.startDate === 7 * WEEK - DAY
);
comprueba('planEndDate coincide con el macro', planEndDate(draft) === macro.endDate);
comprueba(
  'los bloques encajan sin huecos ni solapes',
  mesos[1].startDate === mesos[0].endDate + DAY
);
comprueba('el último micro termina donde el macro', micros[6].endDate === macro.endDate);
comprueba(
  'las semanas son consecutivas',
  micros.every((m, i) => i === 0 || m.startDate === micros[i - 1].endDate + DAY)
);
comprueba(
  'solo la 4ª semana es de descarga',
  micros.filter((m) => m.isDeload).length === 1 && micros[3].isDeload === true
);
comprueba('en descarga se pide un entreno menos', micros[3].targetSessions === 3);
comprueba('el resto de semanas piden 4', micros[0].targetSessions === 4);
comprueba('cada micro cuelga de su meso', micros[4].parentKey === mesos[1].key);
comprueba('cada meso cuelga del macro', mesos.every((m) => m.parentKey === 'macro'));

console.log('\n2) Árbol y descendientes');
// Simula lo que devolvería Firestore: ids de verdad y parentId resueltos.
const ids = new Map(plan.map((p, i) => [p.key, `c${i}`]));
const guardados = plan.map((p, i) => ({
  id: `c${i}`,
  trainerId: 't1',
  clientId: 'a1',
  level: p.level,
  name: p.name,
  parentId: p.parentKey ? ids.get(p.parentKey) : undefined,
  orderIndex: p.orderIndex,
  startDate: p.startDate,
  endDate: p.endDate,
  isDeload: p.isDeload,
  targetSessions: p.targetSessions,
  createdAt: 0,
  updatedAt: 0,
}));

const raiz = buildCycleTree(guardados);
comprueba('una sola raíz (el macro)', raiz.length === 1);
comprueba('el macro tiene 2 bloques', raiz[0].children.length === 2);
comprueba('el primer bloque tiene 4 semanas', raiz[0].children[0].children.length === 4);
comprueba(
  'las semanas salen en orden',
  raiz[0].children[0].children.map((n) => n.cycle.orderIndex).join() === '1,2,3,4'
);
comprueba('descendientes del macro: 9', descendantIds(guardados, 'c0').length === 9);

const huerfano = { ...guardados[1], id: 'x1', parentId: 'no-existe' };
comprueba(
  'un ciclo con padre inexistente no desaparece',
  buildCycleTree([...guardados, huerfano]).length === 2
);

console.log('\n3) Calendario y cumplimiento');
const lunes = startOfWeek(draft.startDate);
// Semana 1: entrena 4 días (cumple). Semana 2: solo 1. Semana 3: ninguno.
const logs = [
  ...[0, 1, 3, 5].map((d) => ({ date: lunes + d * DAY })),
  { date: lunes + WEEK + 2 * DAY },
];
const semanas = planCalendar(guardados[0], guardados, logs, lunes + WEEK + 3 * DAY);

comprueba('7 filas, una por semana', semanas.length === 7);
comprueba('la semana 1 cuenta 4 entrenos', semanas[0].done === 4);
comprueba('la semana 2 cuenta 1', semanas[1].done === 1);
comprueba('la semana 3 cuenta 0', semanas[2].done === 0);
comprueba('la meta de la semana 1 es 4', semanas[0].target === 4);
comprueba('la semana 4 va marcada como descarga', semanas[3].isDeload === true);
comprueba('la semana 1 ya es pasado', semanas[0].isPast === true);
comprueba('la semana 2 es la actual', semanas[1].isCurrent === true);
comprueba('la semana 3 no es pasado', semanas[2].isPast === false);
comprueba(
  'cada bloque marca su primera semana',
  semanas.filter((w) => w.blockStart).length === 2
);
comprueba('la semana 5 pertenece al segundo bloque', semanas[4].block?.name === 'Intensificación');
comprueba(
  'los días entrenados caen donde toca',
  semanas[0].days.join() === 'true,true,false,true,false,true,false'
);

const resumen = planSummary(semanas, lunes + WEEK + 3 * DAY);
comprueba('vamos por la semana 2 de 7', resumen.week === 2 && resumen.totalWeeks === 7);
comprueba('5 entrenos hechos de 8 previstos', resumen.done === 5 && resumen.planned === 8);
comprueba(
  'cumplimiento 63 %',
  Math.round(resumen.adherence * 100) === 63,
  String(Math.round(resumen.adherence * 100))
);
comprueba('el bloque actual es Acumulación', resumen.block?.name === 'Acumulación');

console.log('\n4) Dos planes seguidos no se mezclan');
const segundo = guardados.map((c, i) => ({
  ...c,
  id: `s${i}`,
  parentId: c.parentId ? `s${Number(c.parentId.slice(1))}` : undefined,
  startDate: c.startDate + 7 * WEEK,
  endDate: c.endDate + 7 * WEEK,
}));
const soloPrimero = planCalendar(guardados[0], [...guardados, ...segundo], logs, lunes);
comprueba('el calendario del primer plan sigue teniendo 7 semanas', soloPrimero.length === 7);
comprueba(
  'ninguna semana del primero apunta a un bloque del segundo',
  soloPrimero.every((w) => !w.block || w.block.id.startsWith('c'))
);

console.log(fallos === 0 ? '\nTodo correcto ✔\n' : `\n${fallos} fallo(s) ✖\n`);
process.exit(fallos === 0 ? 0 : 1);
