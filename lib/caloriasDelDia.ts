import { conMiles } from './texto';

/**
 * LAS CALORÍAS DE HOY: lo del plan contra lo comido.
 *
 * Antes los pasos sumaban al presupuesto ("1.800 del plan + 320 por andar").
 * El conteo de pasos se quitó de la app, así que el presupuesto es el del plan,
 * sin más.
 *
 * `restantes` puede salir negativo a propósito. Enseñar un cero cuando alguien
 * se ha pasado 600 kcal es esconder justo el dato por el que ha entrado.
 */
export interface BalanceDelDia {
  /** Las del plan: el presupuesto de hoy. */
  disponibles: number;
  consumidas: number;
  /** Negativo si se ha pasado. */
  restantes: number;
  pasado: boolean;
}

export function balanceDelDia(objetivo: number, consumidas: number): BalanceDelDia {
  const disponibles = Math.max(0, Math.round(objetivo));
  const com = Math.max(0, Math.round(consumidas));
  const restantes = disponibles - com;
  return { disponibles, consumidas: com, restantes, pasado: restantes < 0 };
}

/** La línea de debajo de la cifra grande. */
export function textoDelBalance(b: BalanceDelDia): string {
  return `${conMiles(b.consumidas)} / ${conMiles(b.disponibles)} kcal`;
}
