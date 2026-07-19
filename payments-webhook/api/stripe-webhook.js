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
      const clientId = session.client_reference_id;
      const paid = session.payment_status === 'paid' || session.status === 'complete';
      if (clientId && paid) {
        await markClientPaid(clientId, (session.amount_total || 0) / 100);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error interno');
  }
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
