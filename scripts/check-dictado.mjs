/*
 * El entreno contado en voz alta (lib/dictado.ts, lib/voz.ts).
 *
 * Lo que hay que proteger: que NADA de lo que dice la IA llegue a la pantalla
 * sin pasar por el filtro. Al otro lado hay un modelo de lenguaje, no una base
 * de datos: puede devolver un ejercicio que no existe, cien series de nada o
 * kilos en unas dominadas normales. Si algo de eso cuela, queda escrito en el
 * histórico de una persona como trabajo que nunca hizo, y eso ya no lo arregla
 * nadie desde la pantalla.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-dictado.mjs
 */
import {
  MAX_EJERCICIOS,
  MAX_MARCA,
  MAX_PESO,
  MAX_SERIES,
  aLog,
  catalogoParaLaIA,
  cuantasSeries,
  diaMasProbable,
  hayDictado,
  limpiaDictado,
  resumenDelDictado,
} from '../lib/dictado.ts';
import { textoDeResultados, hayEscuchaEnNavegador } from '../lib/voz.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const CATALOGO = [
  { id: 'dom', nombre: 'Dominadas', medida: 'reps', carga: 'none' },
  { id: 'fondos', nombre: 'Fondos', medida: 'reps', carga: 'weighted' },
  { id: 'plancha', nombre: 'Plancha', medida: 'seconds', carga: 'none' },
];

console.log('\nEl catálogo que ve la IA');
{
  const routine = {
    id: 'r',
    trainerId: 't',
    days: [
      {
        id: 'd1',
        name: 'Día A',
        exercises: [
          { id: 'x', exerciseId: 'dom', name: 'Dominadas', sets: 4, reps: '8' },
          { id: 'y', exerciseId: 'fondos', name: 'Fondos', sets: 3, reps: '8', load: 'weighted' },
        ],
      },
      {
        id: 'd2',
        name: 'Día B',
        exercises: [
          { id: 'z', exerciseId: 'plancha', name: 'Plancha', sets: 3, reps: '30', measure: 'seconds' },
        ],
      },
    ],
  };
  const biblioteca = [
    { id: 'dom', name: 'Dominadas (ficha)', measure: 'reps' },
    { id: 'remo', name: 'Remo invertido', measure: 'reps' },
  ];
  const c = catalogoParaLaIA(routine, biblioteca);
  comprueba('entran los de todos los días del plan', c.some((e) => e.id === 'dom') && c.some((e) => e.id === 'plancha'));
  comprueba('y los sueltos de la biblioteca', c.some((e) => e.id === 'remo'));
  comprueba('sin repetir', c.filter((e) => e.id === 'dom').length === 1);
  // El plan manda: ahí el entrenador decidió cómo se hace ESE ejercicio aquí.
  comprueba('el nombre del plan gana al de la ficha', c.find((e) => e.id === 'dom').nombre === 'Dominadas');
  comprueba('la medida viaja', c.find((e) => e.id === 'plancha').medida === 'seconds');
  comprueba('la carga también', c.find((e) => e.id === 'fondos').carga === 'weighted');
  comprueba('sin plan, la biblioteca basta', catalogoParaLaIA(null, biblioteca).length === 2);
  comprueba('sin nada, nada', catalogoParaLaIA(null, []).length === 0);
}

console.log('\nLimpiar lo que devuelve la IA');
{
  const d = limpiaDictado(
    {
      ejercicios: [
        { exerciseId: 'dom', series: [{ marca: 8, peso: 0 }, { marca: 7, peso: 0 }] },
        { exerciseId: 'fondos', series: [{ marca: 8, peso: 10 }] },
      ],
      duracionMin: 45,
      haceDias: 1,
      sinIdentificar: ['unas zancadas raras'],
    },
    CATALOGO
  );
  comprueba('dos ejercicios', d.ejercicios.length === 2);
  comprueba('con sus series', d.ejercicios[0].series.length === 2);
  comprueba('las marcas van en texto', d.ejercicios[0].series[0].marca === '8');
  comprueba('el peso donde toca', d.ejercicios[1].series[0].peso === '10');
  comprueba('la duración', d.duracionMin === 45);
  comprueba('el día', d.haceDias === 1);
  comprueba('lo no reconocido se conserva', d.sinIdentificar.length === 1);
  comprueba('cuenta las series', cuantasSeries(d) === 3);
  comprueba('hay dictado', hayDictado(d));
}

console.log('\nLo que NO puede colarse');
{
  // Un ejercicio inventado dejaría marcas colgando de un id que no existe.
  const inventado = limpiaDictado(
    { ejercicios: [{ exerciseId: 'muscle-up-imaginario', series: [{ marca: 5, peso: 0 }] }] },
    CATALOGO
  );
  comprueba('un ejercicio que no existe se cae', inventado.ejercicios.length === 0);
  comprueba('y entonces no hay dictado', !hayDictado(inventado));

  // Peso corporal es peso corporal: la casilla de kilos ni existe en pantalla.
  const conKilos = limpiaDictado(
    { ejercicios: [{ exerciseId: 'dom', series: [{ marca: 8, peso: 20 }] }] },
    CATALOGO
  );
  comprueba('kilos en un ejercicio sin carga: fuera', conKilos.ejercicios[0].series[0].peso === '');

  const disparates = limpiaDictado(
    {
      ejercicios: [
        {
          exerciseId: 'fondos',
          series: [
            { marca: 999999, peso: 5 },
            { marca: -3, peso: 5 },
            { marca: 8, peso: 99999 },
            { marca: 8, peso: -4 },
            { marca: 8.6, peso: 10.04 },
          ],
        },
      ],
      duracionMin: 99999,
      haceDias: 900,
    },
    CATALOGO
  );
  const s = disparates.ejercicios[0].series;
  comprueba('una marca imposible se queda en blanco', s[0].marca === '', s[0].marca);
  comprueba('una marca negativa también', s[1].marca === '');
  comprueba('un peso imposible se cae', s[2].peso === '');
  comprueba('un peso negativo también', s[3].peso === '');
  comprueba('la marca se redondea a entero', s[4].marca === '9');
  comprueba('el peso admite medios kilos', s[4].peso === '10');
  comprueba('una duración disparatada no pasa', disparates.duracionMin === undefined);
  comprueba('un día fuera de plazo tampoco', disparates.haceDias === undefined);
  comprueba('cero es "no lo dijo", no cero repes',
    limpiaDictado({ ejercicios: [{ exerciseId: 'dom', series: [{ marca: 0, peso: 0 }] }], duracionMin: 0, haceDias: -1 }, CATALOGO)
      .ejercicios[0].series[0].marca === '');
  comprueba('duración cero es "no lo dijo"',
    limpiaDictado({ duracionMin: 0 }, CATALOGO).duracionMin === undefined);
  comprueba('haceDias -1 es "no lo dijo"',
    limpiaDictado({ haceDias: -1 }, CATALOGO).haceDias === undefined);
  comprueba('hoy sí vale', limpiaDictado({ haceDias: 0 }, CATALOGO).haceDias === 0);

  // Nadie hace treinta series de un ejercicio ni entrena cuarenta ejercicios.
  const pasado = limpiaDictado(
    {
      ejercicios: Array.from({ length: 40 }, () => ({
        exerciseId: 'dom',
        series: Array.from({ length: 60 }, () => ({ marca: 5, peso: 0 })),
      })),
    },
    CATALOGO
  );
  comprueba('los ejercicios repetidos se funden en uno', pasado.ejercicios.length === 1);
  comprueba('las series se recortan', pasado.ejercicios[0].series.length === MAX_SERIES);
  comprueba('hay tope de ejercicios', MAX_EJERCICIOS === 15 && MAX_MARCA === 3600 && MAX_PESO === 300);

  const nada = limpiaDictado(null, CATALOGO);
  comprueba('nada no revienta', nada.ejercicios.length === 0 && nada.sinIdentificar.length === 0);
  comprueba('basura tampoco',
    limpiaDictado({ ejercicios: 'pues no', sinIdentificar: 7 }, CATALOGO).ejercicios.length === 0);
  comprueba('un ejercicio sin series no cuenta',
    limpiaDictado({ ejercicios: [{ exerciseId: 'dom', series: [] }] }, CATALOGO).ejercicios.length === 0);
  comprueba('lo no reconocido se recorta a ocho',
    limpiaDictado({ sinIdentificar: Array.from({ length: 30 }, (_, i) => `cosa ${i}`) }, CATALOGO)
      .sinIdentificar.length === 8);
}

console.log('\nDel dictado al entreno que se guarda');
{
  const d = limpiaDictado(
    {
      ejercicios: [
        { exerciseId: 'plancha', series: [{ marca: 30, peso: 0 }, { marca: 25, peso: 0 }] },
        { exerciseId: 'fondos', series: [{ marca: 8, peso: 10 }] },
      ],
    },
    CATALOGO
  );
  const log = aLog(d, CATALOGO);
  comprueba('respeta el orden en que se contó', log[0].exerciseId === 'plancha');
  comprueba('con su nombre', log[0].name === 'Plancha');
  // Sin la medida sellada, un aguante de 30 segundos contaría como 30 reps.
  comprueba('sella la medida', log[0].measure === 'seconds');
  comprueba('y la carga', log[1].load === 'weighted');
  comprueba('las series nacen hechas', log[0].sets.every((s) => s.completed === true));
  comprueba('la marca va en reps', log[0].sets[0].reps === '30');
  comprueba('el peso en weight', log[1].sets[0].weight === '10');
  comprueba('lo que no está en el catálogo no se guarda', aLog(d, []).length === 0);
}

console.log('\nDe qué día del plan era');
{
  const routine = {
    days: [
      { id: 'd1', name: 'Día A', exercises: [{ exerciseId: 'dom' }, { exerciseId: 'fondos' }] },
      { id: 'd2', name: 'Día B', exercises: [{ exerciseId: 'plancha' }] },
      { id: 'd3', name: 'Descanso', isRest: true, exercises: [] },
    ],
  };
  const actual = routine.days[0];
  const deB = limpiaDictado({ ejercicios: [{ exerciseId: 'plancha', series: [{ marca: 30, peso: 0 }] }] }, CATALOGO);
  comprueba('gana el día que más comparte', diaMasProbable(deB, routine, actual).id === 'd2');

  const deA = limpiaDictado(
    { ejercicios: [{ exerciseId: 'dom', series: [{ marca: 8, peso: 0 }] }, { exerciseId: 'fondos', series: [{ marca: 8, peso: 5 }] }] },
    CATALOGO
  );
  comprueba('con dos coincidencias, ese', diaMasProbable(deA, routine, routine.days[1]).id === 'd1');
  // Sin pista, no se inventa: se queda lo que la persona ya tenía elegido.
  comprueba('sin coincidencias, el que ya estaba',
    diaMasProbable({ ejercicios: [] }, routine, actual).id === 'd1');
  comprueba('sin plan, tampoco revienta', diaMasProbable(deA, null, null) === null);
  comprueba('un día de descanso nunca gana',
    diaMasProbable(deB, { days: [routine.days[2]] }, actual).id === 'd1');
}

console.log('\nEnseñar lo entendido antes de apuntarlo');
{
  const d = limpiaDictado(
    {
      ejercicios: [
        { exerciseId: 'dom', series: [{ marca: 8, peso: 0 }, { marca: 7, peso: 0 }] },
        { exerciseId: 'fondos', series: [{ marca: 8, peso: 10 }] },
        { exerciseId: 'plancha', series: [{ marca: 30, peso: 0 }] },
      ],
    },
    CATALOGO
  );
  const lineas = resumenDelDictado(d, CATALOGO);
  comprueba('una línea por ejercicio', lineas.length === 3);
  comprueba('con el nombre y las marcas', lineas[0] === 'Dominadas: 8, 7', lineas[0]);
  comprueba('el peso se ve', lineas[1] === 'Fondos: 8 · 10 kg', lineas[1]);
  // Un aguante de 30 segundos leído como "30" a secas parecen 30 repeticiones.
  comprueba('los segundos llevan su unidad', lineas[2] === 'Plancha: 30s', lineas[2]);
  const sinMarca = limpiaDictado({ ejercicios: [{ exerciseId: 'dom', series: [{ marca: 0, peso: 0 }] }] }, CATALOGO);
  comprueba('una serie sin marca se ve como tal', resumenDelDictado(sinMarca, CATALOGO)[0] === 'Dominadas: ?');
}

console.log('\nLa voz, antes de llegar a la IA');
{
  // Fuera del navegador no hay escucha, y eso no puede reventar nada: en el
  // móvil el dictado lo pone el teclado.
  comprueba('sin navegador, no hay escucha', hayEscuchaEnNavegador() === false);
  const evento = {
    results: [[{ transcript: 'cuatro series de dominadas' }], [{ transcript: ' ocho siete seis' }]],
  };
  comprueba('junta los trozos', textoDeResultados(evento) === 'cuatro series de dominadas ocho siete seis');
  comprueba('un evento vacío no rompe', textoDeResultados({}) === '');
  comprueba('ni uno inservible', textoDeResultados(null) === '');
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
