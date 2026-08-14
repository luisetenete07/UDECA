/*
 * Marcas superadas (lib/marcas.ts).
 *
 * La clasificación del mes cuenta récords batidos, no días seguidos. Lo que se
 * protege:
 *
 *  1. QUE CUENTE LO MISMO QUE CELEBRA LA APP. Si el ranking tuviera su propia
 *     idea de qué es un récord, contaría uno que nadie vio celebrar —o al
 *     revés— y nadie entendería su puesto.
 *  2. QUE ENERO NO REGALE RÉCORDS. Una marca del día 3 solo es récord si supera
 *     lo de ANTES; mirando solo el mes, el primer día de cada mes todo el mundo
 *     bate su marca porque el mes empieza vacío.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-marcas.mjs
 */
import {
  marcasCortas,
  marcasDelMes,
  marcasDelMesPasado,
  marcasSuperadas,
  textoDeMarcas,
} from '../lib/marcas.ts';
import { detectNewPRs } from '../lib/stats.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés:
// sin fijarlo estas comprobaciones leerían el texto en inglés y el resultado
// dependería de dónde se ejecuten.
setIdioma('es');


let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const DIA = 86400000;
const HOY = new Date(2026, 7, 13, 12, 0, 0).getTime();
const MES = new Date(2026, 7, 1).getTime();

/** Una sesión con un ejercicio a peso corporal y N repeticiones. */
const sesion = (fecha, reps, id = 'dom', nombre = 'Dominadas') => ({
  id: `l${fecha}-${id}-${reps}`,
  clientId: 'c',
  trainerId: 't',
  date: fecha,
  dayName: 'Día',
  exercises: [
    {
      exerciseId: id,
      name: nombre,
      measure: 'reps',
      sets: [{ reps: String(reps), weight: '', completed: true }],
    },
  ],
});

console.log('\nSubir cuenta, repetir no');
{
  const logs = [
    sesion(MES - 10 * DIA, 8), // antes del mes: fija la marca en 8
    sesion(MES + 1 * DIA, 9),  // récord
    sesion(MES + 2 * DIA, 9),  // igualar no es superar
    sesion(MES + 3 * DIA, 7),  // bajar tampoco
    sesion(MES + 4 * DIA, 10), // récord
  ];
  const r = marcasSuperadas(logs, MES, HOY);
  comprueba('cuenta las dos que suben', r.superadas === 2, String(r.superadas));
  comprueba('y en dos sesiones', r.sesiones === 2, String(r.sesiones));
}

console.log('\nEl mes no empieza en blanco');
{
  // ESTE es el fallo caro: mirando solo el mes, la primera sesión de agosto
  // sería récord aunque en julio ya hiciera más.
  const logs = [sesion(MES - 5 * DIA, 12), sesion(MES + 1 * DIA, 9)];
  comprueba('una marca peor que la de julio NO es récord',
    marcasSuperadas(logs, MES, HOY).superadas === 0,
    String(marcasSuperadas(logs, MES, HOY).superadas));

  // La primera vez de todas NO cuenta, y es lo correcto: la app tampoco la
  // celebra (ver detectNewPRs). Estrenar un ejercicio no es superarse, y si
  // contara, ganaría el mes quien más ejercicios nuevos probara.
  const primera = [sesion(MES + 1 * DIA, 9)];
  comprueba('estrenar un ejercicio no es superarse',
    marcasSuperadas(primera, MES, HOY).superadas === 0,
    String(marcasSuperadas(primera, MES, HOY).superadas));
}

console.log('\nCada ejercicio va por su cuenta');
{
  const logs = [
    sesion(MES + 1 * DIA, 8, 'dom', 'Dominadas'),
    sesion(MES + 1 * DIA, 20, 'flex', 'Flexiones'),
    sesion(MES + 3 * DIA, 9, 'dom', 'Dominadas'),
    sesion(MES + 3 * DIA, 19, 'flex', 'Flexiones'),
  ];
  // Dominadas sube (8 → 9): una marca. Flexiones baja (20 → 19): ninguna. Y
  // los estrenos no cuentan. Lo que importa aquí es que un ejercicio no pise
  // al otro.
  comprueba('cada uno cuenta lo suyo, sin mezclarse',
    marcasSuperadas(logs, MES, HOY).superadas === 1,
    String(marcasSuperadas(logs, MES, HOY).superadas));
}

console.log('\nNo se puede inflar el número');
{
  // Cinco series en la misma sesión, cada una mejor que la anterior. Es UN
  // récord, no cinco: lo impone detectNewPRs y aquí se comprueba que no se ha
  // colado otra cuenta por detrás.
  const antes = sesion(MES - 5 * DIA, 5);
  const muchas = {
    id: 'x', clientId: 'c', trainerId: 't', date: MES + 1 * DIA, dayName: 'D',
    exercises: [{
      exerciseId: 'dom', name: 'Dominadas', measure: 'reps',
      sets: [6, 7, 8, 9, 10].map((r) => ({ reps: String(r), weight: '', completed: true })),
    }],
  };
  comprueba('cinco series mejores son UNA marca',
    marcasSuperadas([antes, muchas], MES, HOY).superadas === 1,
    String(marcasSuperadas([antes, muchas], MES, HOY).superadas));
}

console.log('\nLas series sin terminar no cuentan');
{
  const aMedias = {
    id: 'y', clientId: 'c', trainerId: 't', date: MES + 1 * DIA, dayName: 'D',
    exercises: [{
      exerciseId: 'dom', name: 'Dominadas', measure: 'reps',
      sets: [{ reps: '30', weight: '', completed: false }],
    }],
  };
  comprueba('una serie no marcada no es récord',
    marcasSuperadas([aMedias], MES, HOY).superadas === 0);
}

console.log('\nEs la misma regla que celebra la app');
{
  // Si esto se separara, el ranking contaría cosas que nadie vio celebrar.
  const previo = [sesion(MES - 3 * DIA, 8)];
  const hoyMismo = sesion(MES + 1 * DIA, 9);
  const celebrado = detectNewPRs(previo, hoyMismo.exercises).length;
  const contado = marcasSuperadas([...previo, hoyMismo], MES, HOY).superadas;
  comprueba('celebra 1 y cuenta 1', celebrado === 1 && contado === 1, `${celebrado} vs ${contado}`);

  const igualado = sesion(MES + 1 * DIA, 8);
  comprueba('no celebra e igual no cuenta',
    detectNewPRs(previo, igualado.exercises).length === 0 &&
      marcasSuperadas([...previo, igualado], MES, HOY).superadas === 0);
}

console.log('\nEste mes y el pasado');
{
  const logs = [
    sesion(new Date(2026, 6, 5).getTime(), 8),
    sesion(new Date(2026, 6, 20).getTime(), 9),
    sesion(new Date(2026, 7, 2).getTime(), 10),
    sesion(new Date(2026, 7, 9).getTime(), 11),
  ];
  // Agosto: 9→10 y 10→11, dos. Julio: el 8 estrena (no cuenta) y el 9 sube,
  // una.
  comprueba('este mes, dos', marcasDelMes(logs, HOY) === 2, String(marcasDelMes(logs, HOY)));
  comprueba('el pasado, una', marcasDelMesPasado(logs, HOY) === 1, String(marcasDelMesPasado(logs, HOY)));
  // Y no se solapan: lo de julio no vuelve a contar en agosto.
  comprueba('sin solaparse', marcasDelMes(logs, HOY) + marcasDelMesPasado(logs, HOY) === 3);
}

console.log('\nCómo se dice');
{
  comprueba('el formato que pidió', textoDeMarcas(28) === 'Superado x28 veces', textoDeMarcas(28));
  // "x1 veces" se lee como un error.
  comprueba('en singular, sin la x', textoDeMarcas(1) === 'Superado 1 vez', textoDeMarcas(1));
  comprueba('sin ninguna, se dice', /Sin marcas/.test(textoDeMarcas(0)), textoDeMarcas(0));
  comprueba('y en negativo no se rompe', /Sin marcas/.test(textoDeMarcas(-3)));
  comprueba('la corta también', marcasCortas(1) === '1 marca' && marcasCortas(5) === '5 marcas');
}

console.log('\nSin nada no falla');
{
  comprueba('sin entrenos, cero', marcasSuperadas([], MES, HOY).superadas === 0);
  comprueba('ni sesiones', marcasSuperadas([], MES, HOY).sesiones === 0);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
