import { DAY_MS, hasPlatformAccess } from './planBase';
import type { UserProfile } from './types';

/**
 * La insignia de fundador: el número es tuyo, enseñarlo depende de estar dentro.
 *
 * Aquí van separadas dos cosas que es fácil confundir:
 *
 * - El NÚMERO es un hecho histórico. Fuiste el 28º que pagó su alta y eso no
 *   te lo quita nadie. No se revoca, no se reasigna y no se recicla: si se
 *   pudiera perder, dejaría de significar "el 28º que llegó" para significar
 *   "el intento de pago número 28", y una campaña de cien fundadores acabaría
 *   repartiendo hasta el #250. Lo que hace deseable al número es justo que sea
 *   irrepetible.
 *
 * - La INSIGNIA —el número en oro, con su escudo— es de quien está dentro. Se
 *   apaga cuando la cuenta deja de tener acceso y se vuelve a encender sola al
 *   volver, con el MISMO número. "Vuelve y recuperas tu #28" mueve mucho más
 *   que "vuelve y te damos el #187", y llega justo cuando la persona está
 *   sacando la tarjeta.
 *
 * "Estar dentro" no se define aquí: es `hasPlatformAccess` (lib/planBase.ts),
 * la misma puerta que decide si se ve la app o el muro de pago. Que sea la
 * misma es lo que hace la promesa creíble —la insignia está encendida
 * exactamente cuando puedes entrar, ni un caso más ni uno menos— y de paso
 * evita el fallo tonto de cambiar el criterio en un sitio y no en el otro.
 *
 * De ahí sale, por rol:
 *
 * - ATLETA: mientras su plan o su prueba estén vigentes. Se autoentrena y paga
 *   por ello; si deja de pagar, deja de estar dentro.
 * - ENTRENADOR: mientras su cuenta tenga acceso, AUNQUE SEA GRATIS. El alta de
 *   1 € incluye cinco plazas y un coach con cinco alumnos o menos está usando
 *   el producto exactamente como está pensado: quitarle la insignia por no
 *   pagar un plan que no necesita sería castigar al que mejor encaja.
 * - ALUMNO de un coach: entra gratis por definición, así que nunca la pierde.
 *
 * Un detalle que se ve al usarlo: la insignia APAGADA no se llega a ver en el
 * perfil, porque quien la tiene apagada no ve el perfil. Su sitio es el muro de
 * pago, y allí es donde más vale: "vuelve y recuperas tu #0028" llega justo
 * cuando la persona está decidiendo si se va.
 */

/** Días de aviso antes de que la insignia se apague. */
export const AVISO_DIAS = 5;

export interface EstadoInsignia {
  /** El número, si lo tiene. Es suyo pase lo que pase. */
  numero?: number;
  /** ¿Se enseña encendida? */
  activa: boolean;
  /**
   * Días que quedan para que se apague, cuando ya está en el aviso.
   * `null` si no hay cuenta atrás (o si ya está apagada).
   */
  diasParaApagarse: number | null;
}

export function estadoInsignia(p: UserProfile | null, ahora = Date.now()): EstadoInsignia {
  const numero =
    typeof p?.founderNumber === 'number' && p.founderNumber > 0 ? p.founderNumber : undefined;
  if (!p || numero === undefined) {
    return { numero: undefined, activa: false, diasParaApagarse: null };
  }

  // "Estar dentro" no se vuelve a decidir aquí: es exactamente la misma puerta
  // que deja pasar a la app o enseña el muro de pago. Si algún día se cambia el
  // criterio, la insignia lo sigue sola.
  const activa = hasPlatformAccess(p, ahora);
  if (!activa) return { numero, activa: false, diasParaApagarse: null };

  // La cuenta atrás solo tiene sentido si al caducar se va a perder el acceso.
  // En vez de volver a razonar quién lo pierde, se le pregunta a la misma
  // puerta poniéndola un instante DESPUÉS de la fecha: si aún así deja pasar
  // —un coach por debajo de sus plazas, un admin, una cuenta antigua—, no hay
  // nada que avisar, y meterle prisa con algo que no le va a pasar solo enseña
  // a ignorar los avisos.
  const caduca = p.subscriptionUntil;
  if (caduca === undefined) return { numero, activa: true, diasParaApagarse: null };
  if (hasPlatformAccess(p, caduca + 1)) return { numero, activa: true, diasParaApagarse: null };

  const dias = Math.ceil((caduca - ahora) / DAY_MS);
  return {
    numero,
    activa: true,
    diasParaApagarse: dias <= AVISO_DIAS ? Math.max(0, dias) : null,
  };
}

/** "#0028". Cuatro cifras siempre: un "#7" no parece un número de serie. */
export function numeroFundador(n: number): string {
  return `#${String(n).padStart(4, '0')}`;
}
