/*
 * Qué ve el alumno al entrenar (lib/visibilidad.ts).
 *
 * El entrenador decide, en los TRES tipos de plan, si el alumno ve la
 * intensidad del día y el objetivo de cada ejercicio (RIR, o la variable del
 * personalizado). Lo que se vigila son los fallos que no dan error:
 *
 *  1. Las rutinas de antes lo siguen enseñando todo.
 *  2. Volver a encender un interruptor de verdad lo vuelve a enseñar: si solo
 *     se guardaran los "no", al encender no quedaría nada que escribir y el
 *     "no" viejo se quedaría en Firestore.
 *  3. Cada sitio donde el alumno ve la intensidad o el objetivo lo respeta.
 *     Uno olvidado es el entrenador creyendo que lo ha escondido.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-visibilidad.mjs
 */
import { readFileSync } from 'node:fs';
import { queVeElAlumno, visibilidadAGuardar } from '../lib/visibilidad.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');
const sinComentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\nLo que no se toca, se ve');
{
  const v = queVeElAlumno({});
  ok('una rutina de antes enseña la intensidad', v.intensidad === true);
  ok('y el objetivo', v.objetivo === true);
  ok('sin rutina, también', queVeElAlumno(null).intensidad && queVeElAlumno(undefined).objetivo);
  ok('se puede esconder la intensidad', queVeElAlumno({ visibilidad: { intensidad: false } }).intensidad === false);
  ok('y el objetivo, por separado', queVeElAlumno({ visibilidad: { objetivo: false } }).intensidad === true);
}

console.log('\nAl guardar, siempre las dos claves');
{
  const g = visibilidadAGuardar({ intensidad: false });
  ok('el "no" se guarda', g.intensidad === false);
  ok('y el "sí" también, explícito', g.objetivo === true, 'si no, al volver a encenderlo el "no" viejo se queda');
  ok('sin nada, todo en sí', JSON.stringify(visibilidadAGuardar(undefined)) === '{"intensidad":true,"objetivo":true}');
}

console.log('\nEl editor lo guarda en los tres tipos de plan');
{
  const editor = sinComentar(lee('app/(trainer)/clients/[id]/routine.tsx'));
  ok('en la rutina', /visibilidad: visibilidadAGuardar\(visibilidad\),\s*\};/.test(editor));
  ok('y en la plantilla', /visibilidad: visibilidadAGuardar\(visibilidad\),\s*days: diasAGuardar\(\)/.test(editor));
  // useCallback congela lo que no se declara.
  ok('en las dependencias del guardado', /visibilidad,[^\]]*router,\s*\]\);/.test(editor));
  ok('se lee al abrir', /setVisibilidad\(queVeElAlumno\(existing\)\)/.test(editor));
  ok('y al aplicar una plantilla', /setVisibilidad\(queVeElAlumno\(t\)\)/.test(editor));
  ok('los interruptores', /texto="Intensidad del día"/.test(editor) && /objetivo`/.test(editor));
}

console.log('\nY el alumno solo ve lo que le dejan');
{
  const entreno = sinComentar(lee('app/(client)/workout.tsx'));
  ok('la cabecera de la sesión', /\|\| !ve\.intensidad \? null : textoIntensidad\(/.test(entreno));
  ok('la ficha de elegir rutina', /ficha\.intensidad && ve\.intensidad && intensidad/.test(entreno));
  ok('el objetivo del ejercicio', /ve\.objetivo && textoDePrescripcion\(planned, perso\)/.test(entreno));
  const inicio = sinComentar(lee('app/(client)/dashboard.tsx'));
  ok('la tarjeta de hoy del inicio', /queVeElAlumno\(routine\)\.intensidad &&/.test(inicio));
}

console.log('\nY el entrenador tampoco lo ve mientras esté apagado');
{
  const editor = sinComentar(lee('app/(trainer)/clients/[id]/routine.tsx'));
  ok('la barra de intensidad del ciclo', /!day\.isRest && seMuestra\.intensidad \?/.test(editor));
  ok('la intensidad del personalizado', /day\.gtg \|\| !seMuestra\.intensidad \|\|/.test(editor));
  ok('el resumen del día (ciclo)', /if \(seMuestra\.intensidad\) summaryParts\.push\(`Intensidad/.test(editor));
  ok('el resumen del día (personalizado)', /seMuestra\.intensidad && textoDeIntensidadDelDia\(day, perso\)/.test(editor));
  ok('la casilla del RIR o la variable', /!seMuestra\.objetivo \? null :/.test(editor));
  const semana = sinComentar(lee('components/WeekPlanSheet.tsx'));
  ok('la columna de RIR de la semana programada', /conRir = !routine \|\| queVeElAlumno\(routine\)\.objetivo/.test(semana)
    && /\{conRir \? \(/.test(semana));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
