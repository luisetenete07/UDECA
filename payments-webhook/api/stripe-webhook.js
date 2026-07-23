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

// --- Firebase Admin (se inicializa una sola vez por instancia) ---
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
function addOneMonth(base) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + 1);
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
        // Pago suelto de un alumno a su coach (modelo antiguo/Connect).
        const clientId = session.client_reference_id;
        const paid = session.payment_status === 'paid' || session.status === 'complete';
        if (clientId && paid) {
          await markClientPaid(clientId, (session.amount_total || 0) / 100);
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
  const base = data.nextPaymentDate && data.nextPaymentDate > now ? data.nextPaymentDate : now;
  const nextPaymentDate = addOneMonth(base);

  await ref.set(
    {
      paymentStatus: 'paid',
      nextPaymentDate,
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
