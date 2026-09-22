import type { UserProfile } from './types';

/**
 * Las piezas del plan que no dependen de React Native.
 *
 * Salieron de `lib/subscription.ts` por un motivo concreto: ese fichero lee
 * `Platform.OS` en cuanto se carga, así que cualquier cosa que lo importe
 * arrastra React Native entera. Eso deja fuera a las comprobaciones —que
 * corren en Node pelado— justo en la parte del código donde más falta hacen:
 * la que decide quién tiene acceso y quién paga.
 *
 * Aquí no hay nada nuevo. `subscription.ts` las reexporta, así que todo lo que
 * ya las importaba de allí sigue funcionando igual; simplemente ahora hay un
 * único sitio donde viven y se pueden probar sin trucos.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Días de prueba de las cuentas ANTIGUAS de atleta. Herencia.
 *
 * Veintiocho días era la prueba del modelo de antes. No se puede borrar: hay
 * cuentas con una de esas en marcha y hay que saber leerlas. Lo que se vende
 * hoy son los números de abajo.
 */
export const TRIAL_DAYS = 28;

/** Fin de la prueba de una cuenta de atleta antigua. */
export function trialUntil(from: number = Date.now()): number {
  return from + TRIAL_DAYS * DAY_MS;
}

/**
 * LA PRUEBA GRATUITA. Sin tarjeta, y esa es la decisión importante.
 *
 * Pedir la tarjeta convierte mucho mejor —eso es cierto en general y era mi
 * primera recomendación—, pero aquí choca con una pared: EN iPHONE NO SE PUEDE
 * PEDIR. La norma 3.1.1 de Apple prohíbe mandar a pagar fuera de sus compras
 * integradas, y por eso `CAN_LINK_TO_PAYMENT` está apagada en iOS. Una prueba
 * con tarjeta sería una prueba que en iPhone no se puede ni empezar: ese
 * usuario se seguiría estrellando contra el muro el día cero y tendría que
 * descubrir la web por su cuenta, que es justo el problema que la prueba
 * existe para resolver.
 *
 * Así que sin tarjeta. Se paga en conversión y se cobra en que la app se pueda
 * usar en los tres sitios.
 *
 * POR QUÉ EL ENTRENADOR TIENE EL DOBLE DE DÍAS
 *
 * No es generosidad, es cuánto tarda cada uno en ver de qué va esto.
 *
 * El atleta lo ve en una semana: entrena tres veces y mira su progreso. Eso
 * cabe de sobra en siete días.
 *
 * El entrenador no. Lo suyo es ver a un alumno SUYO completar una sesión que
 * él le mandó, y para llegar ahí tiene que invitar al alumno, montarle la
 * rutina y esperar a que el alumno entrene. En siete días no llega casi nadie,
 * y quien no llega no ha visto el producto: ha visto pantallas vacías.
 */
export const DIAS_DE_PRUEBA_ENTRENADOR = 14;
export const DIAS_DE_PRUEBA_ATLETA = 7;

/** Cuántos días de prueba le tocan a este rol. */
export function diasDePrueba(role: string | undefined): number {
  return role === 'trainer' ? DIAS_DE_PRUEBA_ENTRENADOR : DIAS_DE_PRUEBA_ATLETA;
}

/** Cuándo se le acaba la prueba a una cuenta que nace hoy. */
export function finDeLaPrueba(role: string | undefined, from: number = Date.now()): number {
  return from + diasDePrueba(role) * DAY_MS;
}

/**
 * Con qué suscripción nace una cuenta nueva que paga plataforma.
 *
 * CON SU PRUEBA: 14 días el entrenador, 7 el atleta, sin pedir tarjeta.
 *
 * LAS DOS FECHAS SON LA MISMA, Y ESO ES LO QUE MARCA QUE ES UNA PRUEBA.
 * `subscriptionState` mira si `subscriptionUntil <= trialEndsAt` para saberlo,
 * así que al pagar —que empuja `subscriptionUntil` un año por delante— deja de
 * ser prueba solo, sin borrar nada ni tocar `trialEndsAt`. El histórico de
 * cuándo empezó cada uno se conserva.
 *
 * OJO CON LO QUE PASÓ LA ÚLTIMA VEZ QUE ESTO DIO FECHA. Entre el 11 y el 18 de
 * septiembre el atleta nacía con 28 días de prueba de un modelo que ya no se
 * vendía, y no dio un solo error: en el panel de administración salía "De
 * prueba" en vez de "SIN ACTIVAR", la tarea diaria mandaba avisos de una
 * prueba inexistente, y `subscriptionUntil` guardaba una fecha que nadie había
 * comprado. Ahora esas tres cosas vuelven a ser CIERTAS, porque la prueba
 * existe de verdad. La diferencia entre un dato correcto y uno inventado no se
 * ve en la pantalla: se ve sabiendo qué se está vendiendo.
 *
 * Está aquí, suelto y sin imports, para que el guardián pueda ejecutarlo en
 * vez de leer el texto de auth-context.tsx, que arrastra Firebase.
 */
export function suscripcionAlNacer(
  role: string | undefined,
  from: number = Date.now()
): { subscriptionUntil: number; trialEndsAt: number } {
  const hasta = finDeLaPrueba(role, from);
  return { subscriptionUntil: hasta, trialEndsAt: hasta };
}

/**
 * El primer año, que es lo que se compra al entrar.
 *
 * Antes esto eran 28 días de prueba del atleta y un alta simbólica de 1 €.
 * Ahora la entrada ES el primer año: se paga una vez —27 € el entrenador, 17 €
 * el atleta— y se entra doce meses enteros.
 *
 * El cambio no es de precio, es de promesa. Una prueba de 28 días obliga a
 * decidir justo cuando el trabajo empieza a dar resultados, que es el peor
 * momento para pedir una decisión. Un año por delante quita esa conversación
 * del medio: el primer año se entrena, y la decisión llega cuando ya hay doce
 * meses de progreso encima de la mesa para tomarla.
 *
 * Son 365 días y no "un año de calendario" a propósito: la cuenta se hace en
 * días para que no dependa de en qué mes se dio de alta nadie.
 */
export const PRIMER_ANO_DIAS = 365;

/** Hasta cuándo llega una cuenta que paga su primer año ahora. */
export function primerAnoHasta(from: number = Date.now()): number {
  return from + PRIMER_ANO_DIAS * DAY_MS;
}

/**
 * Desde cuándo rige el modelo del primer año.
 *
 * Quien ya estaba dentro con las reglas viejas —el entrenador con sus cinco
 * alumnos gratis para siempre, el atleta en sus 28 días de prueba— sigue con
 * ellas. Cambiar las condiciones a mitad de partida y dejar fuera a quien ya
 * había entrado es la forma más rápida de perder a los primeros, que son justo
 * los que menos merecen perderse.
 *
 * Es la misma cautela que ya se tuvo con `ENTRY_REQUIRED_FROM`, y por el mismo
 * motivo.
 */
export const PRIMER_ANO_DESDE = Date.parse('2026-09-11T00:00:00Z');

/** ¿Se rige esta cuenta por el modelo nuevo (primer año de pago)? */
export function conModeloDePrimerAno(profile: { createdAt?: number } | null): boolean {
  return (profile?.createdAt ?? 0) >= PRIMER_ANO_DESDE;
}

/**
 * Alumnos que caben en el plan de entrada del entrenador.
 *
 * Con el primer año pagado (27 €) el entrenador tiene la app entera y hasta
 * cinco alumnos. Para pasar de ahí está el plan plus, que quita el tope.
 *
 * Cinco no es un número al azar: es el grupo con el que un entrenador
 * comprueba si esto le sirve —suficiente para llevarlo de verdad, corto para
 * que crecer se note— y es el mismo que ya tenían las cuentas anteriores.
 *
 * Este número vive en TRES sitios que no pueden importarse entre sí: aquí,
 * payments-webhook/api/join.js (el servidor, que es quien decide) y
 * firestore.rules (que lo impone para las versiones antiguas de la app). Si lo
 * cambias, cámbialo en los tres.
 */
export const FREE_CLIENT_LIMIT = 5;

/** Plazas de alumno de esta cuenta: las del alta salvo que el servidor las baje. */
export function clientSlotsOf(profile: { clientSlots?: number } | null): number {
  const n = profile?.clientSlots;
  return typeof n === 'number' && n >= 0 ? n : FREE_CLIENT_LIMIT;
}

/**
 * Correos con poderes de administración de UDECA (gestión de suscripciones).
 * Los admins tienen acceso completo de por vida (nunca pagan ni caducan).
 */
export const ADMIN_EMAILS = ['luisetenete07@gmail.com', 'luistenaf@gmail.com'];

export function isAdmin(profile: UserProfile | null): boolean {
  return !!profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase());
}

/**
 * ¿Se cobra ya en UDECA?
 *
 * Está aquí, en el fichero puro, porque lo mira la puerta de entrada
 * (`needsEntryPayment`) y esa tiene que poder comprobarse sin arrancar la app.
 *
 * AHORA MISMO SÍ. Los cinco Payment Links de producción están en
 * lib/enlacesDeCobro.ts y las claves de Vercel son del MISMO perfil de Stripe en
 * el que se crearon (el de UDECA).
 *
 * Esa coincidencia es todo: estuvo apagado un tiempo justamente porque los
 * enlaces eran del perfil de UDECA y las claves de otra cuenta, la del
 * coaching. Con esa mezcla el cliente paga de verdad, el servidor le pregunta a
 * la cuenta equivocada, no encuentra ese pago y la cuenta no se activa nunca:
 * sin ningún error y con el dinero ya cobrado. Si algún día se cambia de perfil
 * de Stripe, hay que mover LAS DOS COSAS a la vez.
 *
 * DE QUÉ DEPENDE QUE UN PAGO SIRVA DE ALGO
 *
 * Encender esto solo enseña los botones. Que la cuenta se ACTIVE al pagar
 * depende de dos cosas que viven fuera de este repositorio, en Vercel, y las
 * dos tienen que ser DEL MISMO PERFIL DE STRIPE en el que están los enlaces:
 *
 *   - `STRIPE_SECRET_KEY` tiene que ser la de PRODUCCIÓN (`sk_live_…`).
 *   - `STRIPE_WEBHOOK_SECRET` tiene que ser la de un endpoint creado en modo
 *     PRODUCCIÓN de Stripe. Los webhooks son por modo: uno creado en pruebas
 *     no se dispara nunca con un pago real, y el pago entra pero la cuenta no
 *     se enciende. Escucha `checkout.session.completed`, `invoice.paid` y
 *     `customer.subscription.deleted`.
 *
 * Si alguna de las dos se queda en modo pruebas, el cliente paga de verdad y no
 * recibe nada. Es el peor fallo posible de todo esto, y no da ningún error: el
 * dinero entra y no pasa nada más.
 *
 * QUÉ APAGA CUANDO ESTÁ EN `false`
 *
 *  1. Los sitios que ofrecían pagar (ver `CAN_LINK_TO_PAYMENT` en
 *     lib/subscription.ts): en su lugar se dice que todavía no está
 *     disponible.
 *  2. El muro del alta de 1 €: quien se registra entra y empieza su prueba,
 *     sin pagar. Sin esto la app quedaría inservible para cualquiera que se
 *     diera de alta —y para el revisor de Apple, que la rechazaría.
 *
 * Lo que NO apaga: la prueba sigue teniendo su plazo, y al acabarse la cuenta
 * se para. El acceso se da a mano desde el panel de CEO (perfil del
 * entrenador → "Admin UDECA · cuentas"), que es como se cubre a quien paga por
 * fuera mientras tanto.
 *
 * Y tampoco toca lo que un ALUMNO le paga a su ENTRENADOR: ese dinero no pasa
 * por UDECA, va por el enlace de cobro que cada entrenador pone (ver
 * lib/enlaceDePago.ts), y sigue funcionando igual.
 */
export const PAGOS_ACTIVOS = true;

/**
 * Cuentas con acceso permanente, SIN poderes de administración.
 *
 * Son las cuentas de la casa: la que se usa para enseñar la app, para grabar
 * los vídeos y para revisar de verdad lo que ve un atleta. No pagan y no
 * caducan nunca, porque una cuenta de demostración que se queda fuera a mitad
 * de una presentación es un problema en el peor momento posible.
 *
 * Va aparte de `ADMIN_EMAILS` a propósito, y no es un detalle: un admin puede
 * regalar suscripciones a cualquiera y las reglas de Firestore se lo permiten
 * (ver `isUdecaAdmin` en firestore.rules). Meter aquí una cuenta de escaparate
 * sería darle las llaves de la caja para ahorrarse una lista de cuatro líneas.
 *
 * Lo que da: se salta el muro de pago y el alta de 1 €. Nada más.
 */
export const CUENTAS_ILIMITADAS = ['udeca.app+atleta@gmail.com'];

/** ¿Es una de las cuentas de la casa, con acceso de por vida? */
export function accesoIlimitado(profile: UserProfile | null): boolean {
  return !!profile?.email && CUENTAS_ILIMITADAS.includes(profile.email.trim().toLowerCase());
}

export interface SubscriptionState {
  /** true si el coach puede usar la plataforma. */
  active: boolean;
  /** Días restantes (redondeo hacia arriba), o null si es cuenta fundadora. */
  daysLeft: number | null;
  /** true si la cuenta es anterior a la monetización (sin fecha). */
  legacy: boolean;
  /** true mientras se está dentro de la prueba gratuita (aún sin pagar). */
  trial: boolean;
}

export function subscriptionState(
  profile: UserProfile | null,
  now: number = Date.now()
): SubscriptionState {
  // Pagan plataforma: entrenadores (anual) y atletas individuales (mensual).
  // Los alumnos vinculados a un coach entran gratis.
  if (!profile || (profile.role !== 'trainer' && profile.role !== 'athlete')) {
    return { active: true, daysLeft: null, legacy: true, trial: false };
  }
  // Admins y cuentas de la casa: dentro siempre, sin cuenta atrás y sin
  // "estás de prueba". No es lo mismo que una cuenta fundadora (`legacy`):
  // aquella no tiene fecha porque es anterior al cobro; estas la tienen y da
  // igual lo que ponga.
  if (isAdmin(profile) || accesoIlimitado(profile)) {
    return { active: true, daysLeft: null, legacy: false, trial: false };
  }
  if (profile.subscriptionUntil === undefined) {
    return { active: true, daysLeft: null, legacy: true, trial: false };
  }
  const msLeft = profile.subscriptionUntil - now;
  // Sigue siendo prueba mientras el acceso no se haya extendido más allá de la
  // fecha que se fijó al registrarse (al pagar, subscriptionUntil la supera).
  const trial =
    profile.trialEndsAt !== undefined && profile.subscriptionUntil <= profile.trialEndsAt;
  return {
    active: msLeft > 0,
    daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
    legacy: false,
    trial,
  };
}

/**
 * ¿Le toca ya al ATLETA el aviso del plan a pantalla completa?
 *
 * Solo el último día, y aquí está el porqué: el atleta acaba de pagar. Ha
 * puesto su año hace cinco minutos y lo que ha comprado es justamente doce
 * meses sin que le pidan nada más. Recibirlo con una pantalla completa de
 * "renueva" es cobrar dos veces la misma conversación, y a quien lo ve le
 * queda la sensación de que el precio de entrada era el cebo.
 *
 * El aviso tiene un momento en el que sí sirve: cuando queda un día y la
 * decisión es de verdad. Antes de eso no hay nada que decidir, y decirlo igual
 * solo enseña que la app está pendiente de cobrar en vez de entrenar.
 *
 * Que exista un sitio donde mirarlo durante todo ese tiempo no está reñido con
 * esto: la tarjeta del plan vive en el perfil, y el aviso de las dos últimas
 * semanas sale en un banner que no tapa nada. La diferencia entre estar
 * disponible y salir a la cara es la diferencia entre una oferta y una
 * persecución.
 *
 * Vale igual para el año pagado y para la prueba de las cuentas antiguas: lo
 * que importa es que mañana se queda fuera, no cómo se llame el plazo.
 *
 * El entrenador es otro caso y no pasa por aquí: a él la tarjeta del plan le
 * habla del tope de alumnos, y ese se llena cuando se llena.
 */
export function tocaElAvisoDelAtleta(
  profile: UserProfile | null,
  now: number = Date.now()
): boolean {
  if (profile?.role !== 'athlete') return false;
  const estado = subscriptionState(profile, now);
  if (estado.daysLeft === null || !estado.active) return false;
  return estado.daysLeft <= 1;
}

/**
 * ¿Puede el entrenador usar la plataforma?
 *
 * Con suscripción activa, siempre. Sin ella, mientras su grupo no pase del
 * límite gratuito. Se mira `clientCount` del propio perfil (lo mantiene su app
 * al cargar la lista) para no tener que contar alumnos en cada arranque.
 */
export function trainerHasAccess(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile || profile.role !== 'trainer') return true;
  if (subscriptionState(profile, now).active) return true;
  /*
   * SIN AÑO PAGADO NO HAY CUENTA DE ENTRENADOR. Y esto cambió.
   *
   * Antes el entrenador entraba gratis para siempre mientras no pasara de
   * cinco alumnos, y la cuota solo aparecía al crecer. Ahora el primer año se
   * paga al entrar (27 €) y al terminar hay que renovar (180 €): sin eso, la
   * cuenta de entrenador no se puede usar.
   *
   * Las cuentas ANTERIORES al cambio conservan lo suyo. Se les prometió cinco
   * alumnos gratis para siempre y "para siempre" no puede durar hasta que
   * cambie la lista de precios.
   */
  if (conModeloDePrimerAno(profile)) return false;
  return (profile.clientCount ?? 0) <= clientSlotsOf(profile);
}

/**
 * ¿Se le han llenado las plazas de alumno?
 *
 * Con el modelo nuevo el tope NO depende de tener suscripción o no —el primer
 * año ya está pagado— sino de QUÉ plan tiene: el de entrada trae cinco plazas
 * y el plus las quita. Para las cuentas antiguas sigue valiendo lo de antes:
 * suscripción activa, sin tope.
 */
export function trainerAtFreeLimit(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile || profile.role !== 'trainer') return false;
  if (planIlimitado(profile)) return false;
  if (!conModeloDePrimerAno(profile) && subscriptionState(profile, now).active) return false;
  return (profile.clientCount ?? 0) >= clientSlotsOf(profile);
}

/**
 * ¿Tiene el plan que quita el tope de alumnos?
 *
 * Lo escribe el servidor al cobrar (`subscriptionPlan`), nunca la app: si la
 * app pudiera decidirlo, bastaría con editar el perfil para tener alumnos
 * ilimitados sin pagarlos. Las reglas de Firestore ya impiden que nadie se
 * toque ese campo.
 *
 * `annual` es como Stripe nombra la suscripción anual del entrenador, que es
 * la de 180 €: la misma que se puede contratar el primer año para quitarse el
 * tope y la única que queda al renovar.
 */
export function planIlimitado(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (isAdmin(profile) || accesoIlimitado(profile)) return true;
  return profile.subscriptionPlan === 'annual';
}

/**
 * ¿Ve esta cuenta la app, o ve el muro de pago?
 *
 * Es LA puerta, y por eso está escrita una sola vez. Antes vivía repartida
 * entre los dos layouts —`trainerHasAccess` en el del entrenador,
 * `subscriptionState().active` en el del alumno— y cualquier tercero que
 * quisiera saber si alguien está dentro (la insignia de fundador, por ejemplo)
 * tenía que volver a montar el mismo `if` y confiar en no equivocarse. Dos
 * copias de una regla son dos reglas en cuanto alguien toca una.
 */
export function hasPlatformAccess(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile) return true;
  if (profile.role === 'trainer') return trainerHasAccess(profile, now);
  if (profile.role === 'athlete') return subscriptionState(profile, now).active;
  // Alumno de un coach: entra gratis por definición.
  return true;
}

/**
 * Desde cuándo se exige el alta de 1 €.
 *
 * Las cuentas anteriores no la pagan nunca: cambiar las reglas a mitad de
 * partida y dejar fuera a quien ya estaba dentro es la forma más rápida de
 * perder a los primeros, que son justo los que menos merecen perderse.
 */
export const ENTRY_REQUIRED_FROM = Date.parse('2026-08-03T00:00:00Z');

/**
 * ¿Le falta pagar el alta a esta cuenta?
 *
 * Solo a quien paga plataforma (entrenador y atleta) y solo si se registró
 * después de que existiera el alta. El alumno de un coach no paga nunca.
 */
export function needsEntryPayment(
  profile: UserProfile | null,
  /*
   * El reloj, como en `subscriptionState` y `clientIsLocked`.
   *
   * NO ESTABA, y por eso esta regla —la que decide si sale el muro de pago— no
   * se podía comprobar a una fecha concreta: leía `Date.now()` por dentro, así
   * que una prueba escrita para "el primer día" se ejecutaba realmente con la
   * fecha de hoy y daba lo que le parecía. La única función de este fichero que
   * decide si alguien entra o no era la única sin reloj.
   */
  now: number = Date.now()
): boolean {
  if (!profile) return false;
  // Sin pagos no hay alta que cobrar: quien se registra entra y empieza su
  // prueba. Dejar el muro puesto con el cobro apagado sería una puerta que no
  // abre con ninguna llave (ver PAGOS_ACTIVOS).
  if (!PAGOS_ACTIVOS) return false;
  if (profile.role !== 'trainer' && profile.role !== 'athlete') return false;
  // Las cuentas de la casa tampoco pagan el euro: no son clientes, son la
  // app enseñándose a sí misma.
  if (isAdmin(profile) || accesoIlimitado(profile)) return false;
  if (profile.entryPaidAt) return false;
  // Cuenta fundadora: existía antes de que hubiera alta.
  if ((profile.createdAt ?? 0) < ENTRY_REQUIRED_FROM) return false;
  /*
   * ESTAR DE PRUEBA SÍ EXIME. Es la línea que hace que la prueba exista.
   *
   * Antes decía `!estado.active || estado.trial`, de cuando la prueba venía
   * detrás de un alta de 1 €: se estaba de prueba y el muro salía igual. Con
   * ese `|| estado.trial` puesto, la prueba nueva no serviría absolutamente de
   * nada — la cuenta nacería con sus catorce días y el muro seguiría delante
   * desde el primer segundo. Y no daría ningún error: nacer con prueba y no
   * poder usarla se ve exactamente igual que no tener prueba.
   *
   * Ahora el muro sale cuando el acceso se ha acabado, y punto. La prueba es
   * acceso de verdad mientras dura.
   */
  const estado = subscriptionState(profile, now);
  return !estado.active;
}

/**
 * Días de margen desde que le vence la cuota a un alumno hasta que se le
 * bloquea la app. Cinco: los suficientes para que un despiste o un fin de
 * semana no le dejen fuera, y pocos para que el coach no acabe regalando un
 * mes de trabajo.
 */
export const CLIENT_GRACE_DAYS = 5;

/**
 * Margen extra desde que el alumno declara "ya he pagado" hasta que el bloqueo
 * vuelve si el coach no lo confirma.
 *
 * Sin esto, quien paga por transferencia un viernes se queda fuera hasta que
 * su coach entre a confirmarlo, que es castigar justo a quien ha cumplido.
 * Con tope, porque si no bastaría con declarar un pago falso para tener la app
 * gratis para siempre.
 */
export const CLIENT_REPORT_GRACE_DAYS = 3;

/**
 * ¿Está el alumno bloqueado por impago?
 *
 * Solo aplica a alumnos de un coach con cuota puesta. No bloquea a quien está
 * de prueba o de cortesía, ni a quien no tiene cuota (0 €): en esos casos no
 * hay nada que cobrar y bloquear sería un error de la app, no un impago.
 */
export function clientIsLocked(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile || profile.role !== 'client') return false;
  if (!profile.trainerId) return false;
  if (!profile.nextPaymentDate) return false;
  if (!profile.monthlyFeeEur) return false;
  if (profile.paymentStatus === 'free' || profile.paymentStatus === 'trial') return false;
  if (profile.paymentStatus === 'paid' && profile.nextPaymentDate > now) return false;
  // Ha dicho que ya pagó y aún está dentro del margen de confirmación.
  if (
    profile.paymentReportedAt &&
    now < profile.paymentReportedAt + CLIENT_REPORT_GRACE_DAYS * DAY_MS
  ) {
    return false;
  }
  return now > profile.nextPaymentDate + CLIENT_GRACE_DAYS * DAY_MS;
}

/** Días que le quedan al alumno antes de que se le bloquee la app (0 = hoy). */
export function clientDaysUntilLock(
  profile: UserProfile | null,
  now: number = Date.now()
): number | null {
  if (!profile || profile.role !== 'client' || !profile.nextPaymentDate) return null;
  if (!profile.monthlyFeeEur) return null;
  if (profile.paymentStatus === 'free' || profile.paymentStatus === 'trial') return null;
  const limite = profile.nextPaymentDate + CLIENT_GRACE_DAYS * DAY_MS;
  if (now >= limite) return 0;
  return Math.ceil((limite - now) / DAY_MS);
}
