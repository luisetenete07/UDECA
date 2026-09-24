/*
 * Lo que prescribe el entrenador en su plan personalizado.
 *
 * Intensidad de cada rutina en porcentaje, con sus etiquetas o sin nada; y en
 * cada ejercicio RIR, RPE, % RM, tempo, su propia variable o nada. Lo que se
 * vigila son las cosas que, si se rompen, no dan error:
 *
 *  1. EL RIR SIGUE SIENDO UN RIR. Media app lo promedia. Si al cambiar de
 *     variable se quedaran RIR escondidos, seguirían entrando en las medias de
 *     un plan que ya no los usa.
 *  2. BORRAR EL RIR LO QUITA. Antes lo dejaba en 0, que es "al fallo": el
 *     entrenador quitaba la indicación y al alumno le llegaba la más dura.
 *  3. LOS PLANES DE ANTES SE VEN IGUAL. Sin prescripción guardada, porcentaje y
 *     RIR; y si el alumno apuntaba en letras o %, sin RIR, como hasta ahora.
 *  4. LO QUE SE GUARDA ES LO QUE SE VE, en el editor y en el alumno.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-prescripcion.mjs
 */
import { readFileSync } from 'node:fs';
import {
  diasParaGuardar,
  LARGO_DEL_NOMBRE_DE_VARIABLE,
  LARGO_DEL_PRESCRITO,
  nivelesDeIntensidad,
  NIVELES_DE_INTENSIDAD_POR_DEFECTO,
  nombreDeLaVariable,
  POR_DEFECTO,
  prescripcionDe,
  resumenDePrescripcion,
  rirDeTexto,
  textoDeIntensidadDelDia,
  textoDePrescripcion,
} from '../lib/planPersonalizado.ts';
import { etiquetaCombinada, textoIntensidad } from '../lib/intensidad.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');
const sinComentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const con = (tipo, extra = {}) => ({ prescripcion: { variable: { tipo, ...extra } } });

console.log('\nLo que no se toca, como siempre');
{
  const p = prescripcionDe(undefined);
  ok('sin plan: intensidad en %', p.intensidad.escala === 'porcentaje');
  ok('y RIR por ejercicio', p.variable.tipo === 'rir');
  ok('un plan nuevo arranca igual', prescripcionDe(POR_DEFECTO).variable.tipo === 'rir');
  // Los planes semanales y los ciclos no llevan personalizado: RIR como antes.
  ok('fuera del personalizado se lee "RIR 2"', textoDePrescripcion({ rir: 2 }) === 'RIR 2');
  /*
   * LA HERENCIA. Antes, el "RIR 2" se escondía si el alumno apuntaba su
   * esfuerzo en letras o en %. Un plan guardado así, sin prescripción, tiene
   * que seguir sin enseñarlo.
   */
  const viejo = { esfuerzo: { escala: 'propia', cuando: 'ejercicio' } };
  ok('un plan viejo en letras sigue sin RIR', prescripcionDe(viejo).variable.tipo === 'ninguna');
  ok('y el alumno no lo ve', textoDePrescripcion({ rir: 1 }, viejo) === null);
  ok('lo que se elige manda sobre la herencia', prescripcionDe({ ...viejo, ...con('rpe') }).variable.tipo === 'rpe');
}

console.log('\nCada variable se lee como tal');
{
  ok('RIR', textoDePrescripcion({ rir: 2 }, con('rir')) === 'RIR 2');
  ok('RIR 0 es "al fallo", y se enseña', textoDePrescripcion({ rir: 0 }, con('rir')) === 'RIR 0');
  ok('RPE', textoDePrescripcion({ prescrito: '8' }, con('rpe')) === 'RPE 8');
  ok('porcentaje, de qué', textoDePrescripcion({ prescrito: '75' }, con('porcentaje')) === '75 % RM');
  ok('sin % repetido', textoDePrescripcion({ prescrito: '75%' }, con('porcentaje')) === '75 % RM');
  ok('tempo', textoDePrescripcion({ prescrito: '3-1-1-0' }, con('tempo')) === 'Tempo 3-1-1-0');
  ok('la suya, con su nombre', textoDePrescripcion({ prescrito: 'B' }, con('propia', { nombre: 'Zona' })) === 'Zona B');
  ok('la suya sin nombre', nombreDeLaVariable(con('propia')) === 'Objetivo');
  ok('el nombre con tope', (nombreDeLaVariable(con('propia', { nombre: 'x'.repeat(50) })) ?? '').length === LARGO_DEL_NOMBRE_DE_VARIABLE);
  ok('nada es nada', textoDePrescripcion({ rir: 2, prescrito: '8' }, con('ninguna')) === null);
  // Vacío en un ejercicio: el alumno no ve nada en ese.
  ok('vacío no enseña nada', textoDePrescripcion({ prescrito: '  ' }, con('tempo')) === null);
  // Con una variable que no es RIR, un RIR suelto NO se enseña como si lo fuera.
  ok('un RIR no se cuela en otra variable', textoDePrescripcion({ rir: 2 }, con('tempo')) === null);
}

console.log('\nLa intensidad de cada rutina');
{
  const enPct = {};
  const propia = { prescripcion: { intensidad: { escala: 'propia', niveles: ['A', 'B', 'C'] } } };
  const nada = { prescripcion: { intensidad: { escala: 'ninguna' } } };
  ok('en %', textoDeIntensidadDelDia({ intensityPct: 80 }, enPct) === '80 %');
  ok('con sus etiquetas', textoDeIntensidadDelDia({ intensityLabel: 'B' }, propia) === 'B');
  ok('sin nada', textoDeIntensidadDelDia({ intensityPct: 80, intensityLabel: 'B' }, nada) === null);
  ok('sus etiquetas, en su orden', nivelesDeIntensidad(propia).join() === 'A,B,C');
  ok('sin etiquetas, unas para empezar', nivelesDeIntensidad({ prescripcion: { intensidad: { escala: 'propia' } } }).join() === NIVELES_DE_INTENSIDAD_POR_DEFECTO.join());
  // La cabecera de la sesión del alumno lee la etiqueta sin tener el plan.
  ok('la cabecera de la sesión la enseña', textoIntensidad({ intensityLabel: 'Dura' }, 'flex') === 'Dura');
  ok('y el % sigue igual', textoIntensidad({ intensityPct: 70 }, 'flex') === '70 %');
  /*
   * Al empezar, las rutinas elegidas se juntan en una sesión. Solo se copiaba
   * el porcentaje: con etiquetas propias, la sesión se quedaba sin intensidad.
   * Y con varias no se inventa cuál es la más dura: se dicen todas.
   */
  ok('una rutina, su etiqueta', etiquetaCombinada([{ intensityLabel: 'Media' }]) === 'Media');
  ok('varias, todas y sin repetir', etiquetaCombinada([{ intensityLabel: 'A' }, {}, { intensityLabel: 'C' }, { intensityLabel: 'A' }]) === 'A + C');
  ok('ninguna, nada', etiquetaCombinada([{}, { intensityLabel: ' ' }]) === undefined);
  ok('la sesión la lleva', /intensityLabel: etiquetaCombinada\(chosen\)/.test(sinComentar(lee('app/(client)/workout.tsx'))));
}

console.log('\nBorrar el RIR lo quita, no prescribe el fallo');
{
  ok('vacío es sin RIR', rirDeTexto('') === undefined, 'antes era 0, que es "al fallo"');
  ok('espacios, también', rirDeTexto('   ') === undefined);
  ok('el 0 sigue siendo 0', rirDeTexto('0') === 0);
  ok('un número es ese número', rirDeTexto('3') === 3);
  ok('una letra no es un RIR', rirDeTexto('b') === undefined);
  ok('con tope', rirDeTexto('40') === 10);
}

console.log('\nAl guardar, cada valor en su sitio');
{
  const dias = [
    {
      intensityPct: 80,
      intensityLabel: 'B',
      exercises: [{ rir: 2, prescrito: ' 3-1-1-0 ' }],
    },
  ];
  /*
   * LO MÁS IMPORTANTE. Con una variable que no es RIR, los RIR que hubiera se
   * van: si se quedaran, seguirían entrando en la media de esfuerzo del bloque
   * y en los informes, de un plan que ya no los usa.
   */
  const tempo = diasParaGuardar(dias, con('tempo'))[0];
  ok('con tempo, el RIR se va', !('rir' in tempo.exercises[0]), 'seguiría entrando en las medias');
  ok('y el tempo se guarda limpio', tempo.exercises[0].prescrito === '3-1-1-0');
  const rir = diasParaGuardar(dias, con('rir'))[0];
  ok('con RIR, el RIR se queda', rir.exercises[0].rir === 2);
  ok('y no queda un tempo escondido', !('prescrito' in rir.exercises[0]));
  const nada = diasParaGuardar(dias, con('ninguna'))[0];
  ok('sin variable, ni uno ni otro', !('rir' in nada.exercises[0]) && !('prescrito' in nada.exercises[0]));
  ok('el valor con tope', (diasParaGuardar([{ exercises: [{ prescrito: 'x'.repeat(40) }] }], con('tempo'))[0].exercises[0].prescrito ?? '').length === LARGO_DEL_PRESCRITO);
  // La intensidad: un 80 % olvidado debajo de una "B" saldría en el registro.
  const enPct = diasParaGuardar(dias, {})[0];
  ok('en %, la etiqueta se va', enPct.intensityPct === 80 && !('intensityLabel' in enPct));
  const propia = diasParaGuardar(dias, { prescripcion: { intensidad: { escala: 'propia' } } })[0];
  ok('con etiquetas, el % se va', propia.intensityLabel === 'B' && !('intensityPct' in propia));
  const sinIntensidad = diasParaGuardar(dias, { prescripcion: { intensidad: { escala: 'ninguna' } } })[0];
  ok('sin intensidad, ninguna', !('intensityPct' in sinIntensidad) && !('intensityLabel' in sinIntensidad));
  ok('no toca los días de entrada', dias[0].exercises[0].rir === 2 && dias[0].intensityLabel === 'B');
}

console.log('\nEl editor guarda lo que se ve');
{
  const editor = sinComentar(lee('app/(trainer)/clients/[id]/routine.tsx'));
  ok('el RIR vacío pasa por rirDeTexto', /field === 'rir'\s*\?\s*rirDeTexto\(value\)/.test(editor), 'vuelve a guardarse 0 = al fallo');
  ok('la rutina se guarda con los días limpios', /updateRoutine\(routineId, \{ name, days: dias,/.test(editor) && /days: dias,\s*active: true/.test(editor));
  ok('y la plantilla también', /days: diasAGuardar\(\),/.test(editor));
  ok('solo en el personalizado', /schedule === 'flex' \? diasParaGuardar\(days, configuracionAGuardar\(\)\) : days/.test(editor));
  /*
   * `useCallback` congela lo que no se declara: sin esto se guardarían las
   * etiquetas de intensidad de cuando se abrió la pantalla.
   */
  ok('las etiquetas de intensidad, en las dependencias del guardado', /nivelesIntensidadTexto,\s*router,\s*\]\);/.test(editor));
  ok('al abrir un plan viejo, respeta su herencia', (editor.match(/prescripcion: prescripcionDe\(/g) ?? []).length === 2);
  ok('se elige la intensidad', /'propia' as EscalaDeIntensidad/.test(editor) && /'ninguna' as EscalaDeIntensidad/.test(editor));
  ok('y la variable', /\['tempo', 'Tempo'\]/.test(editor) && /\['ninguna', 'Nada'\]/.test(editor));
  ok('guardar como plantilla, a la vista', /Guardar también como plantilla/.test(editor));
  ok('y la plantilla dice qué trae', /resumenDePrescripcion\(t\.personalizado\)/.test(editor));
}

console.log('\nEl alumno ve lo que prescribe su entrenador');
{
  const entreno = sinComentar(lee('app/(client)/workout.tsx'));
  ok('junto a cada ejercicio', /textoDePrescripcion\(planned, perso\)/.test(entreno));
  ok('y ya no el "RIR" a fuego', !/>RIR \{planned\.rir\}</.test(entreno));
  ok('la intensidad, en su escala', /textoDeIntensidadDelDia\(d, perso\)/.test(entreno));
  ok('el resumen de una plantilla se entiende', /Por ejercicio: Tempo/.test(resumenDePrescripcion(con('tempo'))));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
