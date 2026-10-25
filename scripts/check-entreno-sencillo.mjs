/**
 * El entreno, más sencillo, y la vista en tabla.
 *
 *  - Entrenando: lo que toca en una línea (no siete pastillas), técnica y
 *    última vez en una fila, cada serie con su ✓ y nada más, el esfuerzo al
 *    acabar el ejercicio y el descanso con "+15 s" y "Seguir".
 *  - En tabla (lo elige el entrenador, alumno por alumno): el plan del día
 *    ordenado como una hoja de cálculo, para entrenar sin la app, y al acabar
 *    "Lo he hecho".
 *  - El editor de rutinas: lo que no es montar la rutina, en "Más".
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-entreno-sencillo.mjs
 */
import { readFileSync } from 'node:fs';
import { modoDelAlumno } from '../lib/visibilidad.ts';
import { esfuerzoDelEjercicio, textoDeEsfuerzo } from '../lib/planPersonalizado.ts';
import { alargarDescanso, getRest, restantes, startRest, stopRest, stopRestSiEs } from '../lib/restTimerStore.ts';
import { seriesAnteriores, textoDeSerieAnterior } from '../lib/stats.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

const w = lee('app/(client)/workout.tsx');

console.log('\nEntrenando, menos cosas a la vista');
{
  ok('lo que toca, en una línea de texto', /<Text style=\{styles\.metaLinea\}>/.test(w) && !/styles\.metaChip\b/.test(w));
  ok('sin etiqueta "AHORA": la fila encendida ya lo dice', !/>AHORA</.test(w) && /filaAhora/.test(lee('components/FilaDeSerie.tsx')));
  ok('sin la pregunta del esfuerzo "al acabar" (ni del ejercicio ni de la superserie)',
    !/Al acabar: ¿cuánto te ha costado cada uno\?/.test(w) && !/updateExerciseEsfuerzo/.test(w));
  ok('en el primero no hay "Anterior"', /\{bloqueVisible\.inicio > 0 \? \(\s*<Pressable/.test(w));
  const descanso = lee('components/RestTimer.tsx');
  ok('el descanso: "+15 s" y "Seguir", sin "−15 s"', /alargarDescanso\(15\)/.test(descanso) && !/(addTime|alargarDescanso)\(-15\)/.test(descanso) && />Seguir</.test(descanso));
}

console.log('\nEl descanso, dentro de la pantalla de entreno');
{
  // Flotando abajo tapaba "Anterior" y "Siguiente".
  const enLinea = (w.match(/<RestTimer key=\{activeRest\.id\} rest=\{activeRest\} enLinea \/>/g) ?? []).length;
  ok('va dentro: en el ejercicio suelto y en la superserie', enLinea === 2, String(enLinea));
  ok('sin el hueco de abajo que se reservaba para el flotante', !/restSpacer/.test(w));
  ok('la tarjeta no se apaga mientras descansa', /isDone && !activeRest && styles\.exerciseCardDone/.test(w));
  const flotante = lee('components/GlobalRestTimer.tsx');
  const patron = flotante.match(/return (\/.*\/)\.test\(ruta/);
  const esEntreno = patron ? new Function(`return ${patron[1]}`)() : null;
  ok('en la pantalla de entreno no flota', /if \(!rest \|\| enLaPantallaDeEntreno\(ruta\)\) return null;/.test(flotante) && !!esEntreno && esEntreno.test('/workout'));
  ok('en las demás pestañas, sí', !!esEntreno && !esEntreno.test('/progress') && !esEntreno.test('/dashboard') && !esEntreno.test('/workouts-history'));

  // La hora a la que acaba vive en el estado, no en el componente: al pasar de
  // la pantalla de entreno a otra pestaña no vuelve a empezar.
  const antes = Date.now();
  startRest(120, 'Serie 2');
  const r1 = getRest();
  ok('el final se guarda en el estado', r1 && r1.endsAt >= antes + 120000 && r1.endsAt <= Date.now() + 120000);
  ok('y lo que queda se cuenta contra el reloj', r1 && restantes(r1, r1.endsAt - 30000) === 30);
  alargarDescanso(15);
  const r2 = getRest();
  ok('"+15 s" mueve el final y la barra', r2 && r2.endsAt === r1.endsAt + 15000 && r2.seconds === 135 && r2.id === r1.id);
  stopRestSiEs(r1.id + 99);
  ok('parar otro descanso no para este', getRest()?.id === r1.id);
  stopRestSiEs(r1.id);
  ok('y parar este, sí', getRest() === null);
  stopRest();
}

console.log('\nEn tabla, si el entrenador lo elige');
{
  ok('sin elegir, en la app (como estaba todo el mundo)', modoDelAlumno(undefined) === 'app' && modoDelAlumno({}) === 'app');
  ok('con "tabla", en tabla', modoDelAlumno({ modoAlumno: 'tabla' }) === 'tabla');
  ok('algo raro cuenta como la app', modoDelAlumno({ modoAlumno: 'excel' }) === 'app');
  ok('el alumno ve la tabla en vez de la lista', /&& enTabla \? \(\s*<TablaDeEntreno/.test(w) && /&& !enTabla \? \(\s*<View style=\{styles\.previa\}>/.test(w));
  ok('y "Lo he hecho" guarda la sesión como estaba planeada', /title="Lo he hecho"\s*onPress=\{handleSave\}/.test(w));
  ok('si un día quiere, puede apuntar las series', /onPress=\{\(\) => setDiaEmpezado\(day\.id\)\} style=\{styles\.apuntarEnApp\}/.test(w));
  const tabla = lee('components/TablaDeEntreno.tsx');
  ok('la tabla: ejercicio, series, reps y descanso', />Ejercicio</.test(tabla) && />Series</.test(tabla) && />Reps</.test(tabla) && />Desc\.</.test(tabla));
  ok('el objetivo, solo si alguno lo lleva', /const conObjetivo = ejercicios\.some/.test(tabla));
  ok('las superseries, juntas y con su letra', /esSuperserie\(b\)/.test(tabla) && /styles\.filaEnlazada/.test(tabla));
  ok('y las notas del entrenador', /ex\.notes \? <Text style=\{styles\.nota\}>/.test(tabla));
  const editor = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('el entrenador lo elige en la rutina de cada alumno', /\{ valor: 'tabla', texto: 'En tabla'/.test(editor) && /modoAlumno,/.test(editor));
}

console.log('\nEl editor de rutinas, más despejado');
{
  const editor = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('plantillas, copiar, borrador, ver como el alumno, aplicar a otros y guardar como plantilla: en "Más"',
    ['Usar una plantilla', 'Copiar de otro alumno', 'Generar un borrador', 'Ver como el alumno', 'Aplicar a otros alumnos', 'Guardar como plantilla']
      .every((t) => editor.includes(`texto: '${t}'`)));
  ok('abajo, solo "Guardar rutina"', /title="Guardar rutina"/.test(editor) && !/Guardar también como plantilla/.test(editor) && !/styles\.extrasFila/.test(editor));
  ok('lo que ve el alumno, plegado con su resumen', /setAjustesAbiertos\(\(v\) => !v\)/.test(editor) && /styles\.ajustesResumen/.test(editor));
  ok('duplicar y borrar el día, en su menú', /titulo="Opciones del día"/.test(editor));
  ok('calentamiento y temporizador, plegados hasta que se usan', /Calentamiento y temporizador/.test(editor));
  ok('el ejercicio se mueve con flechas o con su menú (sin asa)', !/<View \{\.\.\.asa\}/.test(editor));
}

console.log('\nEl esfuerzo, serie a serie, mientras descansa');
{
  // En RIR, el ejercicio se queda con la serie más dura: si una fue al fallo,
  // el ejercicio fue al fallo (es lo que lee la bandeja del entrenador).
  const r = esfuerzoDelEjercicio([{ esfuerzo: '3', rir: 3 }, { esfuerzo: 'Fallo', rir: 0 }, {}], 'rir');
  ok('en RIR, el ejercicio se queda con la serie más dura', r.rir === 0 && r.esfuerzo?.valor === 'Fallo');
  ok('sin ninguna contestada, nada', JSON.stringify(esfuerzoDelEjercicio([{}, {}], 'rir')) === '{}');
  ok('con otra escala, la última contestada', esfuerzoDelEjercicio([{ esfuerzo: 'A' }, { esfuerzo: 'C' }], 'propia').esfuerzo?.valor === 'C');
  ok('y un porcentaje nunca acaba en el RIR', esfuerzoDelEjercicio([{ esfuerzo: '80 %' }], 'porcentaje').rir === undefined);
  ok('la etiqueta de la serie', textoDeEsfuerzo('rir', '2') === 'RIR 2' && textoDeEsfuerzo('rir', 'Fallo') === 'Fallo' && textoDeEsfuerzo('propia', 'B') === 'B');

  ok('al marcar una serie se pregunta por ESA serie', /value === true && pideEsfuerzoPorEjercicio\) \{\s*setPendienteEsfuerzo\(\{ ejercicio: exerciseIndex, serie: setIndex \}\);/.test(w));
  ok('la pregunta va encima del crono, en el ejercicio suelto',
    /\{preguntaDeSerie\(\{ inicio: exerciseIndex, fin: exerciseIndex \}\)\}\s*\{activeRest \?/.test(w));
  ok('se guarda en la serie, y el ejercicio sale de sus series',
    /return \{ \.\.\.st, esfuerzo: valor/.test(w) && /esfuerzoDelEjercicio\(sets, escala\)/.test(w));
  ok('lo dicho queda en la fila, y tocándolo se cambia', /\{etiquetaDeEsfuerzo\(exerciseIndex, setIndex\)\}/.test(w) && /\{etiquetaDeEsfuerzo\(i, r\)\}/.test(w));
  const sesion = lee('app/(trainer)/clients/[id]/session.tsx');
  ok('el entrenador ve el esfuerzo de cada serie', /const porSerie = ex\.sets\.some\(\(s\) => s\.esfuerzo\)/.test(sesion) && /textoDeEsfuerzo\(ex\.esfuerzo\?\.escala \?\? 'rir', set\.esfuerzo\)/.test(sesion));
  const editor = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('y en su editor se llama "En cada serie"', /texto: 'En cada serie'/.test(editor));
}

console.log('\nCada serie con aire, la nota arriba y lo de la última vez en su serie');
{
  // La misma fila para el ejercicio suelto y para cada paso de la superserie.
  const filas = (w.match(/<FilaDeSerie\b/g) ?? []).length;
  ok('una sola fila de serie para todo (suelto y superserie)', filas === 2, String(filas));
  const fila = lee('components/FilaDeSerie.tsx');
  const casillas = fila.indexOf('{enDosLineas ? null : casillas}');
  const check = fila.search(/style=\{\[\s*styles\.check,/);
  ok('el ✓ a la derecha, después de las casillas', casillas > 0 && check > casillas);
  ok('el ✓ y las casillas, de 48 (44 en un móvil estrecho)',
    /const ANCHO_CHECK = 48;/.test(fila) && /height: 48,/.test(fila) && /width < 380 \? \{ casilla: 54, check: 44 \}/.test(fila) && /\{ width: m\.check, height: m\.check/.test(fila));
  ok('cada fila en su caja, con aire debajo', /fila: \{[^}]*borderWidth: 1,[^}]*marginBottom: spacing\.sm/.test(fila));
  ok('con tres casillas o más, bajan a otra línea', /const enDosLineas = campos\.length > 2;/.test(fila));

  ok('lo de la última vez, en cada serie', (w.match(/antes=\{antesDe\(/g) ?? []).length === 2 && !/Última vez:/.test(w));
  const logs = [
    { date: 1, exercises: [{ exerciseId: 'dom', sets: [{ reps: '5', weight: '5', completed: true }] }] },
    { date: 3, exercises: [{ exerciseId: 'dom', sets: [{ reps: '', completed: false }] }] },
    { date: 2, exercises: [{ exerciseId: 'dom', sets: [{ reps: '6', weight: '10', completed: true }, { reps: '5', completed: true }] }] },
  ];
  const ant = seriesAnteriores(logs);
  ok('la última sesión en que se apuntó algo (no la vacía)', ant.dom?.length === 2 && ant.dom[0].reps === '6');
  ok('"6 × 10" con lastre (el "kg" ya lo dice su casilla)', textoDeSerieAnterior(ant.dom[0], { carga: 'weighted' }) === '6 × 10');
  ok('"8 s" en un isométrico', textoDeSerieAnterior({ reps: '8', completed: true }, { segundos: true }) === '8 s');
  ok('"3 + 5 s" en un combo', textoDeSerieAnterior({ reps: '3', seconds: '5', completed: true }, { combo: true }) === '3 + 5 s');
  ok('"6 / 6" por lados', textoDeSerieAnterior({ reps: '6', side2: '6', completed: true }, { lados: true }) === '6 / 6');
  ok('"3+3+3" en clúster', textoDeSerieAnterior({ reps: '3', clusters: ['3', '3'], completed: true }) === '3+3+3');
  ok('una serie sin hacer no dice nada', textoDeSerieAnterior({ reps: '6', completed: false }) === '' && textoDeSerieAnterior(undefined) === '');

  ok('la nota, en su pastilla junto a Técnica y Saltar, y se abre debajo',
    /'Tu nota' : 'Nota'/.test(w) && /<\/View>\s*\{campoDeNota\(exerciseIndex\)\}/.test(w) && !/Añadir nota|Editar nota/.test(w));
  ok('en la superserie, la nota de cada ejercicio dentro de su caja', /\{campoDeNota\(i, true\)\}/.test(w));
  ok('las notas del entrenador, en su cajita (suelto y superserie)', (w.match(/notaDelEntrenador\(/g) ?? []).length === 2);
  ok('las herramientas, pastillas de 36 de alto', /herramienta: \{[^}]*minHeight: 36,/.test(w));
}

console.log(fallos === 0 ? '\n✔ El entreno y el editor, más sencillos' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
