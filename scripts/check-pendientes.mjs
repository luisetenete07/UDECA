/**
 * Los pendientes del entrenador: una lista de cosas que hacer SIN DÍA.
 *
 * Se apuntan, se tachan, lo destacado va arriba y, si acaban teniendo fecha,
 * se les pone día y pasan al calendario. Lo de las antiguas listas de
 * "Semana" y "Mes" sale aquí. Está en su inicio y en el calendario.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-pendientes.mjs
 */
import { readFileSync } from 'node:fs';
import { esPendiente, pendientesHechos, pendientesPorHacer, DIAS_DE_HECHOS } from '../lib/pendientes.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

const AHORA = Date.now();
const tarea = (id, extra) => ({ id, trainerId: 't', title: id, scope: 'pending', done: false, order: 0, createdAt: 0, updatedAt: 0, ...extra });
const tareas = [
  tarea('llamar', { order: 1 }),
  tarea('video', { order: 2, flagged: true }),
  tarea('seguro', { order: 3, scope: 'week' }),
  tarea('web', { order: 4, scope: 'month' }),
  tarea('jueves', { order: 5, scope: 'day', dueDate: AHORA }),
  tarea('meta', { order: 6, scope: 'goal' }),
  tarea('hecha', { order: 7, done: true, doneAt: AHORA - 86_400_000 }),
  tarea('vieja', { order: 8, done: true, doneAt: AHORA - (DIAS_DE_HECHOS + 1) * 86_400_000 }),
];

console.log('\nQué es un pendiente');
{
  ok('sin día', esPendiente({ scope: 'pending' }));
  ok('lo de las antiguas Semana y Mes, también', esPendiente({ scope: 'week' }) && esPendiente({ scope: 'month' }));
  ok('lo de un día y los objetivos, no', !esPendiente({ scope: 'day' }) && !esPendiente({ scope: 'goal' }));
}

console.log('\nLa lista');
{
  const lista = pendientesPorHacer(tareas).map((t) => t.id);
  ok('lo destacado arriba, y lo demás en el orden en que se apuntó', lista.join() === 'video,llamar,seguro,web', lista.join());
  const hechos = pendientesHechos(tareas, AHORA).map((t) => t.id);
  ok('lo tachado hace poco, aparte (para deshacerlo)', hechos.join() === 'hecha', hechos.join());
}

console.log('\nEn las pantallas');
{
  const inicio = lee('app/(trainer)/dashboard.tsx');
  ok('en el inicio, con los primeros a la vista', /<PendientesDelCoach\s+tasks=\{tasks\}\s+max=\{5\}/.test(inicio));
  ok('se apuntan como pendientes', /scope: 'pending'/.test(inicio) && /onAdd=\{handleAddPendiente\}/.test(inicio));
  ok('y se editan (texto, notas, borrar)', /<TaskEditSheet task=\{editandoTarea\}/.test(inicio));
  const agenda = lee('app/(trainer)/agenda.tsx');
  ok('en el calendario, y se les puede poner día', /<PendientesDelCoach[\s\S]{0,300}onPonerDia=\{setMovingTask\}/.test(agenda));
  ok('ponerle día lo pasa al calendario', /updateCoachTask\(task\.id, \{ dueDate, scope: 'day' \}\)/.test(agenda));
  ok('la vieja sección "Sin día" ya no está (es esta lista)', !/Sin día · ponles uno/.test(agenda));
  const hoja = lee('components/TaskEditSheet.tsx');
  ok('al editar: "Con día" o "Pendiente"', /texto: 'Con día'/.test(hoja) && /texto: 'Pendiente'/.test(hoja));
  ok('y un pendiente que pasa a tener día, va a hoy', /aUnDia \? \{ dueDate: inicioDelDia\(Date\.now\(\)\) \}/.test(hoja));
  const comp = lee('components/PendientesDelCoach.tsx');
  ok('la tarjeta: apuntar, tachar, destacar y lo hecho plegado', /placeholder=\{t\('Apuntar un pendiente'\)\}/.test(comp) && /onToggle\(task\)/.test(comp) && /onFlag\(task\)/.test(comp) && /verHechos \? hechos\.map\(fila\)/.test(comp));
  ok('el calendario solo pinta tareas con día', /if \(t\.scope !== 'day' \|\| t\.done\) continue;/.test(lee('lib/calendarioCoach.ts')));
}

console.log(fallos === 0 ? '\n✔ Pendientes del entrenador' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
