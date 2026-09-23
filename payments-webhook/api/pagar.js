import Stripe from 'stripe';
import {
  CODIGO_PRIMER_ANO,
  ENLACES,
  limpiarCodigo,
  opcionesDelEnlace,
  rolValido,
  sesionDePago,
  urlDeRespaldo,
} from './_pagar.js';

/**
 * El botón de pagar: crea la sesión de Stripe con el descuento YA DENTRO y
 * manda al cliente allí.
 *
 *   GET /api/pagar?rol=trainer|athlete[&uid=...][&email=...][&codigo=CREADOR]
 *
 * POR QUÉ EXISTE. Con el Payment Link y `?prefilled_promo_code=PRIMERANO`, la
 * pasarela abría enseñando 240 € y tardaba unos ocho segundos en bajar a 120 €:
 * justo en el momento de sacar la tarjeta, el precio equivocado. El panel de
 * Stripe no deja pegar un descuento fijo a un Payment Link, así que la única
 * forma de que la página abra ya con 120 € es crear la sesión aquí.
 *
 * DE REGALO, los códigos de creador (`&codigo=`) SUSTITUYEN al del primer año
 * en vez de sumarse: la sesión tiene un solo hueco de descuento y lo elige el
 * servidor. Un creador comparte un enlace, no un código que teclear.
 *
 * SI ALGO FALLA, NO SE PIERDE LA VENTA: se manda al Payment Link de siempre,
 * que cobra bien, solo que con el parpadeo de antes.
 *
 * Variables de entorno (Vercel): STRIPE_SECRET_KEY, la misma del webhook.
 */

// Lo que no cambia de un cliente a otro se guarda mientras la función siga
// caliente: la configuración de cada enlace y el código del primer año. Diez
// minutos, para que un cambio en el panel de Stripe se note pronto.
const GUARDA_MS = 10 * 60 * 1000;
const guardado = new Map();
async function recordado(clave, pedir) {
  const g = guardado.get(clave);
  if (g && Date.now() - g.cuando < GUARDA_MS) return g.valor;
  const valor = await pedir();
  guardado.set(clave, { valor, cuando: Date.now() });
  return valor;
}

/** El Payment Link del rol, con su configuración (IVA, condiciones, textos). */
async function enlaceDelRol(stripe, rol) {
  return recordado(`enlace:${rol}`, async () => {
    // La API no busca un Payment Link por su dirección pública: se listan y se
    // busca el que tiene esta. Son pocos, y queda guardado.
    for await (const e of stripe.paymentLinks.list({ limit: 100 })) {
      if (e.url === ENLACES[rol]) return e;
    }
    return null;
  });
}

/** El identificador (promo_...) de un código activo, o null. */
async function promocion(stripe, codigo) {
  if (!codigo) return null;
  return recordado(`codigo:${codigo}`, async () => {
    const r = await stripe.promotionCodes.list({ code: codigo, active: true, limit: 1 });
    return r.data[0]?.id ?? null;
  });
}

export default async function handler(req, res) {
  const q = req.query ?? {};
  const rol = rolValido(q.rol) ? q.rol : null;
  if (!rol) return res.status(400).send('Falta el rol (trainer o athlete).');

  const uid = typeof q.uid === 'string' ? q.uid.slice(0, 128) : '';
  const email = typeof q.email === 'string' ? q.email.slice(0, 254) : '';
  const codigo = limpiarCodigo(q.codigo);
  const respaldo = urlDeRespaldo(rol, { uid, email, codigo });

  if (!process.env.STRIPE_SECRET_KEY) return res.redirect(303, respaldo);

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const [enlace, delCreador, primerAno] = await Promise.all([
      enlaceDelRol(stripe, rol),
      promocion(stripe, codigo),
      promocion(stripe, CODIGO_PRIMER_ANO),
    ]);
    // Un código de creador que no existe o ha caducado NO deja al cliente sin
    // descuento: se queda con el del primer año.
    const sesion = await stripe.checkout.sessions.create(
      sesionDePago({
        rol,
        uid,
        email,
        promocion: delCreador || primerAno,
        opciones: opcionesDelEnlace(enlace),
      })
    );
    return res.redirect(303, sesion.url);
  } catch (e) {
    console.error('pagar: se cae al Payment Link:', e?.message ?? e);
    return res.redirect(303, respaldo);
  }
}
