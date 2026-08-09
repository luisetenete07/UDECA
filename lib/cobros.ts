import { inicioDelMes } from './fechas';
import type { Payment, UserProfile } from './types';

/**
 * El resumen de cobros del entrenador: lo que ha entrado, lo que falta y a
 * quién hay que reclamar.
 *
 * Estaba calculado dentro del cuerpo de app/(trainer)/dashboard.tsx, entre el
 * JSX, y no lo comprobaba nada. Son los números con los que un entrenador
 * decide a quién escribir y cuánto cree que ha ganado este mes: equivocarse en
 * uno es reclamarle a quien ya pagó, y equivocarse en el otro es cuadrar mal
 * las cuentas de su negocio. Aquí se pueden comprobar sin abrir la app.
 *
 * DOS COSAS QUE NO SON LO MISMO
 *
 * `pendiente` sale del ESTADO que el entrenador marca a mano ("pago
 * pendiente", "vencido") y `vencidos` sale de la FECHA de renovación ya
 * pasada. Se parecen, pero no siempre coinciden: un alumno puede tener la
 * fecha pasada y estar marcado como pagado porque el entrenador aún no ha
 * movido la fecha. Se dan los dos porque responden a preguntas distintas —a
 * quién reclamo y qué se me ha pasado— y mezclarlos escondería justo los casos
 * en los que el entrenador se ha despistado.
 *
 * Los ingresos SIEMPRE salen de los pagos registrados, nunca de las cuotas: la
 * cuota es lo que se debería cobrar y el pago es lo que se ha cobrado. Contar
 * cuotas como ingresos sería contar dinero que no ha llegado.
 */

const DIA = 24 * 60 * 60 * 1000;

export interface ResumenDeCobros {
  /** ¿Merece la pena enseñar nada de cobros? Sin datos, la tarjeta sobra. */
  hayDatos: boolean;
  /** Alumnos marcados como "pendiente" o "vencido": a los que hay que reclamar. */
  aReclamar: UserProfile[];
  /** Lo que suman sus cuotas. */
  importePendiente: number;
  /** Cuántos alumnos hay en cada estado de pago. */
  porEstado: Record<string, number>;
  /** Alumnos cuya fecha de renovación ya pasó. */
  vencidos: number;
  /** Alumnos que renuevan en los próximos 7 días. */
  renuevanPronto: number;
  /** Cobrado este mes, de los pagos registrados. */
  ingresoDelMes: number;
  /** Cobrado desde siempre. */
  ingresoTotal: number;
  /** Pagos de este mes, del más reciente al más antiguo. */
  pagosDelMes: Payment[];
  /** Todos los pagos, del más reciente al más antiguo. */
  pagos: Payment[];
  /** Lo que entraría en 30 días si todos renuevan con su cuota actual. */
  previsto30: number;
  /** Los alumnos de esa previsión, para poder enseñar de quién sale. */
  renuevanEn30: UserProfile[];
  /** El alumno que renueva antes, para poder decir de quién es el próximo cobro. */
  proximoCobro: UserProfile | null;
}

const PENDIENTES = ['pending', 'overdue'];

export function resumenDeCobros(
  clients: UserProfile[],
  payments: Payment[],
  ahora = Date.now()
): ResumenDeCobros {
  const aReclamar = clients.filter((c) => PENDIENTES.includes(c.paymentStatus ?? ''));

  const porEstado = clients.reduce(
    (acc, c) => {
      if (c.paymentStatus) acc[c.paymentStatus] = (acc[c.paymentStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const desdeElUno = inicioDelMes(ahora);
  const pagos = [...payments].sort((a, b) => b.date - a.date);
  const pagosDelMes = pagos.filter((p) => p.date >= desdeElUno);
  const suma = (lista: Payment[]) => lista.reduce((s, p) => s + (p.amountEur || 0), 0);

  // Solo cuentan los que tienen cuota puesta: sumar cero por cada alumno sin
  // cuota daría una previsión más baja de la real y sin decir por qué.
  const renuevanEn30 = clients.filter(
    (c) =>
      c.nextPaymentDate &&
      c.nextPaymentDate >= ahora &&
      c.nextPaymentDate < ahora + 30 * DIA &&
      (c.monthlyFeeEur ?? 0) > 0
  );

  return {
    hayDatos:
      clients.some((c) => c.paymentStatus || c.monthlyFeeEur || c.nextPaymentDate) ||
      payments.length > 0,
    aReclamar,
    importePendiente: aReclamar.reduce((s, c) => s + (c.monthlyFeeEur ?? 0), 0),
    porEstado,
    vencidos: clients.filter((c) => c.nextPaymentDate && c.nextPaymentDate < ahora).length,
    renuevanPronto: clients.filter(
      (c) => c.nextPaymentDate && c.nextPaymentDate >= ahora && c.nextPaymentDate < ahora + 7 * DIA
    ).length,
    ingresoDelMes: suma(pagosDelMes),
    ingresoTotal: suma(payments),
    pagosDelMes,
    pagos,
    previsto30: renuevanEn30.reduce((s, c) => s + (c.monthlyFeeEur ?? 0), 0),
    renuevanEn30,
    proximoCobro:
      clients
        .filter((c) => c.nextPaymentDate && c.nextPaymentDate >= ahora)
        .sort((a, b) => (a.nextPaymentDate ?? 0) - (b.nextPaymentDate ?? 0))[0] ?? null,
  };
}

/**
 * Alumnos que llevan sin entrenar más de `dias`.
 *
 * El que nunca ha entrenado cuenta como inactivo: es al que más falta le hace
 * que su entrenador se dé cuenta, y dejarlo fuera por no tener ninguna sesión
 * con la que comparar sería esconder justo ese caso.
 */
export function alumnosInactivos(
  clients: UserProfile[],
  logs: { clientId: string; date: number }[],
  dias: number,
  ahora = Date.now()
): UserProfile[] {
  const ultimo = new Map<string, number>();
  for (const log of logs) {
    const actual = ultimo.get(log.clientId);
    if (!actual || log.date > actual) ultimo.set(log.clientId, log.date);
  }
  return clients.filter((c) => {
    const fecha = ultimo.get(c.uid);
    if (!fecha) return true;
    return (ahora - fecha) / DIA > dias;
  });
}
