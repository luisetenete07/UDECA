/**
 * Las llamadas grupales: el entrenador programa una con todos sus alumnos y
 * cada uno la tiene FIJADA en su inicio desde los días antes que él elija
 * hasta que termina, con su aviso al móvil.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-llamada-grupal.mjs
 */
import { readFileSync } from 'node:fs';
import {
  avisarAlCrear,
  avisosDeGrupal,
  cambioQueAvisar,
  esHoraDeEntrar,
  estaFijada,
  faltaPara,
  fijadaDesde,
  fijadasAhora,
  grupalesSinVer,
  grupalParaGuardar,
  HORA_DEL_AVISO,
  problemaDeGrupal,
  ultimaEnLlegar,
} from '../lib/llamadaGrupal.ts';
import { inicioDelDia, masDias } from '../lib/fechas.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

const H = 3600_000;
// Sábado 7 de noviembre de 2026, 11:00. La llamada, el jueves 19 a las 19:00.
const AHORA = new Date(2026, 10, 7, 11).getTime();
const JUEVES = new Date(2026, 10, 19, 19).getTime();
const llamada = (extra = {}) => ({
  id: 'g1',
  trainerId: 'coach',
  titulo: 'Preguntas y respuestas',
  inicio: JUEVES,
  duracionMin: 60,
  diasAntes: 7,
  createdAt: AHORA,
  ...extra,
});

console.log('\nFijada desde los días antes que elige el entrenador, hasta que termina');
{
  const l = llamada();
  ok('con 7 días: desde las 00:00 del jueves anterior', fijadaDesde(l) === inicioDelDia(new Date(2026, 10, 12)));
  ok('hoy, 12 días antes, aún no sale', !estaFijada(l, AHORA));
  ok('el jueves anterior a primera hora, ya sale', estaFijada(l, new Date(2026, 10, 12, 0, 1).getTime()));
  ok('y el mismo día, a la hora, también (es cuando se entra)', estaFijada(l, JUEVES + 10 * 60_000));
  ok('al terminar, se va', !estaFijada(l, JUEVES + 61 * 60_000));
  ok('con "el mismo día": desde las 00:00 de ese día', fijadaDesde(llamada({ diasAntes: 0 })) === inicioDelDia(JUEVES));
  const otra = llamada({ id: 'g2', inicio: JUEVES - 2 * 86400_000, diasAntes: 1 });
  ok('las fijadas, la más próxima primero', fijadasAhora([l, otra], JUEVES - 2 * 86400_000 - 3 * H).map((x) => x.id).join() === 'g2,g1');
}

console.log('\nEl aviso al móvil');
{
  ok('creada antes de tocar fijarse: no se avisa al crearla', !avisarAlCrear(llamada(), AHORA));
  const lejos = avisosDeGrupal(llamada(), AHORA);
  const diaDeFijarse = inicioDelDia(new Date(2026, 10, 12));
  ok(
    'el móvil del alumno avisa el día que se fija (a las 10:00, no a medianoche) y una hora antes',
    lejos.length === 2 && lejos[0].tipo === 'fijada' && lejos[0].cuando === diaDeFijarse + HORA_DEL_AVISO * H && lejos[1].tipo === 'una-hora' && lejos[1].cuando === JUEVES - H
  );
  const dentro = llamada({ createdAt: new Date(2026, 10, 15, 9).getTime() });
  ok('creada ya dentro de esos días: se avisa al crearla', avisarAlCrear(dentro, dentro.createdAt));
  ok('y el móvil no repite el de "fijada", solo el de una hora antes', avisosDeGrupal(dentro, dentro.createdAt).map((a) => a.tipo).join() === 'una-hora');
  const temprano = llamada({ inicio: new Date(2026, 10, 19, 9, 30).getTime(), diasAntes: 0, createdAt: AHORA });
  ok('si se fija el mismo día y la llamada es temprano, solo el de una hora antes', avisosDeGrupal(temprano, AHORA).map((a) => a.tipo).join() === 'una-hora');
  ok('lo que ya ha pasado no se programa', avisosDeGrupal(llamada(), JUEVES - 30 * 60_000).length === 0);
}

console.log('\nLa campana');
{
  const l = llamada();
  const fijada = new Date(2026, 10, 13, 9).getTime();
  ok('antes de fijarse no cuenta', grupalesSinVer([l], undefined, AHORA) === 0);
  ok('fijada y sin mirar, cuenta 1', grupalesSinVer([l], AHORA, fijada) === 1);
  ok('mirada después de llegar, ya no', grupalesSinVer([l], fijada, fijada + H) === 0);
  ok('hasta dónde se da por visto: el día que llegó', ultimaEnLlegar([l], fijada) === fijadaDesde(l));
}

console.log('\nCuánto falta y cuándo se entra');
{
  const l = llamada();
  ok('12 días', JSON.stringify(faltaPara(l, AHORA)) === '{"cuando":"dias","n":12}');
  ok('mañana', faltaPara(l, new Date(2026, 10, 18, 20).getTime()).cuando === 'manana');
  ok('hoy', faltaPara(l, new Date(2026, 10, 19, 8).getTime()).cuando === 'hoy');
  ok('en 20 min', JSON.stringify(faltaPara(l, JUEVES - 20 * 60_000)) === '{"cuando":"minutos","n":20}');
  ok('en directo', faltaPara(l, JUEVES + 60_000).cuando === 'directo');
  ok('el botón de entrar se resalta un cuarto de hora antes', !esHoraDeEntrar(l, JUEVES - 20 * 60_000) && esHoraDeEntrar(l, JUEVES - 10 * 60_000));
}

console.log('\nLo que escribe el entrenador');
{
  const b = { titulo: '  Q&A  ', nota: '  ', enlace: ' https://meet.google.com/x ', inicio: JUEVES, duracionMin: 60, diasAntes: 7 };
  ok('bien hecha, sin problema', problemaDeGrupal(b, AHORA) === null);
  ok('sin título, no', problemaDeGrupal({ ...b, titulo: ' ' }, AHORA) === 'sin-titulo');
  ok('en el pasado, no', problemaDeGrupal({ ...b, inicio: AHORA - H }, AHORA) === 'pasada');
  ok('con un enlace que no es un enlace, no', problemaDeGrupal({ ...b, enlace: 'meet.google.com/x' }, AHORA) === 'enlace');
  ok('sin enlace, sí (el entrenador dirá por dónde)', problemaDeGrupal({ ...b, enlace: '' }, AHORA) === null);
  const g = grupalParaGuardar(b);
  ok('se guarda recortada y sin la nota vacía', g.titulo === 'Q&A' && g.enlace === 'https://meet.google.com/x' && !('nota' in g));
  ok('cambiar la hora o el enlace se avisa', cambioQueAvisar(b, { ...b, inicio: JUEVES + H }) && cambioQueAvisar(b, { ...b, enlace: 'https://zoom.us/j/1' }));
  ok('cambiar la nota o desde cuándo se fija, no', !cambioQueAvisar(b, { ...b, nota: 'Otra', diasAntes: 3 }));
}

console.log('\nConectado en la app');
{
  const d = lee('app/(client)/dashboard.tsx');
  ok('el inicio del alumno las enseña fijadas', /grupalesFijadas\.map\(\(l\) =>[\s\S]{0,120}<LlamadaGrupalFijada llamada=\{l\}/.test(d));
  ok('antes que la acción del día', d.indexOf('<LlamadaGrupalFijada') < d.indexOf("router.push('/(client)/workout')"));
  ok('programa sus avisos y suma a la campana', /programarAvisosDeGrupales\(lista\)/.test(d) && /grupalesSinVer\(grupales, profile\?\.avisosVistos\)/.test(d));
  const n = lee('app/(client)/notificaciones.tsx');
  ok('y salen en sus notificaciones, que las dan por vistas', /<LlamadaGrupalFijada key=\{l\.id\} llamada=\{l\}/.test(n) && /ultimaEnLlegar\(deSuEntrenador\)/.test(n));
  const c = lee('app/(trainer)/llamadas.tsx');
  ok('el entrenador las programa, cambia y cancela', /crearLlamadaGrupal\(profile\.uid, b\)/.test(c) && /editarLlamadaGrupal\(antes\.id, b\)/.test(c) && /borrarLlamadaGrupal\(l\.id\)/.test(c));
  ok('y avisa a todos sus alumnos cuando toca', /if \(avisarAlCrear\(l\)\)/.test(c) && /for \(const x of alumnos\) sendPushNotification\(x\.pushToken/.test(c));
  ok('salen en su calendario', /eventosPorDia\(clients, cycles, dayTasks, Date\.now\(\), llamadas, grupales\)/.test(lee('app/(trainer)/agenda.tsx')) && /grupales=\{grupales\}/.test(lee('app/(trainer)/dashboard.tsx')));
  const r = lee('firestore.rules');
  ok('las reglas: las lee quien lo tiene de entrenador, y solo él las escribe', /match \/llamadasGrupales\/\{id\}/.test(r) && /resource\.data\.trainerId == miEntrenador\(\)/.test(r));
  ok('con su índice', /"collectionGroup": "llamadasGrupales"/.test(readFileSync('firestore.indexes.json', 'utf8')));
  ok('y se borran con la cuenta del entrenador', /coleccion: 'llamadasGrupales', campo: 'trainerId'/.test(lee('lib/firestore/eraseAccount.ts')));
}

console.log(fallos === 0 ? '\n✔ Llamadas grupales' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
