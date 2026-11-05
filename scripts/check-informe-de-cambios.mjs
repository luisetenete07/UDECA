/**
 * El informe de cambios en PDF, desde la ficha del alumno.
 *
 * Todo lo que el entrenador ha ido cambiando —planes, días, ejercicios,
 * series, detalles y semanas de los ciclos— ordenado por el día del cambio,
 * en el periodo que elija y con lo que elija. Lo de antes del registro de
 * cambios (1 nov 2026) se deduce de los entrenos, y se dice.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-informe-de-cambios.mjs
 */
import { readFileSync } from 'node:fs';
import {
  cambiosVistosEnLosEntrenos,
  INICIO_DEL_REGISTRO,
  informeDeCambios,
  inicioDelAlumno,
  TODO_EL_INFORME,
} from '../lib/informeDeCambios.ts';
import { informeDeCambiosHtml } from '../lib/informeDeCambiosPdf.ts';
import { cambiosDelPlan } from '../lib/avisosDelPlan.ts';
import { setIdioma } from '../lib/idioma.ts';

setIdioma('es');
let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));
const copia = (x) => JSON.parse(JSON.stringify(x));
const DIA = 86_400_000;
const fecha = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();

// Un alumno que empezó en septiembre con un plan, cambió de plan en octubre y,
// ya con el registro, tuvo cambios en noviembre.
const dom = { id: 'e1', exerciseId: 'dom', name: 'Dominadas', sets: 3, reps: '8' };
const fon = { id: 'e2', exerciseId: 'fon', name: 'Fondos', sets: 3, reps: '10' };
const rem = { id: 'e3', exerciseId: 'rem', name: 'Remo', sets: 3, reps: '12' };
const viejo = {
  id: 'r1', trainerId: 't', clientId: 'a', name: 'Base', active: false, schedule: 'weekly',
  days: [{ id: 'd1', name: 'Fuerza', weekday: 0, exercises: [dom, fon] }],
  createdAt: fecha(2026, 9, 1), updatedAt: fecha(2026, 9, 20),
};
const actual = {
  id: 'r2', trainerId: 't', clientId: 'a', name: 'Fuerza 2', active: true, schedule: 'cycle',
  days: [
    { id: 'd1', name: 'Empuje', exercises: [{ ...fon, sets: 4 }] },
    { id: 'd2', name: 'Tirón', exercises: [dom, rem] },
  ],
  createdAt: fecha(2026, 10, 5), updatedAt: fecha(2026, 11, 3),
};
const log = (id, date, routine, dayName, ejercicios) => ({
  id, trainerId: 't', clientId: 'a', routineId: routine.id, routineName: routine.name, dayName, date,
  exercises: ejercicios.map(([exerciseId, name, series]) => ({ exerciseId, name, sets: Array.from({ length: series }, () => ({ reps: '8', completed: true })) })),
  createdAt: date,
});
const logs = [
  log('l1', fecha(2026, 9, 7), viejo, 'Fuerza', [['dom', 'Dominadas', 3], ['fon', 'Fondos', 3]]),
  log('l2', fecha(2026, 9, 14), viejo, 'Fuerza', [['dom', 'Dominadas', 4], ['fon', 'Fondos', 3]]),
  log('l3', fecha(2026, 9, 21), viejo, 'Fuerza', [['dom', 'Dominadas', 4], ['fon', 'Fondos', 3], ['rem', 'Remo', 3]]),
  // Un día suelto sin Fondos: se lo saltó, no es un cambio (la siguiente vuelve a tenerlo).
  log('l4', fecha(2026, 9, 28), viejo, 'Fuerza', [['dom', 'Dominadas', 4], ['rem', 'Remo', 3]]),
  log('l5', fecha(2026, 10, 2), viejo, 'Fuerza', [['dom', 'Dominadas', 4], ['fon', 'Fondos', 3], ['rem', 'Remo', 3]]),
  log('l6', fecha(2026, 10, 8), actual, 'Tirón', [['dom', 'Dominadas', 3], ['rem', 'Remo', 3]]),
  log('l7', fecha(2026, 11, 4), actual, 'Tirón', [['dom', 'Dominadas', 3], ['rem', 'Remo', 3]]),
];
// El registro: el 3 de noviembre, Dominadas a 4 × 8 en Tirón y Fondos fuera de Empuje.
const despues = copia(actual);
despues.days[1].exercises[0].sets = 4;
despues.days[1].exercises[0].restSeconds = 120;
despues.days[0].exercises = [];
const cambio = cambiosDelPlan(actual, despues);
const avisos = [{ id: 'a1', trainerId: 't', clientId: 'a', tipo: 'plan', routineId: 'r2', plan: 'Fuerza 2', nuevo: false, dias: cambio.dias, ajustes: [], cuando: fecha(2026, 11, 3, 18) }];
const cycles = [
  { id: 'm1', trainerId: 't', clientId: 'a', level: 'meso', name: 'Intensificación', startDate: fecha(2026, 10, 5, 0), goal: 'Primer muscle up', createdAt: 0, updatedAt: 0 },
  { id: 's3', trainerId: 't', clientId: 'a', level: 'micro', name: 'Semana 3', parentId: 'm1', startDate: fecha(2026, 10, 19, 0), weekPlan: [{ exerciseId: 'dom', sets: 5, reps: '6', rir: 1 }], createdAt: 0, updatedAt: 0 },
];
const base = { routines: [viejo, actual], avisos, cycles, logs };
const desde = inicioDelAlumno([fecha(2026, 8, 30), viejo.createdAt, logs[0].date]);
const hasta = fecha(2026, 11, 5, 23);

console.log('\nDesde que empezó: todo, por día de cambio');
const inf = informeDeCambios({ ...base, desde, hasta });
{
  const dias = inf.dias.map((d) => new Date(d.dia).toISOString().slice(0, 10));
  ok('del más antiguo al más nuevo', dias.every((d, i) => i === 0 || d >= dias[i - 1]), dias.join());
  const fuentes = inf.dias.flatMap((d) => d.eventos.map((e) => e.fuente));
  ok('salen los planes nuevos, los ciclos, los entrenos y el registro', ['plan-nuevo', 'ciclo', 'entrenos', 'cambio'].every((f) => fuentes.includes(f)), fuentes.join());
  const textos = inf.dias.flatMap((d) => d.eventos.flatMap((e) => [e.titulo, ...e.notas, ...e.dias.flatMap((x) => x.lineas.map((l) => `${l.tipo}:${l.texto}`))]));
  ok('el registro: "Dominadas: 3 × 8 → 4 × 8"', textos.includes('series:Dominadas: 3 × 8 → 4 × 8'), textos.join(' | '));
  ok('y el detalle (descanso)', textos.includes('detalle:Dominadas: Descanso'));
  ok('y el quitado', textos.includes('quitado:Fondos'));
  ok('el día del cambio, con su nombre: "Día 2 · Tirón"', inf.dias.some((d) => d.eventos.some((e) => e.dias.some((x) => x.nombre === 'Día 2 · Tirón'))));
  ok('de los entrenos: 3 → 4 series de Dominadas', textos.includes('series:Dominadas: 3 → 4 series'));
  ok('y el Remo que entró', textos.some((x) => x.startsWith('nuevo:Remo')));
  const deEntrenos = inf.dias.flatMap((d) => d.eventos.filter((e) => e.fuente === 'entrenos').flatMap((e) => e.dias.flatMap((x) => x.lineas.map((l) => `${l.tipo}:${l.texto}`))));
  ok('el día que se saltó los Fondos no es un cambio', !deEntrenos.includes('quitado:Fondos'), deEntrenos.join(' | '));
  ok('ni su vuelta es "un ejercicio nuevo"', !deEntrenos.some((x) => x.startsWith('nuevo:Fondos')), deEntrenos.join(' | '));
  ok('el plan nuevo de octubre, con cuándo y qué días', textos.includes('Plan nuevo: Fuerza 2') && textos.some((x) => /Días sueltos · 2 días de entreno · Empuje, Tirón/.test(x)), textos.filter((x) => /Fuerza 2/.test(x)).join(' | '));
  ok('el bloque y la semana 3 del ciclo', textos.includes('Empieza el bloque: Intensificación') && textos.includes('series:Dominadas: 5 × 6 · RIR 1'));
  ok('los dos planes, con sus días y entrenos', inf.planes.length === 2 && inf.planes[0].nombre === 'Base' && inf.planes[0].dias[0].sesiones === 5 && inf.planes[1].hasta === null);
  ok('los días con nombre del plan: "Lunes · Fuerza", "Día 2 · Tirón"', inf.planes[0].dias[0].nombre === 'Lunes · Fuerza' && inf.planes[1].dias[1].nombre === 'Día 2 · Tirón');
  ok('cuenta entrenos y cambios', inf.sesiones === 7 && inf.cambios > 5 && inf.conEntrenos);
  const sinPlan = logs.map(({ routineId: _fuera, ...l }) => l);
  const conFechas = informeDeCambios({ ...base, logs: sinPlan, desde, hasta });
  ok('un entreno sin plan apuntado cuenta para el plan vigente ese día', conFechas.planes[0].sesiones === 5 && conFechas.planes[1].sesiones === 2, conFechas.planes.map((p) => p.sesiones).join());
}

console.log('\nLo que elige el entrenador');
{
  const soloSeries = informeDeCambios({ ...base, desde, hasta, opciones: { ...TODO_EL_INFORME, planes: false, rutina: false, ejercicios: false, detalles: false, semanas: false } });
  const tipos = new Set(soloSeries.dias.flatMap((d) => d.eventos.flatMap((e) => e.dias.flatMap((x) => x.lineas.map((l) => l.tipo)))));
  ok('solo series: nada más que series', [...tipos].join() === 'series' && soloSeries.planes.length === 0, [...tipos].join());
  ok('y sin planes nuevos ni ciclos', soloSeries.dias.every((d) => d.eventos.every((e) => e.fuente === 'cambio' || e.fuente === 'entrenos')));
  const ultimoMes = informeDeCambios({ ...base, desde: fecha(2026, 10, 20, 0), hasta });
  ok('el periodo recorta: del 20 oct, ni el plan de septiembre ni sus cambios', ultimoMes.dias.every((d) => d.dia >= fecha(2026, 10, 20, 0)) && ultimoMes.planes.every((p) => p.nombre !== 'Base'));
}

console.log('\nLo de los entrenos, solo antes del registro');
{
  const tras = [log('x1', INICIO_DEL_REGISTRO + DIA, actual, 'Tirón', [['dom', 'Dominadas', 3]]), log('x2', INICIO_DEL_REGISTRO + 3 * DIA, actual, 'Tirón', [['dom', 'Dominadas', 5]])];
  const i2 = informeDeCambios({ ...base, logs: tras, avisos: [], desde, hasta });
  ok('después del 1 de noviembre manda el registro: no se deduce nada', !i2.dias.some((d) => d.eventos.some((e) => e.fuente === 'entrenos')));
  ok('una serie de más un solo día no es un cambio', cambiosVistosEnLosEntrenos([logs[1], log('y', fecha(2026, 9, 15), viejo, 'Fuerza', [['dom', 'Dominadas', 5], ['fon', 'Fondos', 3]]), logs[2]], 0, hasta, TODO_EL_INFORME).every((e) => !e.dias.some((d) => d.lineas.some((l) => /5 series/.test(l.texto)))));
}

console.log('\nEl PDF');
{
  const html = informeDeCambiosHtml(inf, { alumno: 'Marcos Ruiz', nivel: 'Intermedio', entrenador: 'Luis Tena' });
  if (process.env.INFORME_HTML) (await import('node:fs')).writeFileSync(process.env.INFORME_HTML, html);
  ok('con el alumno, el periodo y quién lo firma', /Marcos Ruiz/.test(html) && /Luis Tena/.test(html) && /Cambios del entrenamiento, día a día/.test(html));
  ok('cada día con su fecha larga y sus cambios', /class="fecha-cab"/.test(html) && /Dominadas: 3 × 8 → 4 × 8/.test(html));
  ok('explica de dónde sale lo de antes', /Visto en los entrenos/.test(html) && /no quedaban guardadas/.test(html));
  ok('fondo blanco (se imprime)', /background: #FFFFFF/.test(html));
  ok('sin HTML colado de los nombres', !/<script/.test(informeDeCambiosHtml(informeDeCambios({ ...base, routines: [{ ...actual, name: '<script>x</script>' }], desde, hasta }), { alumno: 'a' })));
}

console.log('\nEn la ficha del alumno');
{
  const ficha = lee('app/(trainer)/clients/[id]/index.tsx');
  ok('la fila "Informe de cambios (PDF)" en Entreno', />Informe de cambios \(PDF\)</.test(ficha) && /setInformeAbierto\(true\)/.test(ficha));
  const hoja = lee('components/InformeDeCambiosSheet.tsx');
  ok('elige periodo: desde que empezó, 3 meses, 1 mes o fechas', /texto: 'Desde que empezó'/.test(hoja) && /valor: 'fechas'/.test(hoja) && /<DateField/.test(hoja));
  ok('y qué entra, casilla a casilla', /QUE_ENTRA\.map/.test(hoja) && /accessibilityRole="checkbox"/.test(hoja));
  ok('ve cuántos cambios salen antes de crearlo', /frase`\$\{informe\.cambios\} cambios en \$\{informe\.dias\.length\} días/.test(hoja));
  ok('y lo saca en PDF', /printReportHtml\(\s*informeDeCambiosHtml\(informe/.test(hoja));
  ok('lee los cambios del plan como entrenador (por los dos campos)', /where\('trainerId', '==', trainerId\), where\('clientId', '==', clientId\)/.test(lee('lib/firestore/avisos.ts')));
}

console.log(fallos === 0 ? '\n✔ Informe de cambios' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
