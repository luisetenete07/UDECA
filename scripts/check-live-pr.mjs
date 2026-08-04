/*
 * Comprobación del récord en el momento (lib/livePR.ts).
 *
 * Lo que se comprueba sobre todo es que NO celebre de más: una celebración que
 * salta cuando no toca deja de ser un premio a la segunda vez, y una que
 * después se desmiente en el resumen vale menos que no celebrar nada.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-live-pr.mjs
 */
import { checkLivePR } from '../lib/livePR.ts';
import { detectNewPRs } from '../lib/stats.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const serie = (reps, weight = '0', completed = true) => ({ reps, weight, completed });
const log = (fecha, sets, id = 'dom', name = 'Dominadas') => ({
  id: `l${fecha}`, trainerId: 't', clientId: 'a', routineId: 'r', routineName: 'R',
  dayName: 'X', date: fecha, createdAt: fecha,
  exercises: [{ exerciseId: id, name, measure: 'reps', sets }],
});

// Su historial: máximo 10 dominadas a peso corporal, y 8 con 5 kg.
const historial = [
  log(1, [serie('8'), serie('10')]),
  log(2, [serie('8', '5'), serie('9')]),
];
const ejercicio = { exerciseId: 'dom', name: 'Dominadas', measure: 'reps', sets: [] };

console.log('\n1) Cuándo SÍ');
const sube = checkLivePR(historial, ejercicio, [serie('11')]);
comprueba('11 repeticiones baten las 10 de siempre', sube !== null);
comprueba('lo dice con la marca de hoy', sube?.label === '11 reps', sube?.label);
comprueba('y con la de antes', sube?.previous === '10 reps', String(sube?.previous));

const lastre = checkLivePR(historial, ejercicio, [serie('6', '10')]);
comprueba('10 kg baten los 5 kg de siempre', lastre !== null);
comprueba('la marca va en kilos', lastre?.label === '10 kg × 6', lastre?.label);
comprueba('y la anterior también', lastre?.previous === '5 kg × 8', String(lastre?.previous));

console.log('\n2) Cuándo NO');
comprueba('igualar no es récord', checkLivePR(historial, ejercicio, [serie('10')]) === null);
comprueba('quedarse corto tampoco', checkLivePR(historial, ejercicio, [serie('7')]) === null);
comprueba(
  'una serie sin marcar no cuenta',
  checkLivePR(historial, ejercicio, [serie('20', '0', false)]) === null
);
comprueba(
  'un ejercicio nuevo sin historial no dispara nada',
  checkLivePR(historial, { ...ejercicio, exerciseId: 'nuevo', name: 'Fondos' }, [serie('12')]) === null
);

console.log('\n3) No se desmiente en el resumen');
// Lo que se celebra a mitad de sesión tiene que seguir siendo récord al final.
const sesion = [{ ...ejercicio, sets: [serie('11'), serie('7')] }];
const vivo = checkLivePR(historial, ejercicio, [serie('11')]);
const alFinal = detectNewPRs(historial, sesion);
comprueba('lo celebrado sigue siendo récord al terminar', alFinal.length === 1 && vivo !== null);
comprueba(
  'y con la misma marca',
  alFinal[0].label === vivo.label,
  `${alFinal[0].label} vs ${vivo?.label}`
);

console.log('\n4) Isométricos');
const isoHist = [
  { ...log(1, [serie('40')], 'fro', 'Front lever'),
    exercises: [{ exerciseId: 'fro', name: 'Front lever', measure: 'seconds', sets: [serie('40')] }] },
];
const iso = { exerciseId: 'fro', name: 'Front lever', measure: 'seconds', sets: [] };
const record = checkLivePR(isoHist, iso, [serie('45')]);
comprueba('45 segundos baten los 40', record !== null);
comprueba('y se cuentan en segundos', record?.label === '45 s', record?.label);
comprueba('40 segundos no baten 40', checkLivePR(isoHist, iso, [serie('40')]) === null);

console.log(fallos === 0 ? '\nTodo correcto ✔\n' : `\n${fallos} fallo(s) ✖\n`);
process.exit(fallos === 0 ? 0 : 1);
