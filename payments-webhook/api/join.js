import admin from 'firebase-admin';

/**
 * Alta de alumnos en el grupo de un entrenador, decidida en el SERVIDOR.
 *
 * El plan gratuito del coach llega a FREE_CLIENT_LIMIT alumnos. Comprobarlo en
 * la app tenía dos agujeros: cualquiera con conocimientos puede saltarse una
 * comprobación de cliente, y dos aprobaciones simultáneas la pasan las dos.
 *
 * Aquí se cuentan los alumnos de verdad con el SDK de administrador y se
 * escribe el vínculo solo si procede. La app pide; el servidor decide.
 *
 * SIEMPRE se verifica el idToken de Firebase de quien llama: sin eso,
 * cualquiera podría meter alumnos en el grupo de otro entrenador.
 *
 * Acciones:
 *   approve — el entrenador acepta una solicitud (único camino por el que un
 *             alumno queda vinculado).
 *   sync    — recalcula su recuento (p. ej. tras quitar a alguien del grupo).
 *
 * Variables de entorno: FIREBASE_SERVICE_ACCOUNT (JSON de cuenta de servicio).
 */

/**
 * Alumnos incluidos en el plan gratuito del entrenador.
 * Debe coincidir con FREE_CLIENT_LIMIT de lib/subscription.ts.
 */
const FREE_CLIENT_LIMIT = 2;

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
}

/** ¿Tiene el entrenador suscripción vigente? (misma regla que la app). */
function hasActiveSubscription(trainer) {
  const until = trainer?.subscriptionUntil;
  // Sin campo = cuenta fundadora, anterior a la monetización: acceso completo.
  if (until === undefined) return true;
  return typeof until === 'number' && until > Date.now();
}

/** Cuenta real de alumnos del entrenador. */
async function countClients(db, trainerId) {
  const snap = await db
    .collection('users')
    .where('trainerId', '==', trainerId)
    .count()
    .get();
  return snap.data().count;
}

/**
 * Guarda el recuento en el perfil del coach y marca su código público como
 * lleno. Lo escribe el servidor para que sea un dato de confianza: la app del
 * coach ya no puede falsearlo para seguir creciendo gratis.
 */
async function writeCount(db, trainer, trainerId, count) {
  const full = !hasActiveSubscription(trainer) && count >= FREE_CLIENT_LIMIT;
  await db.collection('users').doc(trainerId).update({ clientCount: count });
  if (trainer?.inviteCode) {
    await db
      .collection('trainerCodes')
      .doc(trainer.inviteCode)
      .set({ full }, { merge: true });
  }
  return full;
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
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      res.status(200).json({ ok: false, reason: 'Falta FIREBASE_SERVICE_ACCOUNT en Vercel' });
      return;
    }
    initAdmin();
    const db = admin.firestore();

    let body = {};
    if (req.body) body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const { idToken, action } = body;

    if (!idToken) {
      res.status(200).json({ ok: false, reason: 'Falta la identificación' });
      return;
    }

    // Identidad verificada: a partir de aquí `caller` es de fiar.
    let caller;
    try {
      caller = await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(200).json({ ok: false, reason: 'Sesión no válida. Vuelve a entrar.' });
      return;
    }

    // ---- Un entrenador acepta una solicitud de su grupo ----
    if (action === 'approve') {
      const clientId = String(body.clientId || '');
      if (!clientId) {
        res.status(200).json({ ok: false, reason: 'Falta el alumno' });
        return;
      }
      const trainerSnap = await db.collection('users').doc(caller.uid).get();
      const trainer = trainerSnap.exists ? trainerSnap.data() : null;
      if (!trainer || trainer.role !== 'trainer') {
        res.status(200).json({ ok: false, reason: 'Solo un entrenador puede aceptar alumnos.' });
        return;
      }

      const count = await countClients(db, caller.uid);
      if (!hasActiveSubscription(trainer) && count >= FREE_CLIENT_LIMIT) {
        await writeCount(db, trainer, caller.uid, count);
        res.status(200).json({
          ok: false,
          reason: `Tu plan gratuito llega a ${FREE_CLIENT_LIMIT} alumnos. Activa la suscripción para aceptar a más.`,
        });
        return;
      }

      await db.collection('users').doc(clientId).update({ trainerId: caller.uid });
      await db.collection('joinRequests').doc(`${clientId}_${caller.uid}`).delete();
      await writeCount(db, trainer, caller.uid, count + 1);
      res.status(200).json({ ok: true });
      return;
    }

    // ---- Recuento al día (tras quitar alumnos, o al abrir la lista) ----
    if (action === 'sync') {
      const trainerSnap = await db.collection('users').doc(caller.uid).get();
      const trainer = trainerSnap.exists ? trainerSnap.data() : null;
      if (!trainer || trainer.role !== 'trainer') {
        res.status(200).json({ ok: false, reason: 'Solo para entrenadores' });
        return;
      }
      const count = await countClients(db, caller.uid);
      const full = await writeCount(db, trainer, caller.uid, count);
      res.status(200).json({ ok: true, count, full });
      return;
    }

    res.status(200).json({ ok: false, reason: 'Acción desconocida' });
  } catch (e) {
    res.status(200).json({ ok: false, reason: e?.message || 'Error inesperado' });
  }
}
