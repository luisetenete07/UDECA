import Stripe from 'stripe';
import admin from 'firebase-admin';

/**
 * Stripe Connect de UDECA · SIN comisión de plataforma.
 *
 * El coach ya paga su cuota anual (180 €), así que NO le cobramos ninguna
 * comisión por cobrar a sus alumnos: el dinero va DIRECTO a su cuenta. Usamos
 * cargos de DESTINO con `on_behalf_of`, de modo que:
 *   - el coach es el comercio (asume las comisiones de proceso de Stripe),
 *   - UDECA no cobra `application_fee` (0 %) ni asume costes,
 *   - el webhook de cobros sigue llegando a la cuenta de UDECA (el cargo vive
 *     en la plataforma), sin necesidad de configurar eventos de cuentas
 *     conectadas.
 *
 * Un único endpoint con tres acciones (para minimizar funciones en Vercel):
 *   - action 'onboard': crea/recupera la cuenta Express del coach y devuelve el
 *     enlace de alta (datos bancarios/identidad).
 *   - action 'status': consulta si su cuenta ya puede cobrar y lo guarda.
 *   - action 'checkout': crea el pago de un alumno a su coach (cargo de destino).
 *
 * A prueba de fallos: nunca peta en el arranque; ante cualquier error responde
 * con CORS + JSON y un motivo legible.
 *
 * Variables de entorno: STRIPE_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT.
 */

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

/** Solo permitimos volver a dominios conocidos (evita redirecciones abiertas). */
const ALLOWED_HOSTS = ['udeca.app', 'www.udeca.app', 'localhost', 'udeca.vercel.app'];
function safeOrigin(origin) {
  try {
    const u = new URL(origin);
    if (ALLOWED_HOSTS.includes(u.hostname)) return `${u.protocol}//${u.host}`;
  } catch {
    /* ignora */
  }
  return 'https://www.udeca.app';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      res.status(200).json({ ok: false, reason: 'Falta STRIPE_SECRET_KEY en Vercel' });
      return;
    }
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      res.status(200).json({ ok: false, reason: 'Falta FIREBASE_SERVICE_ACCOUNT en Vercel' });
      return;
    }
    ensureInit();

    let body = {};
    if (req.body) body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const action = body.action;
    const origin = safeOrigin(body.origin);

    if (action === 'onboard') {
      await handleOnboard(body, origin, res);
    } else if (action === 'status') {
      await handleStatus(body, res);
    } else if (action === 'checkout') {
      await handleCheckout(body, origin, res);
    } else {
      res.status(200).json({ ok: false, reason: `Acción no válida: ${action}` });
    }
  } catch (e) {
    res.status(200).json({ ok: false, reason: e && e.message ? e.message : String(e) });
  }
}

// Crea (o recupera) la cuenta Express del coach y devuelve el enlace de alta.
async function handleOnboard(body, origin, res) {
  const uid = body.uid;
  if (!uid) {
    res.status(200).json({ ok: false, reason: 'Falta uid' });
    return;
  }
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(200).json({ ok: false, reason: 'El coach no existe' });
    return;
  }
  const data = snap.data();
  let accountId = data.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'ES',
      email: data.email || undefined,
      business_type: 'individual',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: { uid },
    });
    accountId = account.id;
    await ref.set({ stripeAccountId: accountId }, { merge: true });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/?connect=refresh`,
    return_url: `${origin}/?connect=done`,
    type: 'account_onboarding',
  });
  res.status(200).json({ ok: true, url: link.url });
}

// Consulta si la cuenta del coach ya puede cobrar y lo guarda en su perfil.
async function handleStatus(body, res) {
  const uid = body.uid;
  if (!uid) {
    res.status(200).json({ ok: false, reason: 'Falta uid' });
    return;
  }
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const accountId = snap.exists ? snap.data().stripeAccountId : null;
  if (!accountId) {
    res.status(200).json({ ok: true, hasAccount: false, chargesEnabled: false });
    return;
  }
  const account = await stripe.accounts.retrieve(accountId);
  const chargesEnabled = Boolean(account.charges_enabled);
  await ref.set({ stripeChargesEnabled: chargesEnabled }, { merge: true });
  res.status(200).json({
    ok: true,
    hasAccount: true,
    chargesEnabled,
    detailsSubmitted: Boolean(account.details_submitted),
    payoutsEnabled: Boolean(account.payouts_enabled),
  });
}

// Crea el pago de un alumno a su coach: cargo de DESTINO, sin comisión de UDECA.
async function handleCheckout(body, origin, res) {
  const coachId = body.coachId;
  const clientId = body.clientId;
  const amountEur = Number(body.amountEur);
  if (!coachId || !clientId) {
    res.status(200).json({ ok: false, reason: 'Faltan coachId o clientId' });
    return;
  }
  if (!amountEur || amountEur <= 0) {
    res.status(200).json({ ok: false, reason: 'Importe no válido' });
    return;
  }
  const coachSnap = await db.collection('users').doc(coachId).get();
  const coach = coachSnap.exists ? coachSnap.data() : null;
  if (!coach || !coach.stripeAccountId) {
    res.status(200).json({ ok: false, reason: 'Tu entrenador aún no tiene los cobros activados' });
    return;
  }
  if (!coach.stripeChargesEnabled) {
    // Comprobamos en vivo por si acaba de completar el alta.
    const account = await stripe.accounts.retrieve(coach.stripeAccountId);
    if (!account.charges_enabled) {
      res.status(200).json({ ok: false, reason: 'Tu entrenador aún no puede recibir cobros' });
      return;
    }
    await db
      .collection('users')
      .doc(coachId)
      .set({ stripeChargesEnabled: true }, { merge: true });
  }

  const cents = Math.round(amountEur * 100);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: cents,
          product_data: { name: `Cuota de entrenamiento · ${coach.name || 'UDECA'}` },
        },
        quantity: 1,
      },
    ],
    client_reference_id: clientId,
    payment_intent_data: {
      // Cargo de destino: el dinero va al coach y él es el comercio (asume las
      // comisiones de Stripe). UDECA no cobra application_fee → 0 % de comisión.
      transfer_data: { destination: coach.stripeAccountId },
      on_behalf_of: coach.stripeAccountId,
      description: 'Cuota de entrenamiento (UDECA)',
    },
    success_url: `${origin}/?pago=ok`,
    cancel_url: `${origin}/?pago=cancel`,
  });
  res.status(200).json({ ok: true, url: session.url });
}
