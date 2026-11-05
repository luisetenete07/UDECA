/**
 * Tres cosas del entreno:
 *
 *  1. El calentamiento lo pone el entrenador, día a día: un vídeo general y
 *     ya, un vídeo por ejercicio o solo ejercicios (o el de siempre).
 *  2. Una serie marcada sin querer se deshace: "Deshacer" al marcarla, o el ✓
 *     otra vez. Se desmarca, se para su descanso y no se pasa solo al
 *     siguiente ejercicio.
 *  3. Tras la última serie de un ejercicio, el descanso es el del SIGUIENTE:
 *     dominadas con 3 min y luego fondos con 2 → tras la última de
 *     dominadas, 2 min.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-calentamiento-y-series.mjs
 */
import { readFileSync } from 'node:fs';
import {
  calentamientoParaGuardar,
  calentamientoParaVer,
  resumenDelCalentamiento,
} from '../lib/calentamiento.ts';
import { bloqueDe, descansoTrasSerie, trasMarcarSerie } from '../lib/superserie.ts';
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
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n1. El calentamiento');
{
  const porDefecto = calentamientoParaVer({});
  ok('sin poner nada, el de siempre (cardio, movilidad, aproximaciones)', !porDefecto.propio && porDefecto.pasos.length === 3 && /Cardio/.test(porDefecto.pasos[0].texto));
  const video = calentamientoParaVer({ calentamiento: { modo: 'video', video: ' https://youtu.be/abc ', nota: 'Entero' } });
  ok('un vídeo general y ya', video.propio && video.video === 'https://youtu.be/abc' && video.pasos.length === 0 && video.nota === 'Entero');
  const videos = calentamientoParaVer({
    calentamiento: {
      modo: 'videos',
      ejercicios: [
        { id: '1', nombre: 'Rotaciones de hombro', cuanto: '2 × 10', video: 'https://youtu.be/x' },
        { id: '2', nombre: 'Escápulas en barra', cuanto: '' },
      ],
    },
    approachesNote: '2 series al 60%',
  });
  ok('un vídeo por ejercicio, cada uno el suyo', videos.pasos[0].video === 'https://youtu.be/x' && !videos.pasos[1].video && videos.pasos[0].cuanto === '2 × 10');
  ok('y las aproximaciones al final, si las hay', videos.pasos[2]?.texto === 'Aproximaciones · 2 series al 60%');
  const soloEj = calentamientoParaVer({ calentamiento: { modo: 'ejercicios', ejercicios: [{ id: '1', nombre: 'Gato-camello', video: 'https://youtu.be/y' }] } });
  ok('solo ejercicios: sin vídeos aunque quedara alguno', !soloEj.pasos[0].video && !soloEj.video);
  ok('vacío vuelve el de siempre', calentamientoParaGuardar({ modo: 'video', video: '  ' }) === undefined && calentamientoParaGuardar({ modo: 'ejercicios', ejercicios: [{ id: '1', nombre: ' ' }] }) === undefined);
  ok('se guarda sin huecos', igual(calentamientoParaGuardar({ modo: 'videos', ejercicios: [{ id: '1', nombre: ' A ', cuanto: ' ', video: ' v ' }, { id: '2', nombre: '' }] }), { modo: 'videos', ejercicios: [{ id: '1', nombre: 'A', video: 'v' }] }));
  ok('el resumen: "2 ejercicios · 1 con vídeo"', resumenDelCalentamiento({ modo: 'videos', ejercicios: [{ id: '1', nombre: 'A', video: 'v' }, { id: '2', nombre: 'B' }] }) === '2 ejercicios · 1 con vídeo');
  const antes = { name: 'P', days: [{ id: 'd', name: 'Empuje', exercises: [] }] };
  const despues = { name: 'P', days: [{ id: 'd', name: 'Empuje', exercises: [], calentamiento: { modo: 'video', video: 'v' } }] };
  ok('cambiarlo avisa al alumno: "Calentamiento"', cambiosDelPlan(antes, despues).dias[0]?.que?.includes('calentamiento'));

  const editor = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('el entrenador elige el modo en cada día', /opciones=\{MODOS_DE_CALENTAMIENTO\}/.test(editor) && /modoDeCalentamiento\(day\.id, v\)/.test(editor));
  ok('con el enlace del vídeo, los ejercicios y sus vídeos', /Enlace del vídeo \(YouTube o Vimeo\)/.test(editor) && /cambiarEjercicioDeCalentamiento\(day\.id, e\.id, \{ video: v \}\)/.test(editor));
  ok('y puede ponerlo en todos los días', /calentamientoEnTodos\(day\.id\)/.test(editor));
  ok('se guarda limpio', /calentamiento: calentamientoParaGuardar\(d\.calentamiento\)/.test(editor));
  const w = lee('app/(client)/workout.tsx');
  ok('el alumno lo ve: el vídeo, y el de cada ejercicio', /const cal = calentamientoParaVer\(day\);/.test(w) && /setVideoAbierto\(\{ url: cal\.video!/.test(w) && /setVideoAbierto\(\{ url: paso\.video!/.test(w));
  ok('el del entrenador sale abierto', /const abierto = cal\.propio \? !warmupOpen : warmupOpen;/.test(w));
}

console.log('\n2. Deshacer una serie marcada sin querer');
{
  const w = lee('app/(client)/workout.tsx');
  ok('al marcarla se apunta qué arrancó (descanso y paso al siguiente)', /ultimaMarcada\.current = \{\s*ejercicio: exerciseIndex,\s*serie: setIndex,\s*restId: restIniciado,\s*avance: avanceIniciado,/.test(w));
  ok('sale "Deshacer" justo debajo de las series (suelta y superserie)', (w.match(/\{barraDeshacer\}\s*\{preguntaDeSerie\(/g) ?? []).length === 2 && />Deshacer</.test(w));
  ok('desmarcarla para su descanso y el paso al siguiente', /if \(u\.avance\) clearTimeout\(u\.avance\);\s*if \(u\.restId !== null\) stopRestSiEs\(u\.restId\);/.test(w));
  ok('y vuelve al ejercicio en que estaba', /updateSet\(u\.ejercicio, u\.serie, 'completed', false\);\s*setViewIndex\(vista\);/.test(w));
  ok('si celebró un récord, se deshace también', /prCelebrados\.current\.delete\(id\);\s*setPrVivo\(null\);/.test(w));
}

console.log('\n3. Tras la última serie, el descanso del siguiente');
{
  const dom = { restSeconds: 180 };
  const fon = { restSeconds: 120 };
  const plan = [dom, fon];
  const hechas = (n, total = 3) => ({ sets: Array.from({ length: total }, (_, i) => ({ completed: i < n })) });
  // Tres series de dominadas: tras la 2ª, las suyas; tras la 3ª, las de fondos.
  const log2 = [hechas(2), hechas(0)];
  const t2 = trasMarcarSerie(log2, plan, 0, 1);
  ok('entre series de dominadas, sus 3 min', descansoTrasSerie(plan, log2, bloqueDe(plan, 0, 2), 1, t2.siguiente, t2.bloqueTerminado) === 180);
  const log3 = [hechas(3), hechas(0)];
  const t3 = trasMarcarSerie(log3, plan, 0, 2);
  ok('tras la última de dominadas, los 2 min de fondos', t3.bloqueTerminado && descansoTrasSerie(plan, log3, bloqueDe(plan, 0, 2), 2, t3.siguiente, t3.bloqueTerminado) === 120);
  const sinDescanso = [dom, {}];
  ok('si el siguiente no tiene descanso puesto, el suyo', descansoTrasSerie(sinDescanso, log3, bloqueDe(sinDescanso, 0, 2), 2, t3.siguiente, true) === 180);
  const fin = [hechas(3), hechas(3)];
  const tf = trasMarcarSerie(fin, plan, 1, 2);
  ok('la última de la sesión, la suya (no hay siguiente)', descansoTrasSerie(plan, fin, bloqueDe(plan, 1, 2), 2, tf.siguiente, tf.bloqueTerminado) === 120);
  // Siguiente en superserie: el descanso de la superserie.
  const planSs = [dom, { restSeconds: 0 }, { restSeconds: 90, supersetWithPrevious: true }];
  const logSs = [hechas(3), hechas(0), hechas(0)];
  const ts = trasMarcarSerie(logSs, planSs, 0, 2);
  ok('si lo siguiente es una superserie, el de la superserie', descansoTrasSerie(planSs, logSs, bloqueDe(planSs, 0, 3), 2, ts.siguiente, ts.bloqueTerminado) === 90);
}

console.log(fallos === 0 ? '\n✔ Calentamiento, deshacer series y descanso de transición' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
