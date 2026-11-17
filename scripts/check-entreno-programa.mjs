/**
 * ENTRENO SIN DIRECTO (lib/modoDeEntreno.ts): el programa a la vista, los
 * tiempos que puso el entrenador de un toque y apuntar una marca si se quiere.
 *
 * Lo que se protege: que el alumno vea su plan entero con la técnica, que el
 * descanso que se cuenta sea el del entrenador, que un día EMOM tenga su
 * contador con las rondas bien sacadas del plan y que no se pierda al cerrar
 * la app, que una marca no se pierda ni multiplique entrenos, y que nada de la
 * app siga contando "entrenos" que ya no se apuntan (la racha, "sin entrenar",
 * el aviso de olvido).
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-entreno-programa.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import {
  arrancarEmom,
  avisoAlPasar,
  cuantoDe,
  emomParado,
  intervaloDelDia,
  leerEmom,
  MAX_RONDAS,
  momentoDelEmom,
  pausarEmom,
  PREVIA_MS,
  proximasRondas,
  rondasDelEmom,
  segundosQueSeVen,
  transcurridoEmom,
} from '../lib/emom.ts';
import { conMarca, ejercicioDeLaMarca, limpiarCifra, marcaValida, queSePide, registroDeHoy } from '../lib/apuntarMarca.ts';
import { SE_APUNTA_EL_ENTRENO } from '../lib/modoDeEntreno.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

console.log('\nEl EMOM: las rondas salen del plan');
{
  const dom = { sets: 5 };
  const fon = { sets: 5 };
  ok('un ejercicio: tantas rondas como series', rondasDelEmom([{ sets: 10 }]).length === 10);
  const turnos = rondasDelEmom([dom, fon]);
  ok('dos ejercicios se turnan: uno el minuto impar, otro el par', turnos.length === 10 && JSON.stringify(turnos.slice(0, 4)) === '[[0],[1],[0],[1]]');
  const desigual = rondasDelEmom([{ sets: 3 }, { sets: 1 }]);
  ok('al que se le acaban las series deja de salir', JSON.stringify(desigual) === '[[0],[1],[0],[0]]');
  const ss = rondasDelEmom([{ sets: 4 }, { sets: 4, supersetWithPrevious: true }, { sets: 2 }]);
  ok('una superserie va entera en la misma ronda', JSON.stringify(ss) === '[[0,1],[2],[0,1],[2],[0,1],[0,1]]');
  ok(`como mucho ${MAX_RONDAS} rondas`, rondasDelEmom([{ sets: 500 }]).length === MAX_RONDAS);
  ok('sin series puestas, una', rondasDelEmom([{ sets: 0 }]).length === 1);
  ok('cada minuto, si el entrenador no dice otra cosa', intervaloDelDia({}) === 60 && intervaloDelDia({ emomSegundos: 45 }) === 45 && intervaloDelDia({ emomSegundos: 3 }) === 60);
  ok('lo que toca, en su medida', cuantoDe({ reps: '5' }, 'reps') === '5 reps' && cuantoDe({ reps: '', seconds: '20' }, 'seconds') === '20 s' && cuantoDe({ reps: '6', side2: '6' }, 'repsDual') === '6 + 6 reps' && cuantoDe({ reps: 'Máx' }, 'reps') === 'Máx');
}

console.log('\nEl EMOM: el contador');
{
  const t0 = 1_000_000;
  ok('primero, unos segundos para colocarse', momentoDelEmom(0, 60, 10).fase === 'previa' && segundosQueSeVen(momentoDelEmom(0, 60, 10)) === PREVIA_MS / 1000);
  const r1 = momentoDelEmom(PREVIA_MS, 60, 10);
  ok('la primera ronda empieza con su minuto entero', r1.fase === 'ronda' && r1.ronda === 0 && segundosQueSeVen(r1) === 60);
  const r3 = momentoDelEmom(PREVIA_MS + 2 * 60_000 + 18_000, 60, 10);
  ok('a los 2:18, ronda 3 con 42 s por delante', r3.fase === 'ronda' && r3.ronda === 2 && segundosQueSeVen(r3) === 42);
  ok('al acabar la última, terminado', momentoDelEmom(PREVIA_MS + 10 * 60_000, 60, 10).fase === 'fin');
  let e = arrancarEmom(emomParado('d1'), t0);
  e = pausarEmom(e, t0 + 30_000);
  ok('en pausa no corre', transcurridoEmom(e, t0 + 999_000) === 30_000);
  e = arrancarEmom(e, t0 + 100_000);
  ok('al seguir, suma lo de antes', transcurridoEmom(e, t0 + 110_000) === 40_000);
  ok('sobrevive a cerrar la app', transcurridoEmom(leerEmom(JSON.stringify(e), 'd1'), t0 + 160_000) === 90_000);
  ok('lo guardado de otro día no vale aquí', leerEmom(JSON.stringify(e), 'd2').desde === null && leerEmom('{roto', 'd1').acumulado === 0);
  const m = (ms) => momentoDelEmom(ms, 60, 10);
  ok('suena al empezar cada ronda', avisoAlPasar(m(PREVIA_MS + 59_900), m(PREVIA_MS + 60_100)) === 'ronda' && avisoAlPasar(m(PREVIA_MS - 100), m(PREVIA_MS + 100)) === 'ronda');
  ok('y en los tres últimos segundos', avisoAlPasar(m(PREVIA_MS + 56_900), m(PREVIA_MS + 57_100)) === 'cuenta' && avisoAlPasar(m(PREVIA_MS + 20_900), m(PREVIA_MS + 21_100)) === null);
  ok('al acabar, una vez', avisoAlPasar(m(PREVIA_MS + 599_900), m(PREVIA_MS + 600_100)) === 'fin' && avisoAlPasar(m(PREVIA_MS + 600_100), m(PREVIA_MS + 601_000)) === null);
  ok('al volver a la pantalla no pita por lo que ya pasó', avisoAlPasar(null, m(PREVIA_MS + 60_100)) === null);
  const prox = proximasRondas(PREVIA_MS + 125_000, 60, 10, 40);
  ok('los avisos del sistema: las rondas que faltan y el final', prox.length === 8 && prox[0].ronda === 3 && prox[0].enMs === 55_000 && prox.at(-1).ronda === 10);
  ok('sin pasar del tope de avisos', proximasRondas(0, 30, 60, 40).length === 40);
  const contador = lee('components/ContadorEmom.tsx');
  ok('al pausar o reiniciar se quitan los avisos', (contador.match(/quitarAvisosDelEmom\(\)/g) ?? []).length === 2);
  ok('mientras corre, la pantalla no se apaga', /useKeepAwake\('emom'/.test(contador) && /\{corriendo \? <PantallaEncendida \/> : null\}/.test(contador));
  ok('se guarda en el móvil', /AsyncStorage\.setItem\(CLAVE_EMOM, JSON\.stringify\(nuevo\)\)/.test(contador));
  const avisos = lee('lib/notifications.ts');
  ok('con la app abierta, la ronda suena sin taparla con un cartel', /shouldShowBanner: !ronda/.test(avisos) && /shouldPlaySound: true/.test(avisos));
  const editor = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('el entrenador elige cada cuánto empieza una ronda', /opciones=\{INTERVALOS\.map/.test(editor) && /cambiarIntervaloDelEmom\(day\.id, Number\(v\)\)/.test(editor));
  ok('y ve cuántas rondas verá el alumno', /resumenDelEmom\(rondasDelEmom\(day\.exercises\)\.length, intervaloDelDia\(day\)\)/.test(editor));
}

console.log('\nApuntar una marca');
{
  ok('una cifra es una cifra', limpiarCifra('12') === '12' && limpiarCifra('7,5') === '7.5' && limpiarCifra('doce') === '');
  ok('sin cifra (o a cero) no se guarda', !marcaValida({ valor: '' }) && !marcaValida({ valor: '0' }) && marcaValida({ valor: '8' }));
  ok('en un isométrico se piden segundos', queSePide('seconds') === 'segundos' && queSePide('reps') === 'repeticiones');
  const marca = { exerciseId: 'dom', name: 'Dominadas', valor: '12', kg: '10', load: 'weighted', nota: ' fácil ' };
  const ej = ejercicioDeLaMarca(marca);
  ok('se guarda como una serie hecha, con su lastre y su nota', ej.sets.length === 1 && ej.sets[0].completed && ej.sets[0].reps === '12' && ej.sets[0].weight === '10' && ej.notes === 'fácil');
  const otra = conMarca([ej], { exerciseId: 'dom', name: 'Dominadas', valor: '10' });
  ok('otra del mismo ejercicio es una serie más, no otro ejercicio', otra.length === 1 && otra[0].sets.length === 2);
  const fondos = conMarca(otra, { exerciseId: 'fon', name: 'Fondos', valor: '15' });
  ok('la de otro ejercicio entra al final', fondos.length === 2 && fondos[1].exerciseId === 'fon');
  const ahora = new Date(2026, 10, 17, 18).getTime();
  const logs = [
    { id: 'a', routineId: 'r', dayName: 'Empuje', date: ahora - 3600_000, exercises: [] },
    { id: 'b', routineId: 'r', dayName: 'Empuje', date: ahora - 86_400_000, exercises: [] },
    { id: 'g', routineId: 'r', dayName: 'Empuje', date: ahora, gtg: { objetivo: 6 }, exercises: [] },
  ];
  ok('las marcas de hoy van juntas en el registro de hoy', registroDeHoy(logs, 'r', 'Empuje', ahora)?.id === 'a');
  ok('ni en el de ayer, ni en uno de grease the groove', registroDeHoy(logs.slice(1), 'r', 'Empuje', ahora) === undefined);
  const hoja = lee('components/ApuntarMarca.tsx');
  ok('si ya hay registro hoy, se añade a él; si no, se crea', /if \(hoy\) \{[\s\S]*updateWorkoutLog\(hoy\.id, \{ exercises \}\)[\s\S]*\} else \{[\s\S]*createWorkoutLog\(datos\)/.test(hoja));
}

console.log('\nLa pantalla de Entreno');
{
  const w = lee('app/(client)/workout.tsx');
  ok('el entreno en directo ya no está: ni "Empezar entreno" ni series', !/Empezar entreno|Lo he hecho|FilaDeSerie|handleSave/.test(w));
  ok('ni esconde las pestañas', !/tabBarStyle: \{ display: 'none' \}/.test(w));
  ok('el día en la tabla, con la técnica de cada ejercicio', /<TablaDeEntreno[\s\S]*videoDe=\{\(ex\) => videoByExercise\[ex\.exerciseId\]\}[\s\S]*onVideo=/.test(w));
  ok('ni cronómetro ni cuenta atrás que elegir: los tiempos son los del entrenador', !/RelojesDelEntreno|Cronometro|<IntervalTimer/.test(w) && !existsSync('components/RelojesDelEntreno.tsx') && !existsSync('components/Cronometro.tsx'));
  ok('el descanso de cada ejercicio, de un toque', /<TablaDeEntreno[\s\S]*conCuentaAtras[\s\S]*sinDescansos=\{!!diaEmom \|\| !!diaGtg\}/.test(w));
  ok('en un día EMOM, su contador', /const diaEmom = day && !diaGtg && day\.showIntervalTimer/.test(w) && /\{diaEmom \? <ContadorEmom day=\{diaEmom\} medidaDe=\{medidaDe\} \/> : null\}/.test(w));
  ok('apuntar una marca, a mano y opcional', /Apuntar una marca/.test(w) && /<ApuntarMarca/.test(w));
  ok('se abre el día que toca hoy', /hoy\.day\?\.id \?\? hoy\.diaDeHoy\?\.id/.test(w));
  ok('el calentamiento antes de la tabla', w.indexOf('Calentamiento') > 0 && w.indexOf('Calentamiento') < w.indexOf('<TablaDeEntreno'));
  const tabla = lee('components/TablaDeEntreno.tsx');
  ok('la técnica, debajo de su ejercicio', /onVideo\(video, ex\.name\)/.test(tabla));
  ok('el descanso que se cuenta es el que puso el entrenador', /segundosDeDescanso = ultimoDelBloque \? ex\.restSeconds \?\? 0 : 0/.test(tabla) && /onPress=\{\(\) => descansar\(segundosDeDescanso, i, ex\.name\)\}/.test(tabla) && /startRest\(segundos,/.test(tabla));
  ok('en una superserie, al final del bloque', /const ultimoDelBloque = !enSuperserie \|\| i === b\.fin;/.test(tabla));
  ok('la superserie se ve como bloque, con su letra', /Superserie ·/.test(tabla) && /String\.fromCharCode\(65 \+ bloqueIndice/.test(tabla));
  ok('y el clúster, que cambia cómo se hace la serie', /En clúster: \$\{clusterBlocks\(ex\.cluster\)\} bloques/.test(tabla));
  const flotante = lee('components/GlobalRestTimer.tsx');
  ok('la cuenta atrás flota también en Entreno', /SE_APUNTA_EL_ENTRENO && enLaPantallaDeEntreno\(ruta\)/.test(flotante));
}

console.log('\nNada sigue contando entrenos que ya no se apuntan');
{
  ok('el modo está puesto', SE_APUNTA_EL_ENTRENO === false);
  const inicio = lee('app/(client)/dashboard.tsx');
  ok('sin aviso de "se te ha olvidado registrar"', /if \(SE_APUNTA_EL_ENTRENO && profile\.missedWorkoutRemindersEnabled\)/.test(inicio));
  ok('sin racha', /const streak = !SE_APUNTA_EL_ENTRENO \? 0 :/.test(inicio));
  ok('sin anillo de sesiones de la semana', /SE_APUNTA_EL_ENTRENO && targetSessions > 0 \?/.test(inicio));
  ok('sin "Entreno de otro día": se apunta una marca suelta', /\{SE_APUNTA_EL_ENTRENO \? <RegistrarOtroDia compacto \/> : null\}/.test(inicio));
  ok('sin "Completa tu primer entrenamiento"', /SE_APUNTA_EL_ENTRENO\s*\?\s*\{ key: 'workout'/.test(inicio));
  const perfil = lee('app/(client)/profile.tsx');
  ok('sin el interruptor de "Insistir si se me olvida"', /\{SE_APUNTA_EL_ENTRENO \? \(\s*<>\s*<View style=\{styles\.reminderTopRow\}>/.test(perfil));
  const panel = lee('app/(trainer)/dashboard.tsx');
  ok('en el panel del entrenador, sin "alumnos sin entrenar"', /const sinEntrenar = SE_APUNTA_EL_ENTRENO \? alumnosSinEntrenar\(/.test(panel));
  ok('ni el pulso de entrenos de la semana', /SE_APUNTA_EL_ENTRENO && clients\.length > 0 \?/.test(panel));
  const editor = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('ni el "apunta en la app / en tabla" del editor', /\{SE_APUNTA_EL_ENTRENO \? \(\s*<>\s*<Segmented<ModoDelAlumno>/.test(editor));
  const diaria = lee('components/RutinaDiariaDelDia.tsx');
  ok('la rutina de cada día, solo para ver: sin casillas, series ni crono', /const SOLO_VER = !SE_APUNTA_EL_ENTRENO;/.test(diaria) && /\{!SOLO_VER && conSeries \?/.test(diaria) && /\{!SOLO_VER && porTiempo \?/.test(diaria));
}

console.log(fallos === 0 ? '\n✔ Entreno: el programa a la vista y los tiempos del entrenador' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
