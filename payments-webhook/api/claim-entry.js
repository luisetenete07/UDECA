import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { aplicarAlta } from './_alta.js';

/**
 * "Pagué el alta en la web, y ahora acabo de crearme la cuenta."
 *
 * Ese es el camino normal de un cliente que llega por udeca.app: paga primero
 * y se registra después. Cuando paga no hay cuenta a la que asociar el cobro,
 * así que el webhook lo deja apuntado por correo (colección `entryPayments`) y
 * este endpoint es el que lo recoge. Sin él, esa persona se registraría y la
 * app volvería a pedirle el euro.
 *
 * Quién puede reclamar un pago: SOLO el dueño del correo con el que se pagó, y
 * hay que demostrarlo. Por eso no se acepta un uid en el cuerpo de la petición
 * —cualquiera podría mandar el de otro— sino el token de sesión de Firebase,
 * que se verifica aquí con el SDK de administrador. Es la diferencia entre
 * "dime quién eres" y "demuéstrame quién eres".
 *
 * Variables de entorno (Vercel): FIREBASE_SERVICE_ACCOUNT.
 */

const ORIGENES = [
  'https://app.udeca.app',
  'https://www.udeca.app',
  'https://udeca.app',
  'http://localhost:4599',
  'http://localhost:8081',
];

let db = null;
function ensureInit() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  if (!db) db = admin.firestore();
}

/** Mismo criterio que el webhook: el correo en minúsculas, en hash. */
function claveDeCorreo(email) {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
}

export default async function handler(req, res) {
  const origen = req.headers.origin;
  // La app nativa no manda Origin; el navegador sí, y ahí se restringe.
  if (origen && ORIGENES.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Falta FIREBASE_SERVICE_ACCOUNT en Vercel' });
  }

  try {
    ensureInit();
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
    if (!token) return res.status(401).json({ activa: false, motivo: 'Sin sesión' });

    const identidad = await admin.auth().verifyIdToken(token);
    const uid = identidad.uid;
    const email = (identidad.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ activa: false, motivo: 'La cuenta no tiene correo' });

    // ¿Ya estaba dada de alta? Entonces no hay nada que reclamar.
    const perfil = await db.collection('users').doc(uid).get();
    if (perfil.exists && perfil.data().entryPaidAt) {
      return res.status(200).json({ activa: true, motivo: 'Ya estaba activa' });
    }

    const ref = db.collection('entryPayments').doc(claveDeCorreo(email));
    const pago = await ref.get();
    if (!pago.exists) {
      return res.status(200).json({ activa: false, motivo: 'No nos consta ningún pago con tu correo' });
    }
    const datos = pago.data();
    // Un pago vale para UNA cuenta. Si ya lo reclamó otra, no se reparte.
    if (datos.claimedBy && datos.claimedBy !== uid) {
      return res
        .status(200)
        .json({ activa: false, motivo: 'Ese pago ya se usó para activar otra cuenta' });
    }

    const hecho = await aplicarAlta(db, uid, {
      huella: datos.payerFingerprint || null,
      customerId: datos.stripeCustomerId || null,
    });
    if (!hecho) {
      return res.status(200).json({ activa: false, motivo: 'Esta cuenta no necesita alta' });
    }
    await ref.set({ claimedBy: uid, claimedAt: Date.now() }, { merge: true });
    return res.status(200).json({ activa: true });
  } catch (e) {
    console.error('claim-entry', e);
    const codigo = e?.errorInfo?.code || '';
    if (codigo.includes('auth/')) {
      return res.status(401).json({ activa: false, motivo: 'Sesión no válida' });
    }
    return res.status(500).json({ activa: false, motivo: 'Error del servidor' });
  }
}
