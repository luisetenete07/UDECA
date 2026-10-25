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
  ok('técnica y última vez, en la misma fila', /<View style=\{styles\.consultaFila\}>/.test(w));
  ok('sin etiqueta "AHORA": la fila encendida ya lo dice', !/>AHORA</.test(w) && /styles\.setRowAhora/.test(w));
  ok('el esfuerzo, al acabar el ejercicio', /pideEsfuerzoPorEjercicio && \(isDone \|\| exercise\.saltado\)/.test(w));
  ok('en el primero no hay "Anterior"', /\{bloqueVisible\.inicio > 0 \? \(\s*<Pressable/.test(w));
  const descanso = lee('components/RestTimer.tsx');
  ok('el descanso: "+15 s" y "Seguir", sin "−15 s"', /addTime\(15\)/.test(descanso) && !/addTime\(-15\)/.test(descanso) && />Seguir</.test(descanso));
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

console.log(fallos === 0 ? '\n✔ El entreno y el editor, más sencillos' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
