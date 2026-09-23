/*
 * El endpoint de pago (payments-webhook/api/pagar.js).
 *
 * Existe para que la pasarela abra YA con 120 € en vez de enseñar 240 € y
 * repintarlo a los ocho segundos. Lo que se vigila son las cosas que, si se
 * rompen, cobran igual y no avisan:
 *
 *  - Un solo descuento: el del creador SUSTITUYE al del primer año.
 *  - La red: si algo falla, el Payment Link de siempre, con quién paga.
 *  - Lo que se copia del enlace: IVA, condiciones y el texto del desistimiento
 *    de 14 días. Sin eso se cobra igual, pero sin la renuncia firmada.
 *
 *   node scripts/check-pagar.mjs
 */
import { readFileSync } from 'node:fs';
import {
  CODIGO_PRIMER_ANO,
  ENLACES,
  PRECIOS,
  limpiarCodigo,
  opcionesDelEnlace,
  rolValido,
  sesionDePago,
  urlDeRespaldo,
} from '../payments-webhook/api/_pagar.js';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

console.log('\nCada rol a su precio');
{
  ok('entrenador', PRECIOS.trainer === 'price_1UGeiXBGRboHaTA0BtyNZc4o');
  ok('atleta', PRECIOS.athlete === 'price_1UGejuBGRboHaTA0l2DMHCIm');
  ok('y no son el mismo', PRECIOS.trainer !== PRECIOS.athlete);
  ok('solo dos roles pagan', rolValido('trainer') && rolValido('athlete') && !rolValido('client') && !rolValido(''));
  const s = sesionDePago({ rol: 'trainer' });
  ok('la sesión es una suscripción', s.mode === 'subscription', 'un pago único no se renueva nunca');
  ok('con el precio del entrenador', s.line_items[0].price === PRECIOS.trainer);
}

console.log('\nUn solo descuento');
{
  const s = sesionDePago({ rol: 'trainer', promocion: 'promo_X' });
  ok('lleva uno', s.discounts?.length === 1 && s.discounts[0].promotion_code === 'promo_X');
  // Con `allow_promotion_codes` el cliente podría teclear otro encima.
  ok('y no deja teclear otro', !('allow_promotion_codes' in s));
  const handler = lee('payments-webhook/api/pagar.js');
  ok(
    'el del creador sustituye al del primer año',
    /promocion: delCreador \|\| primerAno/.test(handler),
    'si se suman, un 65 % sobre un 50 % deja la suscripción casi regalada'
  );
}

console.log('\nQuién paga llega al webhook');
{
  const s = sesionDePago({ rol: 'athlete', uid: 'U1', email: 'a@b.co' });
  // Sin client_reference_id el dinero entra y la cuenta no se activa nunca.
  ok('con su uid', s.client_reference_id === 'U1');
  ok('y su correo', s.customer_email === 'a@b.co');
  ok('sin uid no se inventa uno', !('client_reference_id' in sesionDePago({ rol: 'athlete' })));
}

console.log('\nSi algo falla, el Payment Link de siempre');
{
  const r = urlDeRespaldo('trainer', { uid: 'U1', email: 'a@b.co' });
  ok('al enlace del rol', r.startsWith(ENLACES.trainer + '?'));
  ok('con el primer año', r.includes(`prefilled_promo_code=${CODIGO_PRIMER_ANO}`));
  ok('y con quién paga', r.includes('client_reference_id=U1') && r.includes('prefilled_email=a%40b.co'));
  ok('y el código del creador si lo trae', urlDeRespaldo('athlete', { codigo: 'ana65' }).includes('prefilled_promo_code=ANA65'));
  ok('el código se limpia', limpiarCodigo(' ana 65!<x> ') === 'ANA65X');
  const handler = lee('payments-webhook/api/pagar.js');
  ok('un error cae a la red', /catch \(e\)[\s\S]{0,160}redirect\(303, respaldo\)/.test(handler));
  ok('y sin clave también', /STRIPE_SECRET_KEY\) return res\.redirect\(303, respaldo\)/.test(handler));
  // Los mismos enlaces que la app: si se separan, la red cobra otro producto.
  const app = lee('lib/enlacesDeCobro.ts');
  ok('mismo enlace de entrenador que la app', app.includes(ENLACES.trainer));
  ok('mismo enlace de atleta que la app', app.includes(ENLACES.athlete));
}

console.log('\nSe copia lo que el enlace tiene configurado');
{
  const enlace = {
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true, required: 'never' },
    consent_collection: { terms_of_service: 'required', promotions: 'none' },
    custom_text: {
      terms_of_service_acceptance: { message: 'Renuncio al desistimiento de 14 días.' },
      submit: null,
    },
    after_completion: { type: 'redirect', redirect: { url: 'https://www.udeca.app/gracias.html' } },
    custom_fields: [
      { key: 'x', label: { type: 'custom', custom: 'Nivel' }, type: 'dropdown', optional: false,
        dropdown: { options: [{ label: 'Alto', value: 'alto' }] } },
    ],
  };
  const o = opcionesDelEnlace(enlace);
  ok('el IVA automático', o.automatic_tax?.enabled === true);
  ok('la dirección', o.billing_address_collection === 'required');
  ok('el NIF', o.tax_id_collection?.enabled === true && !('required' in o.tax_id_collection));
  // LO IMPORTANTE: sin esto se cobra sin la renuncia al desistimiento firmada.
  ok('la casilla de las condiciones', o.consent_collection?.terms_of_service === 'required');
  ok('y el texto del desistimiento', /desistimiento/.test(o.custom_text?.terms_of_service_acceptance?.message ?? ''));
  ok('sin copiar lo que está apagado', !('promotions' in (o.consent_collection ?? {})) && !('submit' in (o.custom_text ?? {})));
  ok('la vuelta a gracias', o.success_url === 'https://www.udeca.app/gracias.html');
  ok('y los desplegables con sus opciones', o.custom_fields?.[0]?.dropdown?.options?.[0]?.value === 'alto');
  ok('sin enlace, nada', Object.keys(opcionesDelEnlace(null)).length === 0);
  // Y que la sesión los use: si `sesionDePago` los pisara, daría igual copiarlos.
  const s = sesionDePago({ rol: 'trainer', opciones: o });
  ok('la sesión los lleva', s.consent_collection?.terms_of_service === 'required' && s.success_url === o.success_url);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
