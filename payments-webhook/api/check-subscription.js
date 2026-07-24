import Stripe from 'stripe';
import admin from 'firebase-admin';

/**
 * Comprobación BAJO DEMANDA de la suscripción (no depende del webhook).
 * La app la llama al pulsar "Ya he pagado · Actualizar": busca en Stripe si el
 * email tiene una suscripción activa y, si la hay, activa la cuenta en Firestore.
 *
 * A prueba de fallos: NUNCA peta en el arranque. Si faltan variables de
 * entorno u ocurre cualquier error, responde SIEMPRE con CORS + JSON y un motivo
 * legible, para diagnosticar sin adivinar.
 *
 * Variables de entorno: STRIPE_SECRET_KEY (sk_test_… o sk_live_…),
 * FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio).
 */

function subEndSeconds(sub) {
  return sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      res.status(200).json({ active: false, reason: 'Falta STRIPE_SECRET_KEY en Vercel' });
      return;
    }
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      res.status(200).json({ active: false, reason: 'Falta FIREBASE_SERVICE_ACCOUNT en Vercel' });
      return;
    }

    // Inicialización perezosa (dentro del handler, para poder capturar errores).
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    }
    const db = admin.firestore();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const q = req.query || {};
    let body = {};
    if (req.body) body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const uid = body.uid || q.uid;
    const email = (body.email || q.email || '').trim().toLowerCase();
    if (!uid || !email) {
      res.status(200).json({ active: false, reason: 'Faltan uid o email' });
      return;
    }

    const mode = process.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live' : 'test';
    const customers = await stripe.customers.list({ email, limit: 10 });
    let best = null;
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 20 });
      for (const s of subs.data) {
        if (['active', 'trialing', 'past_due'].includes(s.status)) {
          const end = subEndSeconds(s);
          if (end && (!best || end > best.end)) best = { end, customer: c.id, sub: s.id };
        }
      }
    }

    if (!best) {
      res.status(200).json({
        active: false,
        reason:
          customers.data.length === 0
            ? `Sin cliente en Stripe (${mode}) con el email ${email}`
            : `El cliente existe pero sin suscripción activa (Stripe ${mode})`,
      });
      return;
    }

    const until = best.end * 1000;
    await db.collection('users').doc(uid).set(
      {
        subscriptionUntil: until,
        stripeCustomerId: best.customer,
        stripeSubscriptionId: best.sub,
      },
      { merge: true }
    );
    res.status(200).json({ active: true, until });
  } catch (e) {
    res.status(200).json({ active: false, reason: e && e.message ? e.message : String(e) });
  }
}
