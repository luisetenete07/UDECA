/**
 * Las notificaciones del alumno: lo que su entrenador ha cambiado del plan.
 *
 * Al guardar la rutina, un aviso con los DÍAS tocados —todos, si son varios—,
 * cada uno con sus ejercicios y lo que cambió. Guardar sin cambiar nada no
 * avisa. El alumno lo ve en "Notificaciones" (la campana del inicio).
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-avisos-del-plan.mjs
 */
import { readFileSync } from 'node:fs';
import {
  avisosSinVer,
  cambiosDelPlan,
  cuantoDelEjercicio,
  hayCambios,
  nombreDelDiaDelAviso,
  resumenDelDia,
  textoDelAviso,
  textoDelCambio,
} from '../lib/avisosDelPlan.ts';
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

const dom = { id: 'e1', exerciseId: 'dom', name: 'Dominadas', sets: 3, reps: '8' };
const fon = { id: 'e2', exerciseId: 'fon', name: 'Fondos', sets: 3, reps: '10', restSeconds: 90 };
const pla = { id: 'e3', exerciseId: 'pla', name: 'Plancha', sets: 3, reps: '', seconds: '30', measure: 'seconds' };
const plan = {
  name: 'Fuerza',
  schedule: 'weekly',
  days: [
    { id: 'd1', name: 'Empuje', weekday: 0, exercises: [dom, fon] },
    { id: 'd2', name: 'Pierna', weekday: 2, exercises: [pla] },
    { id: 'd3', name: 'Día 3', weekday: 4, exercises: [dom] },
  ],
};

console.log('\nNada cambiado, nada que avisar');
{
  const c = cambiosDelPlan(plan, copia(plan));
  ok('guardar tal cual', !hayCambios(c), JSON.stringify(c));
  // Lo vacío es lo mismo que no ponerlo: el editor guarda una cosa u otra.
  const conVacios = copia(plan);
  conVacios.days[0].exercises[0] = { ...dom, notes: '', supersetWithPrevious: false, rir: undefined };
  ok('un "" o un false donde no había nada no es un cambio', !hayCambios(cambiosDelPlan(plan, conVacios)));
  const interno = copia(plan);
  interno.days[0].exercises[0].muscleGroup = 'Tirón';
  ok('ni lo que el alumno no ve (el grupo muscular)', !hayCambios(cambiosDelPlan(plan, interno)));
}

console.log('\nEl día exacto, y lo que cambió dentro');
{
  const ahora = copia(plan);
  ahora.days[0].exercises[0].sets = 4;
  ahora.days[0].exercises[1].restSeconds = 120;
  ahora.days[0].exercises[1].notes = 'Lento al bajar';
  const c = cambiosDelPlan(plan, ahora);
  ok('solo el lunes', c.dias.length === 1 && c.dias[0].dayId === 'd1' && c.dias[0].estado === 'cambiado');
  ok('se llama "Lunes · Empuje"', nombreDelDiaDelAviso(c.dias[0]) === 'Lunes · Empuje', nombreDelDiaDelAviso(c.dias[0]));
  const [d, f] = c.dias[0].ejercicios;
  ok('el día entero va dentro, como quedó', c.dias[0].ejercicios.length === 2 && d.cuanto === '4 × 8');
  ok('las series: "3 × 8 → 4 × 8"', d.estado === 'cambiado' && d.antes === '3 × 8' && textoDelCambio(d) === '3 × 8 → 4 × 8', textoDelCambio(d));
  ok('lo demás, dicho: "Descanso y nota"', f.estado === 'cambiado' && textoDelCambio(f) === 'Descanso y nota', textoDelCambio(f));
  ok('en una línea: "2 cambiados"', resumenDelDia(c.dias[0]) === '2 cambiados', resumenDelDia(c.dias[0]));
  ok('el móvil dice qué día', textoDelAviso('Fuerza', c, false) === 'Tu entrenador ha cambiado Lunes · Empuje', textoDelAviso('Fuerza', c, false));
}

console.log('\nVarios días: salen todos');
{
  const ahora = copia(plan);
  ahora.days[0].exercises.push({ id: 'e9', exerciseId: 'rem', name: 'Remo', sets: 3, reps: '12' });
  ahora.days[1].exercises = [];
  ahora.days[2].name = 'Tirón';
  ahora.days.push({ id: 'd4', name: 'Core', weekday: 5, exercises: [pla] });
  const c = cambiosDelPlan(plan, ahora);
  ok('los cuatro, en el orden del plan', c.dias.map((d) => d.dayId).join() === 'd1,d2,d3,d4', c.dias.map((d) => d.dayId).join());
  ok('uno nuevo en el lunes', c.dias[0].ejercicios.find((e) => e.nombre === 'Remo')?.estado === 'nuevo' && resumenDelDia(c.dias[0]) === '1 nuevo');
  ok('uno quitado en el miércoles', c.dias[1].quitados?.[0] === 'Plancha' && resumenDelDia(c.dias[1]) === '1 quitado');
  ok('el viernes cambia de nombre', c.dias[2].que?.includes('nombre') && nombreDelDiaDelAviso(c.dias[2]) === 'Viernes · Tirón');
  ok('y el sábado es nuevo', c.dias[3].estado === 'nuevo' && resumenDelDia(c.dias[3]) === 'Día nuevo · 1 ejercicio');
  ok('con muchos, el móvil los cuenta', textoDelAviso('Fuerza', c, false) === 'Tu entrenador ha cambiado 4 días de tu plan');
  const tres = cambiosDelPlan(plan, { ...ahora, days: ahora.days.slice(0, 3) });
  ok('con tres, los nombra', textoDelAviso('Fuerza', tres, false) === 'Tu entrenador ha cambiado Lunes · Empuje, Miércoles · Pierna y Viernes · Tirón', textoDelAviso('Fuerza', tres, false));
}

console.log('\nDías quitados, orden y ejercicio cambiado por otro');
{
  const ahora = copia(plan);
  ahora.days = [ahora.days[0], ahora.days[1]];
  ahora.days[0].exercises.reverse();
  ahora.days[1].exercises[0] = { ...pla, exerciseId: 'hol', name: 'Hollow' };
  const c = cambiosDelPlan(plan, ahora);
  const quitado = c.dias.find((d) => d.dayId === 'd3');
  ok('el día quitado sale, al final', quitado?.estado === 'quitado' && c.dias[c.dias.length - 1] === quitado && resumenDelDia(quitado) === 'Ya no está en tu plan');
  ok('mover ejercicios es un cambio: "Orden de los ejercicios"', c.dias[0].que?.includes('orden') && /Orden de los ejercicios/.test(resumenDelDia(c.dias[0])));
  const h = c.dias[1].ejercicios[0];
  ok('cambiar un ejercicio por otro: "Antes: Plancha"', h.nombre === 'Hollow' && textoDelCambio(h) === 'Antes: Plancha', textoDelCambio(h));
}

console.log('\nEl plan en general, y un plan nuevo');
{
  const ahora = { ...copia(plan), name: 'Fuerza 2', modoAlumno: 'tabla' };
  const c = cambiosDelPlan(plan, ahora);
  ok('el nombre y la vista en tabla', c.dias.length === 0 && c.ajustes.join() === 'nombre,vista', c.ajustes.join());
  ok('sin días, el móvil lo dice igual', textoDelAviso('Fuerza 2', c, false) === 'Tu entrenador ha cambiado los ajustes de tu plan: Fuerza 2');
  const ciclo = { ...copia(plan), schedule: 'cycle', cycleStartDate: 1 };
  ok('la fecha del ciclo', cambiosDelPlan(ciclo, { ...ciclo, cycleStartDate: 2 }).ajustes.join() === 'fecha');
  const enCiclo = copia(ciclo);
  enCiclo.days[1].exercises[0].sets = 5;
  enCiclo.days[2].exercises[0].sets = 5;
  const dc = cambiosDelPlan(ciclo, enCiclo).dias;
  ok('en un ciclo, el número del día: "Día 2 · Pierna", "Día 3"', nombreDelDiaDelAviso(dc[0]) === 'Día 2 · Pierna' && nombreDelDiaDelAviso(dc[1]) === 'Día 3', dc.map(nombreDelDiaDelAviso).join());
  const nuevo = cambiosDelPlan(null, plan);
  ok('plan nuevo: todos sus días', nuevo.dias.length === 3 && nuevo.dias.every((d) => d.estado === 'nuevo' && d.ejercicios.length > 0));
  ok('"Tu entrenador te ha preparado un plan nuevo: Fuerza"', textoDelAviso('Fuerza', nuevo, true) === 'Tu entrenador te ha preparado un plan nuevo: Fuerza');
}

console.log('\nCómo se escribe lo que hay que hacer');
{
  ok('"3 × 30 s"', cuantoDelEjercicio(pla) === '3 × 30 s');
  ok('con la medida de la biblioteca', cuantoDelEjercicio({ ...pla, measure: undefined, seconds: undefined, reps: '45' }, 'seconds') === '3 × 45 s');
  ok('"3 × 8 + 20 s" en los combinados', cuantoDelEjercicio({ ...dom, measure: 'combo', seconds: '20' }) === '3 × 8 + 20 s');
  ok('"3 × 8/6" por lados', cuantoDelEjercicio({ ...dom, measure: 'repsDual', side2: '6' }) === '3 × 8/6');
}

console.log('\nLo visto');
{
  const avisos = [{ cuando: 300 }, { cuando: 200 }, { cuando: 100 }];
  ok('sin ver nada, todos', avisosSinVer(avisos, undefined) === 3);
  ok('visto hasta 200, uno', avisosSinVer(avisos, 200) === 1);
}

console.log('\nEn las pantallas y los datos');
{
  const editor = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('el editor mira qué cambió antes de guardar', /const cambios = cambiosDelPlan\(nuevo \? null : planAlAbrir\.current, plan, medidaDe\);/.test(editor));
  ok('con el plan como se guardaría al abrir, no como vino', /planAlAbrir\.current = routineId \? planComoSeGuarda\(\) : null;/.test(editor));
  ok('y solo avisa si cambió algo', /if \(nuevo \|\| !conDetalle \|\| hayCambios\(cambios\)\)/.test(editor) && /apuntarAvisoDelPlan\(\{ trainerId: profile\.uid, clientId, routineId: guardadaId/.test(editor));
  ok('el aviso del móvil dice los días y abre las notificaciones', /textoDelAviso\(name, cambios, nuevo\)/.test(editor) && (editor.match(/\{ abrir: 'notificaciones' \}/g) ?? []).length === 2);
  ok('aplicar a otros: para ellos, plan nuevo', /cambiosDelPlan\(null, planComoSeGuarda\(dias\), medidaDe\)/.test(editor));
  const inicio = lee('app/(client)/dashboard.tsx');
  ok('la campana del inicio, con las nuevas', /router\.push\('\/\(client\)\/notificaciones'\)/.test(inicio) && /avisosSinVer\(avisos, profile\.avisosVistos\)/.test(inicio));
  const pantalla = lee('app/(client)/notificaciones.tsx');
  ok('la pantalla: cada día, con lo que cambió', /a\.dias\.map\(\(d\) =>/.test(pantalla) && /textoDelCambio\(e\)/.test(pantalla) && /nombreDelDiaDelAviso\(d\)/.test(pantalla));
  ok('y al entrar, todo visto', /updateUserProfile\(uid, \{ avisosVistos: hasta \}\)/.test(pantalla));
  ok('registrada sin pestaña', /<Tabs\.Screen name="notificaciones" options=\{\{ href: null \}\} \/>/.test(lee('app/(client)/_layout.tsx')));
  ok('tocar el aviso del móvil la abre', /data\?\.abrir !== 'notificaciones'/.test(lee('components/AbrirDesdeAviso.tsx')));
  const reglas = lee('firestore.rules');
  ok('las reglas: las apunta su entrenador, con la hora del servidor', /match \/avisosDelPlan\/\{id\}/.test(reglas) && /\$\(request\.resource\.data\.clientId\)\)\.data\.get\('trainerId', ''\) == request\.auth\.uid/.test(reglas));
  const borrar = lee('lib/firestore/eraseAccount.ts');
  ok('y se borran con la cuenta (de los dos)', /coleccion: 'avisosDelPlan', campo: 'clientId'/.test(borrar) && /coleccion: 'avisosDelPlan', campo: 'trainerId'/.test(borrar));
  ok('con su índice', /"collectionGroup": "avisosDelPlan"[\s\S]{0,160}"fieldPath": "cuando"/.test(lee('firestore.indexes.json')));
  // stripUndefined rehace los objetos: la marca de la hora del servidor dejaría de serlo y las reglas lo rechazarían.
  ok('la hora del servidor va fuera de la limpieza', /\}\),\s*cuando: serverTimestamp\(\),\s*\}\);/.test(lee('lib/firestore/avisos.ts')));
}

console.log(fallos === 0 ? '\n✔ Notificaciones del plan' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
