/**
 * Las piezas del endpoint de pago que NO hablan con Stripe.
 *
 * Suelto, sin imports y con guion bajo delante (Vercel no lo publica como
 * ruta, igual que _alta.js) para que scripts/check-pagar.mjs pueda ejecutarlo.
 * Aquí se decide todo lo que puede salir mal sin dar error: a qué precio se
 * manda a cada uno, qué descuento lleva y adónde se le manda si algo falla.
 */

/**
 * Los precios, por rol. Son los del panel de Stripe: 240 €/año el entrenador
 * y 60 €/año el atleta, los dos RECURRENTES. No son secretos.
 */
export const PRECIOS = {
  trainer: 'price_1UGeiXBGRboHaTA0BtyNZc4o',
  athlete: 'price_1UGejuBGRboHaTA0l2DMHCIm',
};

/**
 * Los Payment Links de siempre. Aquí son la RED: si crear la sesión falla por
 * lo que sea, se manda ahí y se cobra bien igual, solo que con el parpadeo de
 * 240 a 120 de antes. Tienen que ser los mismos que lib/enlacesDeCobro.ts
 * (check-pagar.mjs lo mira).
 */
export const ENLACES = {
  trainer: 'https://buy.stripe.com/3cI3cu8ezdGXacUbvC3sI09',
  athlete: 'https://buy.stripe.com/7sY14mgL5dGX2KseHO3sI08',
};

export const CODIGO_PRIMER_ANO = 'PRIMERANO';

export function rolValido(rol) {
  return rol === 'trainer' || rol === 'athlete';
}

/** Un código de creador tal y como llega en la dirección, limpio. */
export function limpiarCodigo(codigo) {
  return String(codigo ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 40);
}

/** Lo que se le pega a cualquier dirección de pago para saber quién paga. */
function quienPaga(params, { uid, email }) {
  if (uid) params.set('client_reference_id', uid);
  if (email) params.set('prefilled_email', email);
  return params;
}

/**
 * Adónde se manda si algo falla: el Payment Link de siempre, con el código
 * que toque. Es lo que había antes de este endpoint, así que en el peor caso
 * no se pierde nada.
 */
export function urlDeRespaldo(rol, { uid, email, codigo } = {}) {
  const p = new URLSearchParams();
  p.set('prefilled_promo_code', limpiarCodigo(codigo) || CODIGO_PRIMER_ANO);
  quienPaga(p, { uid, email });
  return `${ENLACES[rol]}?${p.toString()}`;
}

/**
 * Lo que se copia del Payment Link a la sesión.
 *
 * NO ES UN DETALLE. En el enlace está configurado lo que no se ve hasta que
 * falta: el IVA automático, pedir el NIF, la casilla de aceptar las
 * condiciones y el texto del desistimiento de los 14 días. Una sesión creada a
 * mano sin esto cobraría igual —y sin la renuncia al desistimiento firmada,
 * que es lo que permite no devolver el dinero—. Copiándolo del enlace, lo que
 * se cambie en el panel de Stripe vale para los dos caminos sin tocar código.
 */
export function opcionesDelEnlace(enlace) {
  const o = {};
  if (!enlace) return o;
  if (enlace.automatic_tax?.enabled) o.automatic_tax = { enabled: true };
  if (enlace.billing_address_collection) o.billing_address_collection = enlace.billing_address_collection;
  if (enlace.tax_id_collection?.enabled) {
    o.tax_id_collection = { enabled: true };
    if (enlace.tax_id_collection.required && enlace.tax_id_collection.required !== 'never') {
      o.tax_id_collection.required = enlace.tax_id_collection.required;
    }
  }
  const consent = enlace.consent_collection;
  if (consent) {
    const c = {};
    if (consent.terms_of_service && consent.terms_of_service !== 'none') c.terms_of_service = consent.terms_of_service;
    if (consent.promotions && consent.promotions !== 'none') c.promotions = consent.promotions;
    if (Object.keys(c).length) o.consent_collection = c;
  }
  const texto = enlace.custom_text;
  if (texto) {
    const t = {};
    for (const k of ['submit', 'after_submit', 'terms_of_service_acceptance']) {
      if (texto[k]?.message) t[k] = { message: texto[k].message };
    }
    if (Object.keys(t).length) o.custom_text = t;
  }
  if (Array.isArray(enlace.custom_fields) && enlace.custom_fields.length) {
    o.custom_fields = enlace.custom_fields.map(({ key, label, type, optional, dropdown }) => ({
      key,
      label: { type: 'custom', custom: label?.custom ?? '' },
      type,
      optional: !!optional,
      // Un desplegable sin sus opciones no se puede crear: Stripe rechazaría
      // la sesión y se caería a la red (el Payment Link). Mejor copiarlas.
      ...(type === 'dropdown' && dropdown?.options
        ? { dropdown: { options: dropdown.options.map(({ label: l, value }) => ({ label: l, value })) } }
        : {}),
    }));
  }
  const vuelta = enlace.after_completion?.redirect?.url;
  if (vuelta) o.success_url = vuelta;
  return o;
}

export const VUELTA_POR_DEFECTO = 'https://www.udeca.app/gracias.html';
export const SI_CANCELA = 'https://www.udeca.app/#planes';

/**
 * La sesión de pago entera.
 *
 * UN SOLO DESCUENTO, y es la razón de que el código del creador SUSTITUYA al
 * del primer año en vez de sumarse: aquí solo hay un hueco y lo rellena el
 * servidor. No depende de cómo se porte Stripe con dos códigos a la vez.
 *
 * Y como el descuento va DENTRO de la sesión, la página abre ya con 120 €. Con
 * el `prefilled_promo_code` de antes, Stripe abría con 240 € y lo repintaba a
 * los ocho segundos.
 */
export function sesionDePago({ rol, uid, email, promocion, opciones = {} }) {
  const s = {
    mode: 'subscription',
    line_items: [{ price: PRECIOS[rol], quantity: 1 }],
    success_url: VUELTA_POR_DEFECTO,
    cancel_url: SI_CANCELA,
    locale: 'es',
    ...opciones,
  };
  if (promocion) s.discounts = [{ promotion_code: promocion }];
  if (uid) s.client_reference_id = uid;
  if (email) s.customer_email = email;
  return s;
}
