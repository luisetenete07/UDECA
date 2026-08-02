import Stripe from 'stripe';
import admin from 'firebase-admin';

/**
 * Webhook de Stripe para UDECA: verifica de forma SEGURA (firma de Stripe) que
 * un alumno ha pagado y marca el cobro automáticamente en Firestore.
 *
 * Se despliega GRATIS en Vercel. Variables de entorno necesarias (ver README):
 *   - STRIPE_SECRET_KEY        (sk_live_… o sk_test_…)
 *   - STRIPE_WEBHOOK_SECRET    (whsec_…)
 *   - FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio de Firebase)
 *
 * El enlace de pago de Stripe se abre desde la app con ?client_reference_id=<uid
 * del alumno>, así este webhook sabe QUIÉN pagó.
 */

// Vercel: desactiva el parseo del cuerpo para poder validar la firma con el
// cuerpo CRUDO (imprescindible en Stripe).
export const config = { api: { bodyParser: false } };

// Inicialización PEREZOSA: no se hace al cargar el módulo (si faltara una
// variable de entorno, la función crashearía en el arranque y ningún evento se
// procesaría). Se inicializa dentro del handler, con errores controlados.
let db = null;
let stripe = null;
function ensureInit() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  if (!db) db = admin.firestore();
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/** Suma un mes natural a un timestamp. */
/**
 * Suma un mes conservando el día. `setMonth` a secas desborda: el 31 de enero
 * + 1 mes da 3 de marzo porque febrero no tiene 31, así que se recorta al
 * último día del mes de destino.
 *
 * Espejo de addMonthsExact en lib/billing.ts. Vive duplicado porque el backend
 * es otro paquete y no puede importar del código de la app; si cambias uno,
 * cambia el otro.
 */
function addOneMonth(base) {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTarget));
  return d.getTime();
}

/**
 * Siguiente fecha de cobro de la cuota de un alumno. Espejo de
 * nextBillingDate en lib/billing.ts: el mes arranca SIEMPRE en la fecha en la
 * que tocaba pagar, no en la que se paga, y `anchorDay` devuelve el día
 * original tras pasar por un mes corto (31 ene → 28 feb → 31 mar).
 */
function nextClientBillingDate(dueDate, anchorDay) {
  const next = addOneMonth(dueDate ?? Date.now());
  if (!anchorDay) return next;
  const d = new Date(next);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(anchorDay, lastDayOfTarget));
  return d.getTime();
}

/**
 * Fin del periodo pagado en ms, tolerante a la versión de la API: en las nuevas
 * `current_period_end` vive en el item de la suscripción, no en la raíz.
 */
function subPeriodEndMs(sub) {
  const secs = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return secs ? secs * 1000 : addOneMonth(Date.now());
}

/** Id de suscripción de una factura, tolerante a la versión de la API. */
function invoiceSubscriptionId(invoice) {
  return (
    invoice?.subscription ??
    invoice?.parent?.subscription_details?.subscription ??
    invoice?.lines?.data?.[0]?.subscription ??
    invoice?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription ??
    null
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  // Comprobación de configuración (evita crashear en el arranque).
  const missing = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'FIREBASE_SERVICE_ACCOUNT'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    res.status(500).send(`Faltan variables de entorno en Vercel: ${missing.join(', ')}`);
    return;
  }
  try {
    ensureInit();
  } catch (err) {
    res.status(500).send(`Config inválida (¿FIREBASE_SERVICE_ACCOUNT mal pegado?): ${err.message}`);
    return;
  }

  let event;
  try {
    const raw = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send(`Firma no válida: ${err.message}`);
    return;
  }

  try {
    // Idempotencia: si ya procesamos este evento, no lo repetimos (Stripe puede
    // reenviarlo). `create` falla si el documento ya existe.
    try {
      await db.collection('stripeEvents').doc(event.id).create({
        type: event.type,
        at: Date.now(),
      });
    } catch {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription') {
        // Suscripción de coach (anual) o atleta (mensual): activa la cuenta.
        await activateSubscription(session);
      } else {
        const clientId = session.client_reference_id;
        const paid = session.payment_status === 'paid' || session.status === 'complete';
        if (clientId && paid) {
          // El alta de la plataforma y la cuota de un alumno a su coach llegan
          // por el mismo sitio: se distinguen por el rol de quien paga.
          const quien = await db.collection('users').doc(clientId).get();
          const rol = quien.exists ? quien.data().role : null;
          if (rol === 'trainer' || rol === 'athlete') {
            await activarAlta(session);
          } else {
            await markClientPaid(clientId, (session.amount_total || 0) / 100);
          }
        }
      }
    } else if (event.type === 'invoice.paid') {
      // Renovación automática: extiende la suscripción al nuevo periodo.
      await renewSubscription(event.data.object);
    } else if (event.type === 'customer.subscription.deleted') {
      // Cancelación: la cuenta caduca (los datos NUNCA se tocan).
      await expireSubscription(event.data.object);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    // El procesado falló: borramos el marcador de idempotencia para que el
    // reintento de Stripe pueda volver a procesar este evento (si no, quedaría
    // "procesado" y no se activaría nunca la cuenta).
    if (event && event.id) {
      await db.collection('stripeEvents').doc(event.id).delete().catch(() => {});
    }
    res.status(500).send('Error interno');
  }
}

// --- Suscripciones de plataforma (coach anual / atleta mensual) ---

/**
 * Huella de la tarjeta con la que se ha pagado.
 *
 * Stripe devuelve la MISMA huella para la misma tarjeta aunque cambien el
 * correo, el nombre, el dispositivo o la cuenta. Es lo único de todo el
 * registro que un usuario no puede fabricarse otra vez gratis, y por eso es la
 * base del control de multicuentas.
 *
 * Devuelve null si no se puede leer (pagos que no son con tarjeta, o carteras
 * que no la exponen): en ese caso no se penaliza a nadie, simplemente no hay
 * señal.
 */
async function tarjetaDelPago(session) {
  try {
    const piId = session.payment_intent;
    if (!piId) return null;
    const pi = await stripe.paymentIntents.retrieve(piId, {
      expand: ['payment_method'],
    });
    const card = pi?.payment_method?.card;
    return card?.fingerprint || null;
  } catch {
    return null;
  }
}

/**
 * ¿Cuántas cuentas de ENTRENADOR han pagado ya con esta tarjeta?
 *
 * El alta de 1 € da cinco plazas de alumno. Si la misma tarjeta paga un
 * segundo alta de entrenador, no compra otras cinco plazas: compra una cuenta
 * más, vacía. Así abrir cuentas deja de ser una forma de esquivar los 180 € y
 * pasa a ser solo trabajo extra para el que lo intente.
 *
 * No se bloquea ni se borra nada: cuentas legítimas comparten tarjeta (una
 * pareja, un centro que paga por dos entrenadores). Se marca y se decide,
 * nunca se castiga en automático.
 */
async function cuentasConLaMismaTarjeta(fingerprint, uid) {
  const ref = db.collection('payerCards').doc(fingerprint);
  const snap = await ref.get();
  const previas = (snap.exists ? snap.data().trainerUids : []) || [];
  const otras = previas.filter((x) => x !== uid);
  return { ref, otras, yaEstaba: previas.includes(uid) };
}

// Activa la cuenta tras el primer pago. El uid llega en client_reference_id
// (el Payment Link se abre desde la app con ?client_reference_id=<uid>).
async function activateSubscription(session) {
  const uid = session.client_reference_id;
  if (!uid) return;
  let until = addOneMonth(Date.now());
  if (session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    until = subPeriodEndMs(sub); // fin del periodo pagado (mes o año)
  }
  await db.collection('users').doc(uid).set(
    {
      subscriptionUntil: until,
      stripeCustomerId: session.customer || null,
      stripeSubscriptionId: session.subscription || null,
    },
    { merge: true }
  );
}

/**
 * Alta de 1 €: da acceso y reparte las plazas de alumno del entrenador.
 *
 * Es un pago suelto (no suscripción), así que llega por el mismo evento pero
 * sin `session.subscription`. Lo que hace especial a este cobro es que es el
 * momento en el que conocemos la tarjeta.
 */
async function activarAlta(session) {
  const uid = session.client_reference_id;
  if (!uid) return;
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return;
  const perfil = snap.data();

  const datos = { entryPaidAt: Date.now(), stripeCustomerId: session.customer || null };
  const huella = await tarjetaDelPago(session);
  if (huella) datos.payerFingerprint = huella;

  if (perfil.role === 'trainer' && huella) {
    const { ref, otras, yaEstaba } = await cuentasConLaMismaTarjeta(huella, uid);
    if (otras.length > 0) {
      // Esta tarjeta ya compró sus plazas. La cuenta entra igual, pero sin
      // plazas incluidas: para tener alumnos, la cuota anual.
      datos.clientSlots = 0;
      datos.sharedCardWith = otras;
    }
    if (!yaEstaba) {
      await ref.set(
        {
          trainerUids: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  }

  await db.collection('users').doc(uid).set(datos, { merge: true });
}

// Renovación automática: al cobrar la nueva factura, extiende la suscripción.
async function renewSubscription(invoice) {
  const customer = invoice.customer;
  const subId = invoiceSubscriptionId(invoice);
  if (!customer || !subId) return;
  const sub = await stripe.subscriptions.retrieve(subId);
  const q = await db
    .collection('users')
    .where('stripeCustomerId', '==', customer)
    .limit(1)
    .get();
  if (q.empty) return;
  await q.docs[0].ref.set({ subscriptionUntil: subPeriodEndMs(sub) }, { merge: true });
}

// Cancelación: la cuenta caduca de inmediato (datos intactos).
async function expireSubscription(sub) {
  const customer = sub.customer;
  if (!customer) return;
  const q = await db
    .collection('users')
    .where('stripeCustomerId', '==', customer)
    .limit(1)
    .get();
  if (q.empty) return;
  await q.docs[0].ref.set({ subscriptionUntil: Date.now() }, { merge: true });
}

async function markClientPaid(clientId, amountEur) {
  const ref = db.collection('users').doc(clientId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data();

  const now = Date.now();
  // Misma regla que cuando el coach confirma el cobro a mano: el mes arranca
  // en la fecha en que TOCABA pagar. Si no, pagar por tarjeta con retraso
  // desplazaría la fecha y un alumno acabaría con un ciclo distinto según por
  // dónde pagara.
  const anchorDay =
    data.billingAnchorDay ||
    (data.nextPaymentDate ? new Date(data.nextPaymentDate).getDate() : undefined);
  const nextPaymentDate = nextClientBillingDate(data.nextPaymentDate, anchorDay);

  await ref.set(
    {
      paymentStatus: 'paid',
      nextPaymentDate,
      billingAnchorDay: anchorDay || new Date(nextPaymentDate).getDate(),
      paymentReportedAt: admin.firestore.FieldValue.delete(),
    },
    { merge: true }
  );

  if (data.trainerId) {
    await db.collection('payments').add({
      trainerId: data.trainerId,
      clientId,
      amountEur,
      date: now,
      createdAt: now,
      source: 'stripe',
    });
  }
}
