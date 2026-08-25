/*
 * Qué sesión toca hoy (lib/schedule.ts · resolveSessionFor).
 *
 * POR QUÉ EXISTE
 *
 * Esta función decide lo primero que ve un alumno al abrir la app: qué entrena
 * hoy. No la probaba nada, y ahí llevaba tiempo escondido un fallo grande:
 *
 *   if (routine.schedule === 'cycle' && routine.cycleStartDate)
 *
 * Ese `&& routine.cycleStartDate` exigía que el plan tuviera FECHA DE INICIO.
 * Un plan por ciclos guardado sin ella —que es lo que queda cuando nadie toca
 * la fecha al crearlo— se caía a la rama semanal, y como un plan por ciclos no
 * tiene días de la semana asignados, acababa devolviendo siempre el primer día.
 *
 * El ciclo NO rotaba. Y lo peor: "reiniciar el ciclo" y "fijar el día de hoy"
 * parecían funcionar —la pantalla cambiaba de día— pero al volver a entrar
 * estaba otra vez el Día 1. Un botón que aparenta funcionar y no funciona es
 * peor que no tenerlo.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-que-toca-hoy.mjs
 */
import { resolveSessionFor } from '../lib/schedule.ts';
import { masDias } from '../lib/fechas.ts';
import { setIdioma } from '../lib/idioma.ts';

setIdioma('es');

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const HOY = Date.now();

/** Un ciclo de tres: entrenar, entrenar, descansar. */
const ciclo = (extra = {}) => ({
  id: 'r1',
  schedule: 'cycle',
  days: [
    { id: 'd1', name: 'Empuje' },
    { id: 'd2', name: 'Tirón' },
    { id: 'd3', name: 'Descanso', isRest: true },
  ],
  ...extra,
});

console.log('\nUn ciclo CON fecha de inicio');
{
  const r = ciclo({ cycleStartDate: masDias(HOY, -4) });
  // Cuatro días desde el inicio, ciclo de tres: 4 % 3 = 1 → el segundo día.
  const s = resolveSessionFor(r, HOY);
  ok('rota con los días', s.day?.name === 'Tirón', s.day?.name);
  ok('y lo dice', s.cycleLabel === 'Día 2 de 3', s.cycleLabel);
  // Mañana toca el descanso: 5 % 3 = 2.
  const m = resolveSessionFor(r, masDias(HOY, 1));
  ok('mañana toca descansar', m.isRest === true && m.day === null);
}

console.log('\nUn ciclo SIN fecha de inicio (el fallo que había)');
{
  const r = ciclo();
  const s = resolveSessionFor(r, HOY);
  // Sin ancla ninguna, el ciclo empieza hoy: Día 1. Lo que NO puede pasar es
  // que se comporte como un plan semanal y deje de ser un ciclo.
  ok('empieza por el Día 1', s.day?.name === 'Empuje', s.day?.name);
  ok('y sigue siendo un ciclo', s.cycleLabel === 'Día 1 de 3', s.cycleLabel ?? '(ninguna: se fue al modo semanal)');

  /*
   * LO IMPORTANTE: que el alumno pueda fijar el día aunque el coach no pusiera
   * fecha. Antes esto se ignoraba por completo, y por eso "fijar el día de hoy"
   * no sobrevivía a cerrar la pantalla.
   */
  const conAncla = resolveSessionFor(r, HOY, masDias(HOY, 2));
  ok('el alumno puede fijar qué día es hoy', conAncla.day?.name === 'Tirón', conAncla.day?.name);
  ok('con su etiqueta', conAncla.cycleLabel === 'Día 2 de 3', conAncla.cycleLabel);

  // Y que ese día siga puesto mañana, corrido uno: es lo que significa que el
  // ciclo "continúe" desde ahí y no que se quede clavado.
  const manana = resolveSessionFor(r, masDias(HOY, 1), masDias(HOY, 2));
  ok('y mañana el ciclo avanza solo', manana.isRest === true, manana.day?.name ?? 'descanso');
}

console.log('\nEl ancla más reciente manda');
{
  const r = ciclo({ cycleStartDate: masDias(HOY, -4) });
  // El alumno reinició hoy: gana su ancla sobre la del coach, más antigua.
  const s = resolveSessionFor(r, HOY, HOY);
  ok('lo que hizo el alumno gana a lo viejo del coach', s.day?.name === 'Empuje', s.day?.name);

  // Y al revés: si el coach reprograma el ciclo DESPUÉS, gana él.
  const r2 = ciclo({ cycleStartDate: HOY });
  const s2 = resolveSessionFor(r2, HOY, masDias(HOY, -10));
  ok('y lo que reprograma el coach gana a lo viejo del alumno', s2.day?.name === 'Empuje', s2.day?.name);
}

console.log('\nLos otros modos siguen igual');
{
  const semanal = {
    id: 'r2',
    schedule: 'weekly',
    days: [{ id: 'a', name: 'Día A', weekday: 0 }, { id: 'b', name: 'Día B', weekday: 2 }],
  };
  // El lunes toca lo del lunes. Se busca un lunes de verdad para no depender
  // del día en que se ejecute esto.
  let lunes = HOY;
  for (let i = 0; i < 7; i++) {
    if (new Date(masDias(HOY, i)).getDay() === 1) { lunes = masDias(HOY, i); break; }
  }
  ok('el semanal va por el día de la semana', resolveSessionFor(semanal, lunes).day?.name === 'Día A');
  ok('y un día sin nada asignado es descanso',
    resolveSessionFor(semanal, masDias(lunes, 1)).isRest === true);

  const flex = { id: 'r3', schedule: 'flex', days: [{ id: 'x', name: 'Suave' }] };
  ok('en Sensaciones no hay día impuesto', resolveSessionFor(flex, HOY).day === null);

  const gtg = { id: 'r4', schedule: 'gtg', days: [{ id: 'g', name: 'Dominadas' }] };
  ok('grease the groove nunca descansa', resolveSessionFor(gtg, HOY).isRest === false);

  ok('sin rutina no se inventa nada', resolveSessionFor(null, HOY).day === null);
  ok('ni con una rutina vacía', resolveSessionFor({ id: 'x', schedule: 'cycle', days: [] }, HOY).day === null);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
