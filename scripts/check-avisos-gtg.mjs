/**
 * Los avisos de la rutina de cada día (lib/avisosDiarios.ts).
 *
 * Lo que se protege: que avisen mientras quede algo y se callen cuando no.
 * Un aviso que suena con todo hecho enseña a ignorarlos, y entonces ya no
 * sirven ni el día que hacen falta.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-avisos-gtg.mjs
 */
import { readFileSync } from 'node:fs';
import { avisosDelGtg, DIAS_DE_AVISOS_GTG, HORAS_DEL_GTG } from '../lib/avisosDiarios.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const a = (h, m = 0) => new Date(2026, 9, 10, h, m, 0).getTime();
const hoy = (l) => l.filter((x) => x.esHoy);

console.log('\nHoy, solo lo que queda por delante');
{
  const l = avisosDelGtg(4, a(8));
  ok('a las 8, los cuatro de hoy', hoy(l).length === HORAS_DEL_GTG.length, String(hoy(l).length));
  ok('y no más de cuatro al día', HORAS_DEL_GTG.length <= 4);
  const tarde = avisosDelGtg(2, a(14, 30));
  ok('a las 14:30, solo los de las 16 y las 19', hoy(tarde).map((x) => new Date(x.cuando).getHours()).join(',') === '16,19');
  const justo = avisosDelGtg(2, a(15, 58));
  ok('uno para dentro de dos minutos no se pone', !hoy(justo).some((x) => new Date(x.cuando).getHours() === 16));
}

console.log('\nCon todo hecho, hoy se calla');
{
  const l = avisosDelGtg(0, a(9));
  ok('ningún aviso hoy', hoy(l).length === 0);
  ok('pero mañana sí avisa', l.length > 0 && l.every((x) => !x.esHoy));
}

console.log('\nLos días siguientes, puestos');
{
  const l = avisosDelGtg(3, a(20));
  const dias = new Set(l.map((x) => new Date(x.cuando).getDate()));
  ok(`${DIAS_DE_AVISOS_GTG - 1} días más por delante`, dias.size === DIAS_DE_AVISOS_GTG - 1, [...dias].join(','));
  ok('ni uno de noche', l.every((x) => new Date(x.cuando).getHours() >= 10 && new Date(x.cuando).getHours() <= 19));
}

console.log('\nY la app los usa');
{
  const tarjeta = readFileSync('components/RutinaDiariaDelDia.tsx', 'utf8');
  ok('la tarjeta los rehace con lo que queda', /programarAvisosGtg\([^)]*pr\.total - pr\.hechos, pr\.total\)/.test(tarjeta));
  ok('y los quita sin rutina o apagados', /if \(!rutina \|\| !hayRutinaDiaria\(rutina\) \|\| !avisosOn\) \{\s*cancelarAvisosGtg\(\)/.test(tarjeta));
  const perfil = readFileSync('app/(client)/profile.tsx', 'utf8');
  ok('el alumno puede apagarlos', /dailyRoutineRemindersEnabled: next/.test(perfil) && /if \(!next\) await cancelarAvisosGtg\(\);/.test(perfil));
}

console.log(fallos === 0 ? '\n✔ Los avisos del GTG avisan cuando toca y se callan cuando no' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
