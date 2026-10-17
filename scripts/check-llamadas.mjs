/**
 * Llamadas 1:1 con el entrenador (lib/llamadas.ts).
 *
 * Lo que se protege:
 *  - Los huecos salen de las franjas del entrenador, partidas en llamadas de
 *    su duración, sin lo ya reservado ni lo que no respeta el margen.
 *  - Las horas son las del ENTRENADOR: un alumno en otra zona ve las mismas
 *    llamadas en su hora (y no corridas una hora).
 *  - El cupo es por mes natural de la llamada, y según el plan del alumno.
 *  - El plan más alto puede reservar con más antelación.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-llamadas.mjs
 */
import { readFileSync } from 'node:fs';
import {
  AJUSTES_POR_DEFECTO,
  delMes,
  franjaValida,
  huecosLibres,
  idDeLlamada,
  loQueTiene,
  minutosDe,
  normalizarHora,
  prioridadDe,
  puedeCancelar,
  puedeReservar,
} from '../lib/llamadas.ts';
import { marcaEnZona } from '../lib/fechas.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const lee = (f) => readFileSync(f, 'utf8');
const HORA = 3600000;

// Lunes 19 de octubre de 2026, 08:00 en Madrid (06:00 UTC).
const AHORA = Date.UTC(2026, 9, 19, 6, 0);
const ajustes = {
  ...AJUSTES_POR_DEFECTO,
  trainerId: 'coach',
  activas: true,
  zona: 'Europe/Madrid',
  duracionMin: 30,
  margenHoras: 1,
  franjas: [
    { dia: 0, desde: '09:00', hasta: '11:00' }, // lunes
    { dia: 2, desde: '18:00', hasta: '19:00' }, // miércoles
  ],
  planes: [
    { id: 'premium', nombre: 'Premium', llamadasAlMes: 4, antelacionDias: 21, vip: true },
    { id: 'basico', nombre: 'Básico', llamadasAlMes: 1, antelacionDias: 7, vip: false },
  ],
  sinPlan: { llamadasAlMes: 0, antelacionDias: 7 },
};
const madrid = (y, m, d, h, mi = 0) => marcaEnZona('Europe/Madrid', y, m, d, h * 60 + mi);

console.log('\nHoras');
ok('"9:00" son 540 minutos', minutosDe('9:00') === 540 && minutosDe('25:00') === null);
ok('lo escrito se entiende', normalizarHora('9') === '09:00' && normalizarHora('930') === '09:30' && normalizarHora('18.15') === '18:15');
ok('franja en la que no cabe una llamada: no vale', !franjaValida({ dia: 0, desde: '09:00', hasta: '09:20' }, 30));
ok('el lunes a las 9 en Madrid son las 7 UTC (horario de verano)', madrid(2026, 9, 19, 9) === Date.UTC(2026, 9, 19, 7, 0));
ok('y en noviembre, las 8 UTC (horario de invierno)', madrid(2026, 10, 2, 9) === Date.UTC(2026, 10, 2, 8, 0));

console.log('\nHuecos');
{
  const dias = huecosLibres(ajustes, 7, [], AHORA);
  const lunes = dias[0]?.huecos ?? [];
  ok('el lunes de 9 a 11 son 4 llamadas de 30 min', lunes.length === 4 && lunes[0] === madrid(2026, 9, 19, 9));
  ok('el miércoles de 18 a 19, 2', dias[1]?.huecos.length === 2);
  ok('7 días por delante: el lunes siguiente a las 9 ya cae fuera', dias.length === 2);
  ok('con 8, entra', huecosLibres(ajustes, 8, [], AHORA).length === 3);
  const conUna = huecosLibres(ajustes, 7, [{ inicio: madrid(2026, 9, 19, 9, 30), fin: madrid(2026, 9, 19, 10) }], AHORA);
  ok('lo ya reservado no sale', conUna[0].huecos.length === 3 && !conUna[0].huecos.includes(madrid(2026, 9, 19, 9, 30)));
  const tarde = huecosLibres(ajustes, 7, [], madrid(2026, 9, 19, 8, 45));
  ok('con menos de 1 h de margen, las 9:00 ya no', !tarde[0].huecos.includes(madrid(2026, 9, 19, 9)));
  const solape = huecosLibres(ajustes, 7, [{ inicio: madrid(2026, 9, 19, 9, 15), fin: madrid(2026, 9, 19, 9, 45) }], AHORA);
  ok('una llamada que pisa dos huecos los quita a los dos', solape[0].huecos.length === 2);
}

console.log('\nPlanes y cupo');
{
  ok('cada uno con lo suyo', loQueTiene(ajustes, 'premium').llamadasAlMes === 4 && loQueTiene(ajustes, 'basico').antelacionDias === 7);
  ok('sin plan, lo de "sin plan"', loQueTiene(ajustes, null).llamadasAlMes === 0 && loQueTiene(ajustes, 'borrado').plan === null);
  ok('prioridad: el primero es el más alto', prioridadDe(ajustes, 'premium') === 0 && prioridadDe(ajustes, 'basico') === 1 && prioridadDe(ajustes, undefined) === 2);
  const premiumVeMas = huecosLibres(ajustes, 21, [], AHORA).length > huecosLibres(ajustes, 7, [], AHORA).length;
  ok('el plan más alto ve más días por delante', premiumVeMas);
  const hueco = madrid(2026, 9, 19, 10);
  const base = { ajustes, ocupadas: [], ahora: AHORA, inicio: hueco };
  ok('con cupo y hueco libre: sí', puedeReservar({ ...base, planId: 'basico', mias: [] }).ok);
  ok('sin plan con llamadas: no', puedeReservar({ ...base, planId: null, mias: [] }).porque === 'sin-llamadas');
  ok('cupo gastado ese mes: no', puedeReservar({ ...base, planId: 'basico', mias: [{ inicio: madrid(2026, 9, 2, 9) }] }).porque === 'sin-cupo');
  ok('la del mes pasado no cuenta', puedeReservar({ ...base, planId: 'basico', mias: [{ inicio: madrid(2026, 8, 28, 9) }] }).ok);
  ok('cuenta por mes natural', delMes([{ inicio: madrid(2026, 9, 1, 9) }, { inicio: madrid(2026, 10, 1, 9) }], hueco) === 1);
  ok('hueco ya cogido: no', puedeReservar({ ...base, planId: 'basico', mias: [], ocupadas: [{ inicio: hueco, fin: hueco + 30 * 60000 }] }).porque === 'ocupada');
  ok('llamadas apagadas: no', puedeReservar({ ...base, ajustes: { ...ajustes, activas: false }, planId: 'premium', mias: [] }).porque === 'apagadas');
  ok('se cancela hasta 12 h antes', puedeCancelar({ inicio: AHORA + 13 * HORA }, ajustes, AHORA) && !puedeCancelar({ inicio: AHORA + 2 * HORA }, ajustes, AHORA));
  ok('el id de la llamada es el entrenador y la hora', idDeLlamada('coach', 123) === 'coach_123');
}

console.log('\nReglas, cuenta y pantallas');
{
  const reglas = lee('firestore.rules');
  ok('la llamada se crea con su id: entrenador + hora (no se puede pisar)', /codigo == request\.resource\.data\.trainerId \+ '_' \+ string\(request\.resource\.data\.inicio\)/.test(reglas));
  ok('solo para su entrenador, y en el futuro', /request\.resource\.data\.trainerId == miEntrenador\(\)/.test(reglas) && /request\.resource\.data\.inicio > request\.time\.toMillis\(\)/.test(reglas));
  ok('el plan lo pone el entrenador, no el alumno', /'planId'/.test(reglas));
  const borrado = lee('lib/firestore/eraseAccount.ts');
  ok('se borran con la cuenta', /coleccion: 'llamadas', campo: 'trainerId'/.test(borrado) && /coleccion: 'llamadas', campo: 'clientId'/.test(borrado));
  ok('el calendario del entrenador las enseña', /type: 'call'/.test(lee('lib/calendarioCoach.ts')));
}

console.log(fallos === 0 ? '\n✔ Las llamadas se reservan donde y cuando dice el entrenador' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
