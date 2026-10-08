/**
 * El periodo de coaching: hasta cuándo entra el alumno y cuándo se le pausa.
 *
 * Es la regla que más cara sale si se equivoca en cualquiera de los dos
 * sentidos. Si pausa de menos, el entrenador trabaja sin enterarse de que el
 * periodo se acabó. Si pausa de más, un alumno al día se queda fuera de su
 * propio entrenamiento sin haber hecho nada mal.
 *
 * El calendario que se comprueba aquí (lib/coaching.ts y planBase.ts):
 *
 *   hasta 7 días antes     → entra, con aviso de que se acaba
 *   el día que acaba       → entra
 *   días 1-5 después       → entra, con aviso de que se pausa
 *   día 6                  → PAUSADA
 *   pedir renovar          → avisa al entrenador, pero NO la abre
 *   el entrenador renueva  → entra
 *
 * Sin euros: desde que la app no lleva cobros, la cuota ya no cuenta.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-bloqueo.mjs
 */
import { readFileSync } from 'node:fs';
import { CLIENT_GRACE_DAYS, clientDaysUntilLock, clientIsLocked } from '../lib/planBase.ts';
import {
  alargar,
  coachingDe,
  DIAS_DE_AVISO,
  DIAS_DE_MARGEN,
  fechaEscrita,
  sumarMeses,
} from '../lib/coaching.ts';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date(2026, 7, 15, 12, 0, 0).getTime();

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Un alumno cuyo periodo acabó hace `dias` días (negativo: le quedan). */
const alumno = (dias, extra = {}) => ({
  uid: 'a1',
  role: 'client',
  name: 'Marcos',
  email: 'marcos@demo.test',
  trainerId: 'coach1',
  nextPaymentDate: AHORA - dias * DIA,
  ...extra,
});

console.log('\nEl estado del periodo');
ok('sin fecha', coachingDe({}, AHORA).estado === 'sin-fecha');
ok('con un mes por delante, activo', coachingDe(alumno(-30), AHORA).estado === 'activo');
ok(`a ${DIAS_DE_AVISO} días, ya avisa`, coachingDe(alumno(-DIAS_DE_AVISO), AHORA).estado === 'acaba');
ok('el último día, acaba', coachingDe(alumno(0), AHORA).estado === 'acaba');
ok('el último día, quedan 0', coachingDe(alumno(0), AHORA).dias === 0);
ok('al día siguiente, terminado', coachingDe(alumno(1), AHORA).estado === 'terminado');
ok(`a los ${DIAS_DE_MARGEN}, todavía terminado`, coachingDe(alumno(DIAS_DE_MARGEN), AHORA).estado === 'terminado');
ok(`a los ${DIAS_DE_MARGEN + 1}, pausado`, coachingDe(alumno(DIAS_DE_MARGEN + 1), AHORA).estado === 'pausado');

console.log('\nEl margen son ' + CLIENT_GRACE_DAYS + ' días');
ok('el mismo margen en los dos sitios', CLIENT_GRACE_DAYS === DIAS_DE_MARGEN);
ok('el día que acaba, entra', !clientIsLocked(alumno(0), AHORA));
ok('al día siguiente, entra', !clientIsLocked(alumno(1), AHORA));
ok('a los 5 días, todavía entra', !clientIsLocked(alumno(5), AHORA));
ok('a los 6, ya no', clientIsLocked(alumno(6), AHORA));
ok('y a los 30 tampoco', clientIsLocked(alumno(30), AHORA));

console.log('\nY se le dice cuánto le queda antes de la pausa');
ok('al día siguiente de acabar, 5 días', clientDaysUntilLock(alumno(1), AHORA) === 5,
  String(clientDaysUntilLock(alumno(1), AHORA)));
ok('a los 5 días, queda 1', clientDaysUntilLock(alumno(5), AHORA) === 1);
ok('pasado el margen, cero', clientDaysUntilLock(alumno(6), AHORA) === 0);
ok('con el periodo en curso, nada que contar', clientDaysUntilLock(alumno(-10), AHORA) === null);

console.log('\nPedir renovar NO abre la app');
// Si la abriera, bastaría con pulsar el botón cada pocos días para no renovar
// nunca. Avisa al entrenador, y es él quien renueva.
ok('pausado y acaba de pedirlo, sigue en pausa', clientIsLocked(alumno(10, { paymentReportedAt: AHORA - 1000 }), AHORA));

console.log('\nLa cuota ya no cuenta: solo la fecha');
ok('sin cuota y con el periodo pasado, en pausa', clientIsLocked(alumno(10, { monthlyFeeEur: 0 }), AHORA));
ok('con cuota y el periodo en curso, entra', !clientIsLocked(alumno(-10, { monthlyFeeEur: 45 }), AHORA));

console.log('\nA quien no tiene periodo NO se le pausa nunca');
ok('sin fecha', !clientIsLocked({ ...alumno(60), nextPaymentDate: undefined }, AHORA));
ok('de cortesía (sistema anterior)', !clientIsLocked(alumno(60, { paymentStatus: 'free' }), AHORA));
ok('de prueba (sistema anterior)', !clientIsLocked(alumno(60, { paymentStatus: 'trial' }), AHORA));
ok('sin entrenador', !clientIsLocked(alumno(60, { trainerId: undefined }), AHORA));
ok('un entrenador', !clientIsLocked(alumno(60, { role: 'trainer' }), AHORA));
ok('sin perfil todavía', !clientIsLocked(null, AHORA));

console.log('\nAlargar el periodo');
{
  const en20 = AHORA + 20 * DIA;
  ok('antes de acabar, se suma al final', alargar(en20, 1, AHORA) === sumarMeses(en20, 1));
  const hace10 = AHORA - 10 * DIA;
  ok('ya acabado, se cuenta desde hoy', alargar(hace10, 1, AHORA) === sumarMeses(AHORA, 1));
  ok('sin fecha, desde hoy', alargar(undefined, 3, AHORA) === sumarMeses(AHORA, 3));
  const f = new Date(sumarMeses(new Date(2026, 0, 31).getTime(), 1));
  ok('el 31 de enero + 1 mes es el 28 de febrero', f.getMonth() === 1 && f.getDate() === 28, f.toDateString());
}

console.log('\nUna fecha escrita a mano');
{
  const f = fechaEscrita('13/02/2027');
  ok('13/02/2027', f !== null && new Date(f).getDate() === 13 && new Date(f).getMonth() === 1);
  ok('13-2-27 también', fechaEscrita('13-2-27') === f);
  ok('y 2027-02-13', fechaEscrita('2027-02-13') === f);
  ok('el 31/02 no existe', fechaEscrita('31/02/2027') === null);
  ok('y "mañana" no es una fecha', fechaEscrita('mañana') === null);
}

console.log('\nLa app ya no habla de dinero con el alumno');
{
  const layout = readFileSync('app/(client)/_layout.tsx', 'utf8');
  ok('el layout del alumno consulta la pausa', /clientIsLocked\(profile\)/.test(layout));
  ok('y enseña la pantalla', /<ClientLockScreen \/>/.test(layout));
  const pantalla = sinComentarios(readFileSync('components/ClientLockScreen.tsx', 'utf8'));
  ok('la pantalla deja pedir renovar', /Quiero renovar/.test(pantalla));
  ok('sin importes ni "ya he pagado"', !/€|Ya he pagado|Pagar ahora|monthlyFeeEur/.test(pantalla));
  ok('y sin forma de saltársela', !/onClose|cerrar|dismiss/i.test(pantalla));
  const inicio = sinComentarios(readFileSync('app/(client)/dashboard.tsx', 'utf8'));
  ok('el inicio del alumno no enseña la cuota', !/monthlyFeeEur|Pagar ahora|urlDePago/.test(inicio));
}

console.log('\nY el entrenador tampoco lleva cobros');
{
  const ficha = sinComentarios(readFileSync('app/(trainer)/clients/[id]/index.tsx', 'utf8'));
  ok('la ficha tiene la tarjeta de Coaching', />Coaching</.test(ficha) && /<PeriodoDeCoaching/.test(ficha));
  ok('y no la de pagos', !/>Pagos</.test(ficha) && !/monthlyFeeEur|createPayment|Registrar pago/.test(ficha));
  const panel = sinComentarios(readFileSync('app/(trainer)/dashboard.tsx', 'utf8'));
  ok('el panel no tiene "Cobros del mes"', !/Cobros del mes|getPaymentsForTrainer|Recordar pagos/.test(panel));
  ok('y sí "Por renovar"', /Por renovar/.test(panel));
}

console.log(fallos === 0 ? '\n✔ El periodo de coaching funciona' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
