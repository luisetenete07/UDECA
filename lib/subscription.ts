import { Platform } from 'react-native';
import type { UserProfile } from './types';
import {
  clientSlotsOf,
  DAY_MS,
  FREE_CLIENT_LIMIT,
  PAGOS_ACTIVOS,
  subscriptionState,
} from './planBase';

/**
 * Los enlaces de Stripe y las direcciones que se abren para pagar viven en
 * lib/enlacesDeCobro.ts, y se reexportan aquí para no tocar ni un import.
 *
 * Están allí por lo mismo que la puerta de acceso está en planBase.ts: este
 * fichero lee `Platform.OS` al cargarse, y eso dejaba sin poder probar en Node
 * justo la parte que decide a qué producto de Stripe se manda a cada persona
 * —que es la que, cuando falla, falla cobrando.
 */
export {
  ATHLETE_ANNUAL_LINK,
  ATHLETE_ENTRY_LINK,
  ATHLETE_PAYMENT_LINK,
  COACH_ENTRY_LINK,
  COACH_PAYMENT_LINK,
  entryCheckoutUrl,
  subscriptionCheckoutUrl,
  type PlanElegido,
} from './enlacesDeCobro';

/**
 * Modelo SaaS de UDECA: los COACHES pagan la plataforma; sus alumnos entran
 * gratis con el código del coach.
 *
 *  - ALTA: 1 € una sola vez, al registrarse, tanto entrenador como atleta.
 *    No es el precio del producto: es el peaje que filtra al curioso y —lo
 *    importante— deja una TARJETA identificada. Ver `ENTRY_PRICE_EUR`.
 *  - ENTRENADOR: con el alta pagada entran FREE_CLIENT_LIMIT alumnos. Para
 *    pasar de ahí, 180 €/año. Entra y usa la app entera desde el primer día;
 *    el muro solo aparece cuando su grupo crece. Pedirle 180 € antes de haber
 *    visto el producto era el mayor punto de fuga del negocio.
 *  - ATLETA: TRIAL_DAYS desde el alta y después 10 €/mes.
 *  - ALUMNO de un coach: gratis siempre.
 *  - Cuentas sin `subscriptionUntil` = fundadoras (anteriores a la
 *    monetización): acceso completo para no romper nada.
 *  - La activación la hace Stripe (o el admin desde su panel); las reglas de
 *    Firestore impiden que un coach se extienda la suscripción a sí mismo.
 */

/**
 * Alta única, en euros.
 *
 * Un euro no financia nada: financia la IDENTIFICACIÓN. Al cobrarlo con
 * tarjeta, Stripe devuelve una huella del medio de pago que es la misma para
 * la misma tarjeta en cualquier cuenta, correo o dispositivo. Es lo que
 * permite que un entrenador no pueda multiplicarse en cuentas de cinco alumnos
 * para no pagar los 180 €, y no cuesta ni un paso más al que va de frente:
 * ya estaba metiendo la tarjeta.
 */
export const ENTRY_PRICE_EUR = 1;
export const ANNUAL_PRICE_EUR = 180;
/**
 * Lo que sale al mes el plan del entrenador.
 *
 * Se enseña este número y no los 180 porque es el que se compara con lo que
 * cobra por UN alumno: 180 de golpe parece una inversión, 15 al mes parece lo
 * que es. Debajo va SIEMPRE, sin excepción, que el cobro es anual y de una
 * vez: enseñar el mensual y cobrar el anual sin decirlo es lo que hace que la
 * gente pida la devolución y se vaya.
 */
export const COACH_MONTHLY_EQUIV_EUR = Math.round(ANNUAL_PRICE_EUR / 12);

/** Atleta individual: cuota mensual (suelta, no anual). */
export const ATHLETE_MONTHLY_EUR = 10;

/**
 * Atleta que paga el año por delante.
 *
 * Son 96 y no 95 por una razón de escaparate: 96 entre 12 son 8,00 € exactos,
 * y "8 € al mes pagando el año" se lee de un vistazo. 95 salen a 7,92, que no
 * se recuerda ni cabe bien en un titular.
 *
 * Y no es un descuento por serlo: un atleta que paga al mes tiene que aguantar
 * DIEZ MESES para dejar lo mismo que este deja el primer día, contando IVA y
 * comisiones. En una app de entrenamiento, la mayoría no llega a seis. El
 * anual no regala margen: cobra por adelantado lo que probablemente no se
 * llegaría a cobrar, y de paso quita once cobros que pueden fallar.
 */
export const ATHLETE_ANNUAL_EUR = 96;

/**
 * Lo que se ahorra pagando el año, en porcentaje.
 *
 * CALCULADO, NUNCA ESCRITO A MANO. Es el único número sobre dinero que la app
 * enseña (ver el bloque de "LA APP NO DICE PRECIOS"), y se salva de esa regla
 * porque no es un precio: es una proporción entre dos, y mientras los dos
 * cambien juntos sigue siendo verdad. Escribir "20%" a mano sería justo lo que
 * esa regla evita — una cifra que se queda vieja en la versión que el usuario
 * no ha actualizado.
 */
export const AHORRO_ANUAL_PCT = Math.round(
  (1 - ATHLETE_ANNUAL_EUR / (ATHLETE_MONTHLY_EUR * 12)) * 100
);

/**
 * Estas cuatro viven en lib/planBase.ts y se reexportan aquí.
 *
 * El motivo: este fichero lee `Platform.OS` al cargarse, así que todo lo que
 * lo importe arrastra React Native entera y no se puede probar en Node pelado.
 * Sacarlas permite comprobar quién tiene acceso sin montar media app; dejarlas
 * reexportadas evita tocar los treinta sitios que ya las importaban de aquí.
 */
export {
  accesoIlimitado,
  ADMIN_EMAILS,
  clientSlotsOf,
  CUENTAS_ILIMITADAS,
  DAY_MS,
  ENTRY_REQUIRED_FROM,
  FREE_CLIENT_LIMIT,
  needsEntryPayment,
  TRIAL_DAYS,
  trialUntil,
  CLIENT_GRACE_DAYS,
  CLIENT_REPORT_GRACE_DAYS,
  clientIsLocked,
  clientDaysUntilLock,
  tocaElAvisoDelAtleta,
} from './planBase';

/** Endpoint de comprobación bajo demanda (Vercel). Activa la cuenta al momento. */
export const CHECK_SUB_URL = 'https://udeca.vercel.app/api/check-subscription';

/** Endpoint que recoge un alta pagada en la web antes de existir la cuenta. */
export const CLAIM_ENTRY_URL = 'https://udeca.vercel.app/api/claim-entry';

/**
 * Reclama el alta pagada desde la web.
 *
 * Quien paga en udeca.app lo hace ANTES de tener cuenta, así que ese euro
 * queda apuntado a su correo. Al registrarse, esto lo recoge y activa la
 * cuenta; sin ello, la app le pediría pagar por segunda vez.
 *
 * Se manda el token de sesión de Firebase, no el uid: el servidor tiene que
 * poder comprobar que quien reclama el pago es de verdad el dueño de ese
 * correo, y un uid suelto no demuestra nada.
 */
export async function claimEntryNow(
  idToken: string
): Promise<{ activa: boolean; motivo?: string }> {
  try {
    const res = await fetch(CLAIM_ENTRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: '{}',
    });
    return (await res.json()) as { activa: boolean; motivo?: string };
  } catch (e) {
    return { activa: false, motivo: e instanceof Error ? e.message : 'Error de red' };
  }
}

/**
 * Pregunta a Stripe (vía backend) si el email del usuario tiene suscripción
 * activa y, si la hay, activa la cuenta. Devuelve el motivo si no puede.
 */
export async function verifySubscriptionNow(
  profile: UserProfile | null
): Promise<{ active: boolean; reason?: string }> {
  if (!profile) return { active: false, reason: 'Sin perfil' };
  try {
    const res = await fetch(CHECK_SUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: profile.uid, email: profile.email }),
    });
    const data = (await res.json()) as { active: boolean; reason?: string };
    return data;
  } catch (e) {
    return { active: false, reason: e instanceof Error ? e.message : 'Error de red' };
  }
}

/*
 * LA APP NO DICE PRECIOS. NUNCA. EN NINGUNA PLATAFORMA.
 *
 * Ni cifras, ni "gratis", ni "desde X". El precio vive en la web y en la página
 * de pago, y la app se limita a decir en qué estado está la cuenta y a abrir
 * esa página cuando hace falta.
 *
 * Se hace así por tres razones que apuntan al mismo sitio:
 *
 *  1. Un precio escrito en la app es un precio que hay que publicar otra vez
 *     cada vez que cambie, y que se queda viejo en la versión que el usuario
 *     no ha actualizado. Una oferta de hace tres meses enseñada como vigente es
 *     peor que no enseñar ninguna.
 *  2. La norma 3.1.1 de la App Store prohíbe enseñar precios de contenido
 *     digital y enlaces a pagar fuera. Teniendo dos textos —uno con precio y
 *     otro sin— la única duda era cuál se colaba en la build de iOS.
 *  3. "Gratis" tampoco: el alumno de un entrenador no paga a UDECA, pero sí le
 *     paga a su entrenador. Poner "gratis" en su tarjeta al registrarse le dice
 *     algo que no es verdad para él.
 *
 * Lo que sí se dice es lo que le pasa a su cuenta ("te quedan 3 días", "esta
 * cuenta no está activa") y, donde se puede, un botón que lleva a la web.
 */

/**
 * ¿Se puede enlazar a pagar DESDE la app?
 *
 * En la web y en Android SÍ; **en iPhone no, aunque los pagos estén
 * encendidos**. Por eso son dos condiciones y no una:
 *
 *  - `PAGOS_ACTIVOS` (lib/planBase.ts) es el interruptor general. Encendido:
 *    los cinco enlaces de producción de aquí arriba cobran de verdad.
 *  - `Platform.OS !== 'ios'` es la norma de Apple, y no depende del anterior.
 *
 * POR QUÉ NO EN IPHONE
 *
 * La norma 3.1.1 obliga a que el contenido digital que se consume dentro de la
 * app se compre con las compras integradas de Apple, y prohíbe los botones y
 * enlaces que lleven a pagar por fuera. Desde las sentencias de EE. UU. y el
 * DMA europeo el enlace externo se permite en algunos sitios, pero las
 * condiciones cambian por país y por versión de las normas: es el motivo de
 * rechazo más común que hay, y llega DESPUÉS de esperar la revisión.
 *
 * Salir sin ese botón cuesta poco y desbloquea la publicación: quien quiera
 * pagar lo hace en udeca.app desde el navegador y vuelve. El alta pagada en la
 * web se recoge sola —`claimEntryNow` en EntryWall— y la cuenta se enciende.
 * Nadie se queda en un callejón sin salida; lo único que no hay en iPhone es
 * el atajo.
 *
 * QUÉ DESAPARECE EN IPHONE, Y QUÉ QUEDA
 *
 * Se apagan los cinco sitios que ofrecían pagar: el aviso de la prueba
 * (TrialBanner), la tarjeta y el aviso del plan (UpgradeCard), el muro de alta
 * (EntryWall) y el de suscripción (Paywall). Lo que queda es el estado de la
 * cuenta —"tu cuenta está sin activar", "no está activa"—, el botón de volver
 * a comprobar y un correo de contacto. Ni precios, ni enlaces de pago.
 *
 * PARA DEJAR DE COBRAR, Y PARA VOLVER
 *
 * `PAGOS_ACTIVOS` a `false` en lib/planBase.ts apaga el cobro en todas partes
 * de golpe, y donde había un botón de pagar se dice que la función todavía no
 * está disponible. Volver a `true` lo devuelve, en web y en Android; el iPhone
 * sigue sin botón, que es lo que queremos.
 *
 * Para que el iPhone TAMBIÉN cobre hay que montar las compras integradas de
 * verdad (StoreKit + acuerdos de pago en App Store Connect), que es otro
 * proyecto. Las dos decisiones están cada una en UNA línea, a propósito.
 *
 * Esto NO afecta a lo que un alumno le paga a su entrenador: eso es un servicio
 * real entre dos personas, no contenido digital, y Apple lo deja fuera de las
 * compras integradas expresamente. Por eso el enlace de cobro del entrenador
 * (lib/enlaceDePago.ts) sigue igual en las tres plataformas.
 */
export const CAN_LINK_TO_PAYMENT = PAGOS_ACTIVOS && Platform.OS !== 'ios';


/** Correo de contacto para activar/renovar manualmente. */
export const CONTACT_EMAIL = 'luistenaf@gmail.com';

export { isAdmin } from './planBase';


/**
 * La puerta de acceso vive en `planBase.ts` y se reexporta desde aquí para no
 * mover ni un import. Está allí porque este fichero lee `Platform.OS` al
 * cargarse, y eso deja las comprobaciones de Node fuera justo de la parte que
 * decide quién entra y quién ve el muro de pago.
 */
export {
  hasPlatformAccess,
  PAGOS_ACTIVOS,
  subscriptionState,
  trainerAtFreeLimit,
  trainerHasAccess,
  type SubscriptionState,
} from './planBase';
