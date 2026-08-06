/*
 * Comprobación de la intensidad (lib/intensidad.ts).
 *
 * Dos escalas conviviendo es donde se cuelan los errores tontos: pintar un
 * "70/10", enseñar la intensidad en un día de descanso, o inventarse un 5 por
 * defecto en una rutina donde el entrenador no ha puesto nada.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-intensidad.mjs
 */
import {
  ajustaPct,
  pctCombinado,
  esfuerzoDePct,
  MAX_PCT,
  MIN_PCT,
  proporcionIntensidad,
  textoIntensidad,
} from '../lib/intensidad.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else { console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`); fallos++; }
}

console.log('\nCada modo, en su escala');
comprueba(
  'en ciclo se lee sobre diez',
  textoIntensidad({ intensity: 7 }, 'cycle') === '7/10'
);
comprueba(
  'en sensaciones, en porcentaje',
  textoIntensidad({ intensityPct: 85 }, 'flex') === '85 %'
);
comprueba(
  'la semanal usa la escala del ciclo',
  textoIntensidad({ intensity: 6 }, 'weekly') === '6/10'
);

console.log('\nLo que NO se inventa');
comprueba(
  'sin intensidad puesta no se enseña un 5 por defecto',
  textoIntensidad({}, 'cycle') === null
);
comprueba(
  'en sensaciones sin porcentaje, tampoco',
  textoIntensidad({}, 'flex') === null
);
comprueba(
  'un día de descanso no tiene intensidad que enseñar',
  textoIntensidad({ intensity: 8, isRest: true }, 'cycle') === null
);
comprueba('sin día, nada', textoIntensidad(null, 'cycle') === null);
comprueba(
  'el porcentaje de sensaciones no se cuela en un ciclo',
  textoIntensidad({ intensityPct: 85 }, 'cycle') === null
);
comprueba(
  'ni el 1-10 se cuela en sensaciones (saldría "7 %")',
  textoIntensidad({ intensity: 7 }, 'flex') === null
);

console.log('\nLa proporción, para barras y aros');
comprueba('7/10 es 0,7', proporcionIntensidad({ intensity: 7 }, 'cycle') === 0.7);
comprueba('85 % es 0,85', proporcionIntensidad({ intensityPct: 85 }, 'flex') === 0.85);
comprueba(
  'nunca pasa de uno aunque el dato venga roto',
  proporcionIntensidad({ intensityPct: 250 }, 'flex') === 1
);
comprueba('sin dato, null y no cero', proporcionIntensidad({}, 'flex') === null);

console.log('\nSubir y bajar el porcentaje');
comprueba('de nada, arranca en 70 y sube a 75', ajustaPct(undefined, 1) === 75);
comprueba('baja de cinco en cinco', ajustaPct(80, -1) === 75);
comprueba('no pasa del máximo', ajustaPct(MAX_PCT, 1) === MAX_PCT);
comprueba('no baja del mínimo', ajustaPct(MIN_PCT, -1) === MIN_PCT);
comprueba('un salto grande tampoco se sale', ajustaPct(95, 5) === MAX_PCT);

console.log('\nLa palabra, para quien no quiere el número');
comprueba('40 % es suave', esfuerzoDePct(40) === 'Suave');
comprueba('70 % es medio', esfuerzoDePct(70) === 'Medio');
comprueba('85 % es fuerte', esfuerzoDePct(85) === 'Fuerte');
comprueba('100 % es máximo', esfuerzoDePct(100) === 'Máximo');
comprueba('sin porcentaje, sin palabra', esfuerzoDePct(undefined) === null);

console.log('\nVarias rutinas el mismo día');
comprueba(
  'manda la más dura, no la suma',
  pctCombinado([{ intensityPct: 50 }, { intensityPct: 90 }]) === 90
);
comprueba(
  'ni la media: un suave antes de un fuerte no lo ablanda',
  pctCombinado([{ intensityPct: 50 }, { intensityPct: 60 }]) === 60
);
comprueba(
  'las que no tienen porcentaje no cuentan',
  pctCombinado([{}, { intensityPct: 70 }]) === 70
);
comprueba('si ninguna lo tiene, no se inventa', pctCombinado([{}, {}]) === undefined);
comprueba('sin rutinas, tampoco', pctCombinado([]) === undefined);

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
