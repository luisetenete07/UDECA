import admin from 'firebase-admin';
import crypto from 'node:crypto';

/**
 * Puerta de la comunidad privada: guarda el contacto y devuelve el acceso.
 *
 * Va en el servidor y no en la página por dos motivos:
 *
 *  1. El enlace del grupo llega en la RESPUESTA, no en el código de la web. Si
 *     estuviera en el JavaScript de la página, cualquiera lo leería con el
 *     botón derecho y la puerta no sería una puerta.
 *  2. La lista de correos se escribe con el SDK de administrador. Nadie puede
 *     escribir en `leads` desde el navegador, así que no hay forma de llenarla
 *     de basura ni de leerla desde fuera.
 *
 * Variables de entorno (Vercel):
 *   FIREBASE_SERVICE_ACCOUNT — JSON de la cuenta de servicio (ya la usan los
 *                              demás endpoints de este proyecto).
 *   TELEGRAM_INVITE_URL      — enlace de invitación al grupo privado.
 */

/** Desde dónde se acepta la llamada. Cualquier otro origen no recibe permiso. */
const ORIGENES = [
  'https://comunidad.udeca.app',
  'https://www.udeca.app',
  'https://udeca.app',
  'http://localhost:4600',
];

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
}

/** Correo con forma de correo. La comprobación de verdad es que exista, y eso
 *  solo se sabe escribiéndole; aquí basta con filtrar lo que no puede serlo. */
function correoValido(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
}

/** Id del documento: el correo en minúsculas, en hash. Así la misma persona no
 *  crea 40 documentos por volver a entrar, y el id no expone el correo. */
function idDeCorreo(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
}

export default async function handler(req, res) {
  const origen = req.headers.origin;
  if (origen && ORIGENES.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const invitacion = process.env.TELEGRAM_INVITE_URL;
  if (!invitacion) {
    // Sin enlace configurado no se guarda nada: sería pedirle el correo a
    // alguien para no darle nada a cambio.
    return res.status(503).json({ error: 'La comunidad todavía no está abierta' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const name = String(body.name ?? '').trim().slice(0, 80);
    const email = String(body.email ?? '').trim().toLowerCase();
    const source = String(body.source ?? 'web').slice(0, 40);
    const campaign = String(body.campaign ?? '').slice(0, 60);

    if (name.length < 2) return res.status(400).json({ error: 'Falta el nombre' });
    if (!correoValido(email)) return res.status(400).json({ error: 'Correo no válido' });

    initAdmin();
    const db = admin.firestore();
    const ref = db.collection('leads').doc(idDeCorreo(email));
    const previo = await ref.get();

    await ref.set(
      {
        name,
        email,
        source,
        campaign,
        // Con qué frecuencia vuelve la misma persona: dice si la campaña
        // repite gente o trae caras nuevas.
        visits: (previo.data()?.visits ?? 0) + 1,
        createdAt: previo.exists ? previo.data().createdAt : Date.now(),
        updatedAt: Date.now(),
        // Consentimiento para escribirle: se guarda con fecha, que es lo que
        // exige el RGPD para poder demostrarlo.
        consent: { granted: true, at: Date.now(), text: 'Alta en la comunidad privada de UDECA' },
      },
      { merge: true }
    );

    return res.status(200).json({ url: invitacion });
  } catch (e) {
    console.error('lead', e);
    return res.status(500).json({ error: 'No se pudo completar' });
  }
}
