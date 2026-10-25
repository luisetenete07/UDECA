/**
 * El editor de rutinas del entrenador, más rápido de usar.
 *
 *  - Un ejercicio nuevo entra con los números del de antes (series, descanso,
 *    RIR; las reps, del último que se mida igual).
 *  - Un día nuevo de la semana coge el primer día libre.
 *  - Plegado, cada día dice qué ejercicios lleva ("+" = superserie).
 *  - "Igualar" pone series, reps, RIR o descanso a todo el día de una vez.
 *  - La superserie, de un toque, en la pastilla entre dos ejercicios.
 *  - "Guardar rutina", fijo abajo.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-editor-rapido.mjs
 */
import { readFileSync } from 'node:fs';
import { igualarEjercicios, numerosHeredados, primerDiaLibre, resumenDeEjercicios } from '../lib/editorRutina.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));
const editor = lee('app/(trainer)/clients/[id]/routine.tsx');

console.log('\nUn ejercicio nuevo, con los números del de antes');
{
  const vacio = numerosHeredados([], 'reps');
  ok('en un día vacío, 3 × 10', vacio.sets === 3 && vacio.reps === '10' && vacio.restSeconds === undefined && vacio.rir === undefined);
  ok('un isométrico en un día vacío, 3 × 30 s', numerosHeredados([], 'seconds').reps === '30');
  const dia = [
    { name: 'Dominadas', sets: 4, reps: '6', restSeconds: 150, rir: 1, measure: 'reps' },
    { name: 'Plancha', sets: 3, reps: '40', restSeconds: 60, rir: 2, measure: 'seconds' },
  ];
  const nuevo = numerosHeredados(dia, 'reps');
  ok('series, descanso y RIR, los del último', nuevo.sets === 3 && nuevo.restSeconds === 60 && nuevo.rir === 2);
  ok('las reps, del último que se mide igual (no los 40 s de la plancha)', nuevo.reps === '6');
  ok('y un isométrico coge los segundos del isométrico', numerosHeredados(dia, 'seconds').reps === '40');
  ok('RIR 0 (al fallo) también se hereda', numerosHeredados([{ sets: 3, reps: '5', rir: 0 }], 'reps').rir === 0);
  ok('en el editor, al añadir', /\.\.\.numerosHeredados\(dia\?\.exercises \?\? \[\], exercise\.measure \?\? 'reps'\)/.test(editor) && !/sets: 3,\s*reps: exercise\.measure === 'seconds'/.test(editor));
}

console.log('\nUn día nuevo de la semana, en el primer hueco');
{
  ok('lunes si no hay nada', primerDiaLibre([]) === 0);
  ok('el primero libre', primerDiaLibre([{ weekday: 0 }, { weekday: 1 }, { weekday: 3 }, {}]) === 2);
  ok('sin hueco, ninguno', primerDiaLibre([0, 1, 2, 3, 4, 5, 6].map((w) => ({ weekday: w }))) === undefined);
  ok('en el editor, solo en la semana', /schedule === 'weekly' \? \{ weekday: primerDiaLibre\(prev\) \} : \{\}/.test(editor));
}

console.log('\nPlegado, el día dice qué lleva');
{
  const r = resumenDeEjercicios([
    { name: 'Dominadas' },
    { name: 'Fondos' },
    { name: 'Flexiones arqueras', supersetWithPrevious: true },
    { name: 'Front lever' },
  ]);
  ok('"+" para la superserie, "·" entre los demás', r === 'Dominadas · Fondos + Flexiones arqueras · Front lever', r);
  ok('en la tarjeta plegada', /!isOpen && !day\.isRest && day\.exercises\.length > 0 \? \(\s*<Text style=\{styles\.dayEjercicios\}/.test(editor));
  ok('abierto, el nombre se cambia en el propio título (sin el campo repetido)', /<TextInput\s+value=\{day\.name\}/.test(editor) && !/label="Nombre del día"/.test(editor));
}

console.log('\nIgualar el día');
{
  const dia = [
    { id: 'a', name: 'Dominadas', sets: 4, reps: '6', measure: 'reps', rir: 1, restSeconds: 150 },
    { id: 'b', name: 'Plancha', sets: 3, reps: '40', measure: 'seconds' },
    { id: 'c', name: 'Pistol', sets: 3, reps: '5', side2: '4', measure: 'repsDual' },
  ];
  const igual = igualarEjercicios(dia, { sets: 5, reps: '8', restSeconds: 120 });
  ok('las series y el descanso, a todos', igual.every((e) => e.sets === 5 && e.restSeconds === 120));
  ok('las reps, solo a los de reps (la plancha sigue en 40 s)', igual[0].reps === '8' && igual[1].reps === '40' && igual[2].reps === '8');
  ok('por lados, el derecho se iguala con el izquierdo', igual[2].side2 === '8');
  ok('lo que no se escribe no cambia', igual[0].rir === 1 && igualarEjercicios(dia, {})[0].sets === 4);
  ok('los segundos, solo a los isométricos', igualarEjercicios(dia, { segundos: '30' }).map((e) => e.reps).join() === '6,30,5');
  ok('RIR 0 se puede igualar', igualarEjercicios(dia, { rir: 0 }).every((e) => e.rir === 0));
  ok('en el menú del día, lo primero', /texto: 'Igualar series, reps y descanso'/.test(editor) && /titulo="Igualar el día"/.test(editor));
  ok('y subir o bajar el día, también en su menú (sin asa)', /texto: 'Subir el día'/.test(editor) && /texto: 'Bajar el día'/.test(editor) && !/asaDia/.test(editor));
}

console.log('\nLa superserie, de un toque');
{
  ok('una pastilla entre un ejercicio y el anterior', /exIndex > 0 && !day\.gtg \? \(\s*<Pressable\s+onPress=\{\(\) => toggleSuperset\(day\.id, ex\.id\)\}/.test(editor));
  ok('ya no está escondida en las opciones', !/'Superserie con el anterior'\s*\}/.test(editor) && !/Quitar superserie/.test(editor));
}

console.log('\nAñadir varios seguidos');
{
  ok('lo que ya está en el día, marcado', /const yaEsta = \(diaDelPicker\?\.exercises \?\? \[\]\)\.filter/.test(editor) && />\s*\{yaEsta > 1 \? frase`En el día ×\$\{yaEsta\}` : 'En el día'\}/.test(editor));
  ok('y "Listo" cierra, con la cuenta', /frase`Listo · \$\{diaDelPicker\.exercises\.length\} en el día`/.test(editor));
}

console.log('\nGuardar, siempre a mano');
{
  ok('"Guardar rutina" va fijo abajo', /pie=\{\s*<>\s*\{saveError \?[\s\S]{0,120}<Button title="Guardar rutina"/.test(editor));
  const contenedor = lee('components/ScreenContainer.tsx');
  ok('el contenedor lo pinta fuera del desplazamiento', /<\/ScrollView>\s*\{pie \? \(/.test(contenedor));
  const rd = editor.indexOf('<RutinaDiariaEditor');
  ok('la rutina diaria, después de los días', rd > editor.indexOf('title="+ Añadir día"'));
}

console.log(fallos === 0 ? '\n✔ El editor de rutinas, más rápido' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
