/**
 * Fechas de cobro de las cuotas de los alumnos.
 *
 * Regla del negocio: el mes cobrado empieza SIEMPRE en la fecha en la que
 * tocaba pagar, no en la que se paga. Si un alumno debía pagar el día 5 y paga
 * el 8, su siguiente cobro sigue siendo el día 5. Antes se contaba desde el día
 * del pago, así que cada retraso empujaba la fecha un poco más y no volvía
 * atrás nunca: en un año, un alumno que se retrasa unos días cada mes acaba
 * pagando once mensualidades en vez de doce.
 */

/**
 * Suma meses conservando el día del mes.
 *
 * `setMonth` a secas desborda: el 31 de enero + 1 mes da 3 de marzo, porque
 * febrero no tiene 31. Aquí se recorta al último día del mes de destino, que es
 * lo que espera cualquiera que cobre el 31: 31 ene → 28 feb → 31 mar.
 */
export function addMonthsExact(ts: number, months: number): number {
  const d = new Date(ts);
  const day = d.getDate();
  // Se pasa al día 1 antes de cambiar de mes para que el salto no desborde.
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTarget));
  return d.getTime();
}

/**
 * Siguiente fecha de cobro al registrar un pago.
 *
 * Se cuenta desde `dueDate` tanto si ya pasó (pago con retraso) como si aún no
 * ha llegado (pago adelantado): en ambos casos el alumno conserva su día de
 * cobro. Solo cuando no hay fecha previa —primer pago— se arranca desde hoy.
 *
 * `anchorDay` es el día del mes en que se cobra a ese alumno. Hace falta para
 * quien cobra en 29, 30 o 31: sin él, al pasar por febrero la fecha cae a 28 y
 * se queda ahí para siempre. Con él, febrero recorta a 28 pero marzo vuelve
 * a 31, que es como funciona cualquier pasarela de cobro seria.
 */
export function nextBillingDate(
  dueDate: number | undefined,
  anchorDay?: number,
  now: number = Date.now()
): number {
  const base = dueDate ?? now;
  const next = addMonthsExact(base, 1);
  if (!anchorDay) return next;
  const d = new Date(next);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(anchorDay, lastDayOfTarget));
  return d.getTime();
}

/** Día del mes en que se le cobra a un alumno (el ancla de su ciclo). */
export function billingAnchorOf(dueDate: number): number {
  return new Date(dueDate).getDate();
}

/**
 * Mensualidades que le siguen faltando a un alumno después de registrar un
 * pago. Con la regla de arriba, alguien que lleva tres meses sin pagar sigue
 * debiendo dos después de pagar una: un cobro cubre un mes, no borra el
 * historial. Sirve para avisar al coach en vez de dejarle creyendo que ya está
 * al día.
 */
export function periodsOwed(nextDate: number, now: number = Date.now()): number {
  if (nextDate > now) return 0;
  let owed = 0;
  let cursor = nextDate;
  // Tope de seguridad: nadie debería acumular más de 10 años de impagos.
  while (cursor <= now && owed < 120) {
    owed += 1;
    cursor = addMonthsExact(cursor, 1);
  }
  return owed;
}
