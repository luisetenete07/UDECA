/**
 * Los hábitos del entrenador, en su panel, encima de los pendientes.
 *
 * Cada uno guarda los días en que se marcó: hecho hoy es que esté el de hoy,
 * así que al día siguiente sale sin marcar solo. Con los días, la racha y la
 * semana.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-habitos-coach.mjs
 */
import { readFileSync } from 'node:fs';
import { conHoyAlternado, DIAS_GUARDADOS, habitos, hechoHoy, racha, resumenDeHoy, ultimaSemana } from '../lib/habitosCoach.ts';
import { inicioDelDia, masDias } from '../lib/fechas.ts';
import { esPendiente } from '../lib/pendientes.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

const AHORA = new Date(2026, 10, 7, 9).getTime();
const hoy = inicioDelDia(AHORA);
const ayer = masDias(hoy, -1);

console.log('\nMarcar y que mañana salga sin marcar');
{
  const dias = conHoyAlternado([], AHORA);
  ok('marcar hoy apunta el día de hoy', dias.length === 1 && dias[0] === hoy);
  ok('y está hecho hoy', hechoHoy({ dias }, AHORA));
  const manana = masDias(hoy, 1) + 8 * 3600_000;
  ok('al día siguiente, sin marcar (sin tocar nada)', !hechoHoy({ dias }, manana));
  ok('desmarcar hoy lo quita', conHoyAlternado(dias, AHORA).length === 0);
  ok('no se acumulan para siempre', conHoyAlternado(Array.from({ length: 200 }, (_, i) => masDias(hoy, -i - 1)), AHORA).length === DIAS_GUARDADOS);
}

console.log('\nLa racha y la semana');
{
  const tres = [masDias(hoy, -2), ayer, hoy];
  ok('tres días seguidos con hoy: 3', racha(tres, AHORA) === 3);
  ok('sin hoy todavía, la racha sigue viva hasta ayer', racha([masDias(hoy, -2), ayer], AHORA) === 2);
  ok('un hueco la corta', racha([masDias(hoy, -3), ayer], AHORA) === 1);
  ok('sin nada, 0', racha([], AHORA) === 0);
  const semana = ultimaSemana(tres, AHORA);
  ok('la semana: siete días, el último hoy', semana.length === 7 && semana[6].dia === hoy && semana[6].hecho && semana[5].hecho && !semana[0].hecho);
  ok('hoy, 2 de 3', JSON.stringify(resumenDeHoy([{ dias: [hoy] }, { dias: [ayer] }, { dias: [hoy, ayer] }], AHORA)) === '{"hechos":2,"total":3}');
}

console.log('\nNo se mezclan con lo demás');
{
  const tareas = [
    { id: 'h2', scope: 'habit', order: 2, title: 'Leer' },
    { id: 'p', scope: 'pending', order: 1, title: 'Llamar' },
    { id: 'h1', scope: 'habit', order: 1, title: 'Grabar' },
  ];
  ok('solo los hábitos, en su orden', habitos(tareas).map((t) => t.id).join() === 'h1,h2');
  ok('un hábito no es un pendiente', !esPendiente({ scope: 'habit' }));
  ok('ni sale en el calendario', /if \(t\.scope !== 'day' \|\| t\.done\) continue;/.test(lee('lib/calendarioCoach.ts')));
}

console.log('\nEn el panel del entrenador');
{
  const d = lee('app/(trainer)/dashboard.tsx');
  ok('justo encima de los pendientes', /<HabitosDelCoach[\s\S]{0,400}<\/FadeIn>[\s{}]*<FadeIn delay=\{240\}>\s*<PendientesDelCoach/.test(d));
  ok('marcar guarda los días', /const dias = conHoyAlternado\(h\.dias\);/.test(d) && /updateCoachTask\(h\.id, \{ dias \}\)/.test(d));
  ok('y se crean como hábitos', /scope: 'habit', done: false, dias: \[\]/.test(d));
  const c = lee('components/HabitosDelCoach.tsx');
  ok('la tarjeta: anillo del día, círculo para marcar, racha y semana', /<ProgressRing progress=\{hechos \/ total\}/.test(c) && /accessibilityRole="checkbox"/.test(c) && /racha\(h\.dias\)/.test(c) && /ultimaSemana\(h\.dias\)/.test(c));
  ok('y se cambian o se borran', /onRename\(editando, nombre\.trim\(\)\)/.test(c) && /onDelete\(editando\)/.test(c));
}

console.log(fallos === 0 ? '\n✔ Hábitos del entrenador' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
