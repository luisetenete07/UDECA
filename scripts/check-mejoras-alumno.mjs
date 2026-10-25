/**
 * Las mejoras del alumno de la tanda de octubre.
 *
 *  1. Modo foco: la serie que toca, encendida, y se marca con su ✓ (sin un
 *     botón grande "Hecha" aparte: eran dos formas de hacer lo mismo).
 *  2. Widget "Hoy" en la pantalla del móvil (Android).
 *  3. Resumen del domingo por push.
 *  4. El récord con su historia: cuánto ha subido y desde cuándo.
 *  5. Los hábitos del día, dentro de la tarjeta del día.
 *  6. Los logros, en Progreso.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-mejoras-alumno.mjs
 */
import { readFileSync } from 'node:fs';
import { contextoDelRecord, contextoEnUnaLinea, haceTiempo } from '../lib/livePR.ts';
import { datosDelWidget } from '../lib/widgetDatos.ts';
import { resumenDeLaSemana, seriesHechas } from '../payments-webhook/api/_resumen.js';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const lee = (f) => readFileSync(f, 'utf8');
const DIA = 86_400_000;
const AHORA = Date.UTC(2026, 9, 15, 12);

console.log('\n1. Modo foco');
{
  const w = lee('app/(client)/workout.tsx');
  ok('la serie que toca se enciende', /const serieQueToca = exercise\.sets\.findIndex\(\(s\) => !s\.completed\);/.test(w) && /esAhora=\{!exercise\.saltado && setIndex === serieQueToca\}/.test(w));
  ok('cada serie se marca con su ✓', /updateSet\(exerciseIndex, setIndex, 'completed', !set\.completed\)/.test(w));
  // Sin el botón grande "Hecha · Serie N" debajo: dos formas de hacer lo
  // mismo, una al lado de la otra, era justo el exceso de botones.
  ok('sin botón grande "Hecha" aparte, ni suelto ni en la superserie',
    !/updateSet\(exerciseIndex, serieQueToca, 'completed', true\)/.test(w) &&
      !/updateSet\(siguiente\.ejercicio, siguiente\.serie, 'completed', true\)/.test(w));
  ok('"Siguiente" solo en dorado con el bloque hecho', /bloqueVisibleHecho && styles\.navNext/.test(w));
}

console.log('\n2. Widget "Hoy"');
{
  const base = { dia: AHORA, objetivoPasos: 10000, pasos: 4200 };
  const d = datosDelWidget({ ...base, nombreDelDia: 'Empuje', ejercicios: 5 });
  ok('día de entreno: nombre y ejercicios', d.titulo === 'Empuje' && d.detalle === '5 ejercicios' && !d.hecho);
  ok('hecho: lo dice', datosDelWidget({ ...base, nombreDelDia: 'Empuje', hecho: true }).hecho);
  ok('descanso', datosDelWidget({ ...base, descanso: true }).titulo === 'Descanso');
  ok('en pausa', datosDelWidget({ ...base, enPausa: true }).titulo === 'Plan en pausa');
  ok('sin plan', datosDelWidget({ ...base, sinPlan: true }).titulo === 'Sin plan todavía');
  const app = JSON.parse(lee('app.json'));
  const plugin = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'react-native-android-widget');
  ok('el widget está declarado para Android', !!plugin && plugin[1].widgets.some((w) => w.name === 'Hoy'));
  const entrada = lee('index.js');
  ok('la entrada lo registra solo en Android', /if \(Platform\.OS === 'android'\)[\s\S]*registerWidgetTaskHandler/.test(entrada));
  ok('y la app arranca por esa entrada', JSON.parse(lee('package.json')).main === 'index.js');
  ok('el inicio le deja apuntado lo de hoy', /guardarDatosDelWidget\(\s*datosDelWidget\(/.test(lee('app/(client)/dashboard.tsx')));
  ok('lo de otro día no se enseña como de hoy', /datos\.dia === inicioDelDia\(ahora\)/.test(lee('components/WidgetHoy.tsx')));
}

console.log('\n3. Resumen del domingo');
{
  const r = resumenDeLaSemana({ entrenos: 3, series: 48, pasos: 52300, racha: 5 });
  ok('con entrenos, series y pasos', r?.body === '3 entrenos, 48 series y 52.300 pasos esta semana. Llevas una racha de 5 días.', r?.body);
  ok('sin entrenar, no se manda', resumenDeLaSemana({ entrenos: 0, series: 0, pasos: 9000, racha: 0 }) === null);
  ok('cuenta solo series hechas', seriesHechas({ exercises: [{ sets: [{ completed: true }, { completed: false }] }] }) === 1);
  const cron = lee('payments-webhook/api/cron-daily.js');
  ok('el servidor lo manda los domingos', /const esDomingo = new Date\(now\)\.getDay\(\) === 0;/.test(cron));
  ok('respeta el interruptor del alumno', /u\.weeklySummaryEnabled !== false/.test(cron));
  ok('y ese día no se suma el aviso de inactividad', /!resumenEnviado &&/.test(cron));
  ok('el interruptor está en el perfil', /weeklySummaryEnabled: next/.test(lee('app/(client)/profile.tsx')));
}

console.log('\n4. El récord con su historia');
{
  ok('días, semanas y meses', haceTiempo(3) === 'hace 3 días' && haceTiempo(35) === 'hace 5 semanas' && haceTiempo(95) === 'hace 3 meses');
  const ex = { exerciseId: 'dom', name: 'Dominadas', measure: 'reps', sets: [] };
  const historia = [
    { id: 'a', date: AHORA - 40 * DIA, exercises: [{ ...ex, sets: [{ reps: '8', completed: true }] }] },
    { id: 'b', date: AHORA - 10 * DIA, exercises: [{ ...ex, sets: [{ reps: '7', completed: true }] }] },
  ];
  const c = contextoDelRecord(historia, ex, [{ reps: '11', completed: true }], false, AHORA);
  ok('cuánto ha subido', c.mejora === '+3 reps', c.mejora);
  ok('desde cuándo tenía la marca', c.desde === 'hace 6 semanas', c.desde);
  ok('en una línea', contextoEnUnaLinea(c, '8 reps') === '+3 reps · antes 8 reps, hace 6 semanas');
  ok('el aviso del momento lo enseña', /mejora=\{prVivo\.mejora\}/.test(lee('app/(client)/workout.tsx')));
  ok('y el resumen del final', /pr\.contexto/.test(lee('components/DespuesDelEntreno.tsx')));
}

console.log('\n5. Los hábitos, en la tarjeta del día');
{
  const d = lee('app/(client)/dashboard.tsx');
  ok('van dentro, con su cuenta', /styles\.habitosFila/.test(d) && /habitosHechos/.test(d));
  ok('y ya no en una tarjeta aparte', !/Hábitos de hoy/.test(d));
}

console.log('\n6. Los logros, en Progreso');
{
  ok('están en Progreso', /<LogrosDelAlumno/.test(lee('app/(client)/progress.tsx')));
  ok('y ya no en el perfil', !/computeAchievements/.test(lee('app/(client)/profile.tsx')));
}

console.log(fallos === 0 ? '\n✔ Las seis mejoras del alumno, en su sitio' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
