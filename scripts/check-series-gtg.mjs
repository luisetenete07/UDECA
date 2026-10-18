/**
 * El alumno añade o quita series en el grease the groove, y ve las suyas día a
 * día en Progreso (lo mismo que su entrenador en la ficha).
 *
 * Lo que se protege:
 *  - Día GTG del plan: las series de hoy las puede subir o bajar el alumno; lo
 *    que ponga se guarda con el día y manda sobre el plan, solo ese día.
 *  - Rutina diaria: una serie más o menos por ejercicio, solo hoy, sin perder
 *    lo ya marcado ni dejar "3 de 2".
 *  - El historial cuenta cada día con lo que se buscaba ESE día.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-series-gtg.mjs
 */
import { readFileSync } from 'node:fs';
import { MAX_OBJETIVO, objetivoDeHoy, progresoGtg } from '../lib/gtg.ts';
import { conSeriesDeHoy, cuentaSeries, marcasDeLaRutina, progresoDiario, seriesDelDia } from '../lib/rutinaDiaria.ts';
import { esEntrenoGtg, resumenDeSeries, seriesDiariasPorDia, seriesGtgPorDia } from '../lib/historialGtg.ts';
import { inicioDelDia, masDias } from '../lib/fechas.ts';
import { setIdioma } from '../lib/idioma.ts';

setIdioma('es');
let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const lee = (f) => readFileSync(f, 'utf8');
const HOY = Date.now();
const hoy = inicioDelDia(HOY);

console.log('\nDía GTG del plan: las series de hoy');
{
  const dia = { id: 'g', name: 'Dominadas sueltas', gtg: true, gtgSetsPerDay: 6, exercises: [] };
  const rutina = { id: 'r', schedule: 'flex', days: [dia] };
  ok('sin tocar nada, las del plan', objetivoDeHoy(rutina, null, dia) === 6);
  ok('las que pone el alumno antes de apuntar ninguna', objetivoDeHoy(rutina, null, dia, 8) === 8);
  ok('guardadas en el entreno del día, mandan', objetivoDeHoy(rutina, { gtg: { objetivo: 4 } }, dia, 8) === 4);
  ok('ni cero ni más del tope', objetivoDeHoy(rutina, null, dia, 0) === 6 && objetivoDeHoy(rutina, null, dia, 99) === MAX_OBJETIVO);
  const serie = (n) => ({ exercises: [{ sets: Array.from({ length: n }, () => ({ completed: true })) }], gtg: { objetivo: 4 } });
  const p = progresoGtg(rutina, serie(4), dia);
  ok('con 4 puestas y 4 hechas, objetivo cumplido', p.completo && p.objetivo === 4);
}

console.log('\nRutina diaria: una serie más o menos, solo hoy');
{
  const rutina = {
    id: 'yo', activa: true, nombre: 'Cada día',
    ejercicios: [{ id: 'pino', nombre: 'Pino', objetivo: '30 s', series: 3 }, { id: 'mov', nombre: 'Movilidad', objetivo: '2 min' }],
  };
  ok('solo los que cuentan series se pueden cambiar', cuentaSeries(rutina.ejercicios[0]) && !cuentaSeries(rutina.ejercicios[1]));
  const dia0 = { id: 'd', clientId: 'yo', date: HOY, hechos: ['pino#1', 'pino#2'], updatedAt: HOY };
  const mas = conSeriesDeHoy(rutina, dia0, 'pino', 4);
  const diaMas = { ...dia0, ...mas };
  ok('una más: 4 casillas', seriesDelDia(rutina.ejercicios[0], diaMas) === 4 && marcasDeLaRutina(rutina, diaMas).filter((m) => m.startsWith('pino')).length === 4);
  ok('y lo marcado sigue marcado', progresoDiario(rutina, diaMas).hechos === 2 && progresoDiario(rutina, diaMas).total === 5);
  const menos = conSeriesDeHoy(rutina, diaMas, 'pino', 1);
  const diaMenos = { ...dia0, ...menos };
  ok('bajando a una, la casilla única queda hecha (y no "2 de 1")', progresoDiario(rutina, diaMenos).hechos === 1 && diaMenos.hechos.includes('pino'));
  const vuelta = conSeriesDeHoy(rutina, diaMas, 'pino', 3);
  ok('volver a las del entrenador quita el cambio', vuelta.series.pino === undefined);
  const ayer = { ...diaMas, date: masDias(HOY, -1) };
  ok('lo de ayer no cuenta hoy', seriesDelDia(rutina.ejercicios[0], ayer) === 3);
}

console.log('\nEl historial, día a día');
{
  const dia = { id: 'g', name: 'Dominadas sueltas', gtg: true, gtgSetsPerDay: 6, exercises: [] };
  const rutina = { id: 'r', schedule: 'flex', days: [{ id: 'n', name: 'Empuje', exercises: [] }, dia] };
  const log = (d, n, extra = {}) => ({
    id: `l${d}`, routineId: 'r', dayName: 'Dominadas sueltas', date: masDias(hoy, -d) + 3600000,
    exercises: [{ sets: Array.from({ length: n }, () => ({ completed: true })) }], ...extra,
  });
  const normal = { ...log(0, 20), dayName: 'Empuje' };
  ok('un entreno de antes se reconoce por el nombre del día', esEntrenoGtg(log(1, 3), rutina) && !esEntrenoGtg(normal, rutina));
  const dias = seriesGtgPorDia([log(0, 6, { gtg: { objetivo: 6 } }), log(1, 4, { gtg: { objetivo: 8 } }), log(3, 5), normal], rutina, 14, HOY);
  ok('14 días, del más antiguo a hoy', dias.length === 14 && dias[13].dia === hoy);
  ok('hoy: 6 de 6 (el entreno normal no se cuela)', dias[13].hechas === 6 && dias[13].objetivo === 6);
  ok('ayer: 4 de 8, lo que se buscaba ese día', dias[12].hechas === 4 && dias[12].objetivo === 8);
  ok('uno sin marca, con el objetivo del plan', dias[10].hechas === 5 && dias[10].objetivo === 6);
  const r = resumenDeSeries(dias);
  ok('la semana: 15 series en 3 días, 1 cumplido', r.semana === 15 && r.dias === 3 && r.cumplidos === 1 && r.media === 5);

  const rd = { id: 'yo', activa: true, nombre: 'Cada día', ejercicios: [{ id: 'pino', nombre: 'Pino', objetivo: '', series: 3 }] };
  const diasRd = seriesDiariasPorDia(
    [
      { id: 'a', clientId: 'yo', date: masDias(hoy, -1), hechos: ['pino#1', 'pino#2'], total: 4 },
      { id: 'b', clientId: 'yo', date: masDias(hoy, -2), hechos: ['pino#1'] },
    ],
    rd,
    14,
    HOY
  );
  ok('rutina diaria: con lo que había que hacer ese día', diasRd[12].hechas === 2 && diasRd[12].objetivo === 4);
  ok('y los de antes, con la rutina de ahora', diasRd[11].hechas === 1 && diasRd[11].objetivo === 3);
}

console.log('\nPantallas, reglas e índices');
{
  ok('la pantalla GTG tiene "Añadir serie" y "Quitar serie"', /onCambiarObjetivo\(p\.objetivo \+ 1\)/.test(lee('components/PantallaGtg.tsx')) && /onCambiarObjetivo\(p\.objetivo - 1\)/.test(lee('components/PantallaGtg.tsx')));
  const entreno = lee('app/(client)/workout.tsx');
  ok('el entreno lo guarda con el día', /updateWorkoutLog\(gtgLog\.id, \{ gtg: \{ objetivo: n \} \}\)/.test(entreno) && /gtg,\n\s*\}\);/.test(entreno));
  ok('la rutina diaria tiene su más y su menos', /cambiarSeries\(e\.id, series \+ 1\)/.test(lee('components/RutinaDiariaDelDia.tsx')));
  ok('el alumno lo ve en Progreso', /<SeriesDelGtg clientId=\{uid\}/.test(lee('app/(client)/progress.tsx')));
  ok('y el entrenador en su ficha', /<SeriesDelGtg\s+clientId=\{id\}\s+trainerId=\{profile\.uid\}/.test(lee('app/(trainer)/clients/[id]/index.tsx')));
  ok('las reglas dejan guardar las series de hoy', /'esfuerzo', 'gtg'\]/.test(lee('firestore.rules')));
  ok('con su índice para el historial', (lee('firestore.indexes.json').match(/"rutinasDiariasDias"/g) ?? []).length >= 2);
  ok('el cambio de series se reemplaza entero al guardar', /mergeFields: Object\.keys\(datos\)/.test(lee('lib/firestore/rutinaDiaria.ts')));
}

console.log(fallos === 0 ? '\n✔ Las series del grease the groove se ajustan y se ven día a día' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
