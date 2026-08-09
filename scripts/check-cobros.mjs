/*
 * El resumen de cobros del entrenador (lib/cobros.ts).
 *
 * Son los números con los que decide a quién escribir y cuánto cree que ha
 * ganado. Los dos fallos que importan son de signo contrario y los dos hacen
 * daño: contar de más el ingreso (cuadrar mal las cuentas de su negocio) y
 * contar de más lo pendiente (reclamarle a quien ya pagó, que es la forma más
 * rápida de perder a un alumno).
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-cobros.mjs
 */
import { alumnosInactivos, resumenDeCobros } from '../lib/cobros.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const DIA = 24 * 60 * 60 * 1000;
/** Jueves 20 de agosto de 2026, media mañana. */
const AHORA = new Date(2026, 7, 20, 11, 0).getTime();

const alumno = (uid, extra = {}) => ({ uid, name: uid, email: `${uid}@x`, role: 'client', ...extra });
const pago = (dia, importe) => ({
  id: `p${dia}`,
  trainerId: 't',
  clientId: 'a',
  date: new Date(2026, 7, dia, 12).getTime(),
  amountEur: importe,
});

console.log('\nSin nada que enseñar, no se enseña nada');
{
  const r = resumenDeCobros([alumno('a'), alumno('b')], [], AHORA);
  comprueba('un grupo sin cuotas ni pagos no tiene datos', r.hayDatos === false);
  comprueba('ni ingresos', r.ingresoDelMes === 0 && r.ingresoTotal === 0);
  comprueba('ni nadie a quien reclamar', r.aReclamar.length === 0);
  comprueba('un solo pago ya es motivo', resumenDeCobros([], [pago(3, 40)], AHORA).hayDatos);
  comprueba(
    'y una cuota puesta también',
    resumenDeCobros([alumno('a', { monthlyFeeEur: 45 })], [], AHORA).hayDatos
  );
}

console.log('\nA quién hay que reclamar');
{
  const clientes = [
    alumno('paga', { paymentStatus: 'paid', monthlyFeeEur: 50 }),
    alumno('debe', { paymentStatus: 'pending', monthlyFeeEur: 45 }),
    alumno('vencido', { paymentStatus: 'overdue', monthlyFeeEur: 60 }),
    alumno('prueba', { paymentStatus: 'trial', monthlyFeeEur: 30 }),
    alumno('gratis', { paymentStatus: 'free' }),
  ];
  const r = resumenDeCobros(clientes, [], AHORA);
  comprueba('solo pendientes y vencidos', r.aReclamar.length === 2, String(r.aReclamar.length));
  comprueba(
    'el que ya pagó NO entra',
    !r.aReclamar.some((c) => c.uid === 'paga')
  );
  comprueba('el de prueba tampoco', !r.aReclamar.some((c) => c.uid === 'prueba'));
  comprueba('suman sus cuotas: 45 + 60', r.importePendiente === 105, String(r.importePendiente));
  comprueba('y se cuentan por estado', r.porEstado.paid === 1 && r.porEstado.overdue === 1);
  comprueba('el que no tiene estado no cuenta en ninguno', !('undefined' in r.porEstado));
}

console.log('\nLos ingresos salen de los pagos, nunca de las cuotas');
{
  // Una cuota es lo que se DEBERÍA cobrar; un pago es lo que se ha cobrado.
  // Contar cuotas aquí sería contar dinero que no ha llegado.
  const clientes = [alumno('a', { monthlyFeeEur: 500, paymentStatus: 'pending' })];
  const r = resumenDeCobros(clientes, [], AHORA);
  comprueba('con cuota de 500 y ningún pago, el ingreso es 0', r.ingresoDelMes === 0);
  comprueba('pero lo pendiente sí son 500', r.importePendiente === 500);
}

console.log('\nEl mes es el mes natural');
{
  const pagos = [
    pago(1, 40), // el día 1 de agosto: entra
    pago(20, 50), // hoy: entra
    { ...pago(31, 30), date: new Date(2026, 6, 31, 23, 59).getTime() }, // 31 de julio: fuera
  ];
  const r = resumenDeCobros([], pagos, AHORA);
  comprueba('el día 1 cuenta', r.pagosDelMes.some((p) => p.amountEur === 40));
  comprueba('el último día del mes anterior no', !r.pagosDelMes.some((p) => p.amountEur === 30));
  comprueba('el ingreso del mes son 90', r.ingresoDelMes === 90, String(r.ingresoDelMes));
  comprueba('el total son 120', r.ingresoTotal === 120, String(r.ingresoTotal));
  comprueba('los pagos vienen del más reciente al más antiguo', r.pagos[0].amountEur === 50);
  comprueba('un pago sin importe no rompe la suma',
    resumenDeCobros([], [{ ...pago(5, undefined) }], AHORA).ingresoDelMes === 0);
}

console.log('\nLo vencido y lo que está por llegar van por FECHA, no por estado');
{
  const clientes = [
    alumno('atrasado', { nextPaymentDate: AHORA - 3 * DIA, monthlyFeeEur: 40 }),
    alumno('estasemana', { nextPaymentDate: AHORA + 2 * DIA, monthlyFeeEur: 50 }),
    alumno('estemes', { nextPaymentDate: AHORA + 20 * DIA, monthlyFeeEur: 60 }),
    alumno('lejos', { nextPaymentDate: AHORA + 90 * DIA, monthlyFeeEur: 70 }),
    alumno('sinfecha', { monthlyFeeEur: 80 }),
  ];
  const r = resumenDeCobros(clientes, [], AHORA);
  comprueba('un vencido', r.vencidos === 1, String(r.vencidos));
  comprueba('uno renueva esta semana', r.renuevanPronto === 1, String(r.renuevanPronto));
  comprueba('lo vencido NO cuenta como "renueva pronto"', r.renuevanPronto === 1);
  comprueba(
    'la previsión a 30 días son 50 + 60',
    r.previsto30 === 110,
    String(r.previsto30)
  );
  comprueba('el de dentro de 90 días queda fuera', r.previsto30 !== 180);
  comprueba('el próximo cobro es el más cercano', r.proximoCobro?.uid === 'estasemana');
  comprueba('y no uno ya vencido', r.proximoCobro?.uid !== 'atrasado');

  // Un alumno sin cuota puesta no puede sumar a la previsión: sumaría cero y
  // daría una cifra más baja de la real sin decir por qué.
  const conCero = resumenDeCobros(
    [...clientes, alumno('sincuota', { nextPaymentDate: AHORA + 5 * DIA })],
    [],
    AHORA
  );
  comprueba('el que no tiene cuota no cambia la previsión', conCero.previsto30 === 110);
  comprueba('pero sí cuenta como que renueva pronto', conCero.renuevanPronto === 2);
}

console.log('\nEstado y fecha responden a preguntas distintas');
{
  // El caso que se escondería mezclándolos: el entrenador cobró y marcó
  // "pagado" pero no movió la fecha. No hay que reclamarle, y aun así la fecha
  // pasada es algo que él tiene que ver.
  const clientes = [alumno('despiste', { paymentStatus: 'paid', nextPaymentDate: AHORA - DIA })];
  const r = resumenDeCobros(clientes, [], AHORA);
  comprueba('no se le reclama', r.aReclamar.length === 0);
  comprueba('pero la fecha pasada se ve', r.vencidos === 1);
}

console.log('\nQuién lleva sin entrenar');
{
  const clientes = [alumno('constante'), alumno('flojea'), alumno('nunca')];
  const logs = [
    { clientId: 'constante', date: AHORA - 2 * DIA },
    { clientId: 'flojea', date: AHORA - 12 * DIA },
    { clientId: 'constante', date: AHORA - 30 * DIA },
  ];
  const inactivos = alumnosInactivos(clientes, logs, 7, AHORA).map((c) => c.uid);
  comprueba('el que entrenó anteayer no', !inactivos.includes('constante'));
  comprueba('el de hace doce días sí', inactivos.includes('flojea'));
  comprueba(
    'el que NUNCA ha entrenado también: es al que más falta le hace',
    inactivos.includes('nunca')
  );
  comprueba('son dos', inactivos.length === 2, inactivos.join());
  comprueba(
    'manda la sesión más reciente, no la primera que aparece',
    !alumnosInactivos(clientes, logs, 7, AHORA).some((c) => c.uid === 'constante')
  );
  comprueba('justo en el límite todavía no es inactivo',
    !alumnosInactivos([alumno('x')], [{ clientId: 'x', date: AHORA - 7 * DIA }], 7, AHORA).length);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
