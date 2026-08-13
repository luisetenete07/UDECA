/*
 * La agenda del entrenador en su calendario (lib/calendario.ts).
 *
 * Lo que se protege son los dos fallos que arruinan estas integraciones y que
 * no dan ningún error:
 *
 *  1. DUPLICAR. Si el identificador de cada evento cambiara entre una
 *     exportación y la siguiente, conectar el calendario dos veces dejaría el
 *     calendario del entrenador con todo por duplicado. Nadie lo nota hasta
 *     que ya tiene doscientos eventos repetidos.
 *  2. FICHERO ROTO. El .ics tiene reglas tontas y estrictas: comas escapadas,
 *     líneas de 75 caracteres, saltos CRLF. Si se incumple una, Google dice
 *     "no se pudo importar" y no explica cuál.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-calendario.mjs
 */
import {
  escapaTexto,
  eventosDeLaAgenda,
  fechaIcs,
  ficheroIcs,
  nombreDelFichero,
  plegaLinea,
  resumenDeEventos,
  uidDeEvento,
} from '../lib/calendario.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const DIA = 86400000;
const HOY = new Date(2026, 7, 13, 10, 0, 0).getTime();

const tareas = [
  { id: 't1', trainerId: 'c', title: 'Llamar a Marcos', scope: 'day', done: false, dueDate: HOY + DIA, order: 0, createdAt: 0, updatedAt: 0 },
  { id: 't2', trainerId: 'c', title: 'Hecha', scope: 'day', done: true, dueDate: HOY + DIA, order: 0, createdAt: 0, updatedAt: 0 },
  { id: 't3', trainerId: 'c', title: 'Sin fecha', scope: 'day', done: false, order: 0, createdAt: 0, updatedAt: 0 },
  { id: 't4', trainerId: 'c', title: 'Objetivo del año', scope: 'goal', done: false, dueDate: HOY + DIA, order: 0, createdAt: 0, updatedAt: 0 },
  { id: 't5', trainerId: 'c', title: 'De la semana', scope: 'week', done: false, dueDate: HOY + DIA, order: 0, createdAt: 0, updatedAt: 0 },
  { id: 't6', trainerId: 'c', title: 'Muy lejos', scope: 'day', done: false, dueDate: HOY + 900 * DIA, order: 0, createdAt: 0, updatedAt: 0 },
];
const alumnos = [
  { uid: 'a1', name: 'Marcos Ruiz', nextPaymentDate: HOY + 4 * DIA, monthlyFeeEur: 45 },
  { uid: 'a2', name: 'Sin fecha' },
];
const ciclos = [
  { id: 'c1', name: 'Bloque de fuerza', startDate: HOY - 5 * DIA, endDate: HOY + 20 * DIA, goal: 'Subir series' },
  { id: 'c2', name: 'Sin cerrar', startDate: HOY },
];

console.log('\nQué se lleva al calendario y qué no');
{
  const e = eventosDeLaAgenda({ tareas, alumnos, ciclos, desde: HOY - 30 * DIA, hasta: HOY + 365 * DIA });
  const titulos = e.map((x) => x.titulo);
  comprueba('la tarea del día con fecha, sí', titulos.includes('Llamar a Marcos'));
  comprueba('la ya hecha, no', !titulos.includes('Hecha'), titulos.join(' | '));
  comprueba('la que no tiene día, no', !titulos.includes('Sin fecha'));
  // Un objetivo del año no es una cita: ponerlo en un día inventado ensucia
  // el calendario de quien lo abre.
  comprueba('los objetivos, no', !titulos.includes('Objetivo del año'));
  comprueba('las de semana, tampoco', !titulos.includes('De la semana'));
  comprueba('lo que cae fuera de la ventana, no', !titulos.includes('Muy lejos'));
  comprueba('el cobro con fecha, sí', titulos.some((t) => t.includes('Marcos Ruiz')));
  comprueba('el alumno sin fecha de cobro, no', !titulos.includes('Cobro · Sin fecha'));
  comprueba('el bloque con principio y fin, sí', titulos.includes('Bloque de fuerza'));
  comprueba('el ciclo abierto, no', !titulos.includes('Sin cerrar'));
  comprueba('salen en orden de fecha', e.every((x, i) => i === 0 || e[i - 1].inicio <= x.inicio));
}

console.log('\nExportar dos veces no duplica');
{
  const a = eventosDeLaAgenda({ tareas, alumnos, ciclos, desde: HOY - 30 * DIA, hasta: HOY + 365 * DIA });
  const b = eventosDeLaAgenda({ tareas, alumnos, ciclos, desde: HOY - 30 * DIA, hasta: HOY + 365 * DIA });
  comprueba('los identificadores son los mismos',
    a.map((x) => x.uid).join() === b.map((x) => x.uid).join());
  comprueba('y son únicos', new Set(a.map((x) => x.uid)).size === a.length);
  // El uid NO puede depender de cuándo se exporta, o cada exportación crearía
  // una copia entera de la agenda.
  comprueba('no dependen del momento de exportar',
    uidDeEvento('tarea', 't1') === uidDeEvento('tarea', 't1'));
  // Pero el cobro del mes que viene SÍ es otro evento.
  comprueba('un cobro de otro mes es otro evento',
    uidDeEvento('cobro', 'a1', HOY) !== uidDeEvento('cobro', 'a1', HOY + 30 * DIA));
  comprueba('un id raro no rompe el identificador',
    /^udeca-tarea-[A-Za-z0-9_-]+@/.test(uidDeEvento('tarea', 'con espacios/y:cosas')),
    uidDeEvento('tarea', 'con espacios/y:cosas'));
}

console.log('\nEl día completo termina donde tiene que terminar');
{
  const e = eventosDeLaAgenda({ ciclos: [ciclos[0]], desde: HOY - 30 * DIA, hasta: HOY + 365 * DIA });
  const bloque = e[0];
  // En los calendarios el fin de un evento de día completo es EXCLUSIVO: sin
  // sumar un día, el último día del bloque no sale.
  comprueba('el fin va un día más allá del último',
    bloque.fin - bloque.inicio === 26 * DIA, String((bloque.fin - bloque.inicio) / DIA));
  comprueba('y es de día completo', bloque.todoElDia);
}

console.log('\nEl fichero .ics es válido');
{
  const e = eventosDeLaAgenda({ tareas, alumnos, ciclos, desde: HOY - 30 * DIA, hasta: HOY + 365 * DIA });
  const ics = ficheroIcs(e, HOY);
  comprueba('abre y cierra el calendario',
    ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'));
  comprueba('los saltos son CRLF', ics.includes('\r\n') && !/[^\r]\n/.test(ics));
  const abiertos = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
  const cerrados = (ics.match(/END:VEVENT/g) ?? []).length;
  comprueba('cada evento se cierra', abiertos === cerrados && abiertos === e.length,
    `${abiertos} abiertos, ${cerrados} cerrados, ${e.length} eventos`);
  comprueba('todos llevan UID y fechas',
    e.every((x) => ics.includes(`UID:${x.uid}`)) && ics.includes('DTSTART;VALUE=DATE:'));
  comprueba('ninguna línea pasa de 75',
    ics.split('\r\n').every((l) => l.length <= 75),
    String(Math.max(...ics.split('\r\n').map((l) => l.length))));
}

console.log('\nLos textos raros no parten el fichero');
{
  // Comas y puntos y coma son separadores de campo en .ics: sin escapar,
  // "Cobro; Ana, 45 €" parte el evento en tres y el calendario se lo come.
  comprueba('escapa las comas', escapaTexto('Ana, 45 €') === 'Ana\\, 45 €');
  comprueba('escapa el punto y coma', escapaTexto('a;b') === 'a\\;b', escapaTexto('a;b'));
  comprueba('escapa la barra', escapaTexto('a\\b') === 'a\\\\b');
  comprueba('convierte los saltos', escapaTexto('a\nb') === 'a\\nb');

  const largo = 'x'.repeat(300);
  const plegada = plegaLinea(`SUMMARY:${largo}`);
  comprueba('parte las líneas largas', plegada.split('\r\n').every((l) => l.length <= 75),
    String(Math.max(...plegada.split('\r\n').map((l) => l.length))));
  comprueba('y las continúa con un espacio',
    plegada.split('\r\n').slice(1).every((l) => l.startsWith(' ')));

  const ics = ficheroIcs([
    { uid: 'u@x', tipo: 'cobro', titulo: 'Cobro; Ana, 45 €', inicio: HOY, fin: HOY + DIA, todoElDia: true, notas: 'Una nota\nen dos líneas' },
  ], HOY);
  comprueba('un título con comas sale escapado', ics.includes('Cobro\\; Ana\\, 45 €'), ics);
  comprueba('y una nota con salto también', ics.includes('en dos líneas') && ics.includes('\\n'));
}

console.log('\nLa fecha, como la espera el calendario');
{
  comprueba('formato AAAAMMDD', fechaIcs(new Date(2026, 0, 5).getTime()) === '20260105',
    fechaIcs(new Date(2026, 0, 5).getTime()));
  comprueba('con ceros a la izquierda', fechaIcs(new Date(2026, 8, 9).getTime()) === '20260909');
}

console.log('\nLo que se le dice y cómo se llama el fichero');
{
  const e = eventosDeLaAgenda({ tareas, alumnos, ciclos, desde: HOY - 30 * DIA, hasta: HOY + 365 * DIA });
  const r = resumenDeEventos(e);
  comprueba('cuenta cada cosa', r.tareas === 1 && r.cobros === 1 && r.ciclos === 1,
    `${r.tareas}/${r.cobros}/${r.ciclos}`);
  comprueba('y lo dice en cristiano', /tarea/.test(r.texto) && /cobro/.test(r.texto), r.texto);
  comprueba('sin nada, lo dice también', /Nada con fecha/.test(resumenDeEventos([]).texto));

  comprueba('el fichero lleva su nombre', nombreDelFichero('Luis Tena') === 'agenda-udeca-luis-tena.ics',
    nombreDelFichero('Luis Tena'));
  comprueba('sin acentos ni rarezas', !/[^a-z0-9.-]/.test(nombreDelFichero('José Ángel Muñoz')),
    nombreDelFichero('José Ángel Muñoz'));
  comprueba('sin nombre, uno genérico', nombreDelFichero() === 'agenda-udeca.ics');
  comprueba('siempre acaba en .ics', nombreDelFichero('!!!').endsWith('.ics'), nombreDelFichero('!!!'));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
