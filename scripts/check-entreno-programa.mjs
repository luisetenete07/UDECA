/**
 * ENTRENO SIN DIRECTO (lib/modoDeEntreno.ts): el programa a la vista, un reloj
 * (cuenta atrás y cronómetro) y apuntar una marca si se quiere.
 *
 * Lo que se protege: que el alumno vea su plan entero con la técnica, que el
 * reloj funcione aunque se cierre la app, que una marca no se pierda ni
 * multiplique entrenos, y que nada de la app siga contando "entrenos" que ya
 * no se apuntan (la racha, "sin entrenar", el aviso de olvido).
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-entreno-programa.mjs
 */
import { readFileSync } from 'node:fs';
import {
  arrancar,
  conVuelta,
  leerCronometro,
  MAX_VUELTAS,
  parciales,
  PARADO,
  pausar,
  textoDelCronometro,
  transcurrido,
} from '../lib/cronometro.ts';
import { conMarca, ejercicioDeLaMarca, limpiarCifra, marcaValida, queSePide, registroDeHoy } from '../lib/apuntarMarca.ts';
import { SE_APUNTA_EL_ENTRENO } from '../lib/modoDeEntreno.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

console.log('\nEl cronómetro');
{
  const t0 = 1_000_000;
  let e = arrancar(PARADO, t0);
  ok('arranca y cuenta', transcurrido(e, t0 + 7400) === 7400);
  ok('arrancar dos veces no lo reinicia', arrancar(e, t0 + 5000) === e);
  e = pausar(e, t0 + 10_000);
  ok('en pausa, se queda quieto', transcurrido(e, t0 + 99_000) === 10_000);
  e = arrancar(e, t0 + 20_000);
  ok('al seguir, suma lo de antes', transcurrido(e, t0 + 25_000) === 15_000);
  // Lo que se guarda es la HORA: si la app se cierra 3 minutos, al volver
  // marca esos 3 minutos más, no se para.
  const guardado = JSON.stringify(e);
  ok('sobrevive a cerrar la app', transcurrido(leerCronometro(guardado), t0 + 205_000) === 195_000);
  e = conVuelta(conVuelta(e, t0 + 30_000), t0 + 41_000);
  ok('las vueltas: cuánto duró cada una', JSON.stringify(parciales(e)) === JSON.stringify([20_000, 11_000]));
  let muchas = PARADO;
  for (let i = 0; i < MAX_VUELTAS + 5; i++) muchas = conVuelta(muchas, t0);
  ok(`como mucho ${MAX_VUELTAS} vueltas`, muchas.vueltas.length === MAX_VUELTAS);
  ok('se lee como un cronómetro', textoDelCronometro(7400) === '0:07.4' && textoDelCronometro(90_000) === '1:30.0');
  ok('pasada la hora, sin décimas', textoDelCronometro(3_735_000) === '1:02:15');
  ok('lo guardado roto, parado', JSON.stringify(leerCronometro('{roto')) === JSON.stringify(PARADO) && leerCronometro(null) === PARADO);
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
  ok('el reloj, con y sin rutina', (w.match(/<RelojesDelEntreno \/>/g) ?? []).length === 2);
  ok('apuntar una marca, a mano y opcional', /Apuntar una marca/.test(w) && /<ApuntarMarca/.test(w));
  ok('se abre el día que toca hoy', /hoy\.day\?\.id \?\? hoy\.diaDeHoy\?\.id/.test(w));
  ok('el calentamiento antes de la tabla', w.indexOf('Calentamiento') > 0 && w.indexOf('Calentamiento') < w.indexOf('<TablaDeEntreno'));
  const relojes = lee('components/RelojesDelEntreno.tsx');
  ok('el reloj: cuenta atrás y cronómetro', /<CronoDeDescanso sinTarjeta \/>/.test(relojes) && /<Cronometro \/>/.test(relojes));
  const tabla = lee('components/TablaDeEntreno.tsx');
  ok('la técnica, debajo de su ejercicio', /onVideo\(video, ex\.name\)/.test(tabla));
  ok('la superserie se ve como bloque, con su letra', /Superserie ·/.test(tabla) && /String\.fromCharCode\(65 \+ bloqueIndice/.test(tabla));
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

console.log(fallos === 0 ? '\n✔ Entreno: el programa a la vista y un reloj' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
