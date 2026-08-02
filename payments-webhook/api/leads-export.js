import admin from 'firebase-admin';

/**
 * Descarga la lista de contactos de la comunidad en CSV, lista para importar en
 * cualquier herramienta de email (Mailchimp, Brevo, MailerLite…).
 *
 * Vive fuera de la app a propósito. Los contactos de la comunidad no son
 * usuarios de UDECA: son gente que ha dejado su correo en una página de
 * captación, y mezclarlos con las cuentas —en la misma pantalla o en la misma
 * colección— acaba con alguien mandando una campaña a sus propios alumnos.
 *
 * Se pide con una clave. Sin ella, cualquiera con la dirección se llevaría la
 * lista entera de correos, que es justo lo que no puede pasar.
 *
 * Uso:
 *   https://udeca.vercel.app/api/leads-export?key=TU_CLAVE            → CSV
 *   https://udeca.vercel.app/api/leads-export?key=TU_CLAVE&format=json
 *
 * Variables de entorno (Vercel):
 *   FIREBASE_SERVICE_ACCOUNT — la que ya usan los demás endpoints.
 *   LEADS_EXPORT_KEY         — clave de descarga. Si no está, vale CRON_SECRET,
 *                              que ya tienes configurado; mejor una propia, para
 *                              que una filtración no se lleve las dos cosas.
 */

/** Tope de seguridad: nadie necesita descargar más de esto de una sentada. */
const MAX = 5000;

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
}

/** Comparación en tiempo constante: no filtra la clave carácter a carácter. */
function claveCorrecta(dada, esperada) {
  if (typeof dada !== 'string' || typeof esperada !== 'string') return false;
  if (dada.length !== esperada.length) return false;
  let iguales = 0;
  for (let i = 0; i < dada.length; i++) iguales |= dada.charCodeAt(i) ^ esperada.charCodeAt(i);
  return iguales === 0;
}

/** Celda de CSV a prueba de comas, comillas y saltos de línea. */
function celda(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const fecha = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : '');

export default async function handler(req, res) {
  const esperada = process.env.LEADS_EXPORT_KEY || process.env.CRON_SECRET;
  if (!esperada) {
    return res.status(503).json({ error: 'Falta configurar LEADS_EXPORT_KEY' });
  }
  const dada = req.headers['x-udeca-key'] || req.query.key;
  if (!claveCorrecta(String(dada ?? ''), esperada)) {
    return res.status(401).json({ error: 'Clave no válida' });
  }

  try {
    initAdmin();
    const snap = await admin
      .firestore()
      .collection('leads')
      .orderBy('createdAt', 'desc')
      .limit(MAX)
      .get();
    const filas = snap.docs.map((d) => d.data());

    if (req.query.format === 'json') {
      return res.status(200).json({ total: filas.length, leads: filas });
    }

    const cabecera = ['nombre', 'correo', 'origen', 'campaña', 'visitas', 'alta', 'consentimiento'];
    const csv = [
      cabecera.join(','),
      ...filas.map((l) =>
        [
          celda(l.name),
          celda(l.email),
          celda(l.source),
          celda(l.campaign),
          celda(l.visits ?? 1),
          celda(fecha(l.createdAt)),
          celda(fecha(l.consent?.at)),
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="udeca-comunidad-${fecha(Date.now())}.csv"`
    );
    // Que no se quede en ninguna caché por el camino: es una lista de personas.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    // El BOM hace que Excel abra bien las tildes.
    return res.status(200).send('﻿' + csv);
  } catch (e) {
    console.error('leads-export', e);
    return res.status(500).json({ error: 'No se pudo exportar' });
  }
}
