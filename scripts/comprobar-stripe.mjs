#!/usr/bin/env node
/*
 * ¿Qué se cobra de verdad? Pregúntaselo a Stripe.
 *
 * ESTE GUION LO EJECUTAS TÚ, CON TU CLAVE, EN TU MÁQUINA. La clave no se
 * escribe aquí, no se sube al repositorio y no pasa por ningún sitio: se lee
 * del entorno y se usa para una ráfaga de lecturas. No escribe NADA en Stripe.
 *
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/comprobar-stripe.mjs
 *
 * POR QUÉ EXISTE
 *
 * Todo el modelo de precios se apoya en dos campos que viven en el panel de
 * Stripe, no en este repositorio, y los dos fallan EN SILENCIO:
 *
 *  1. EL PRECIO TIENE QUE SER RECURRENTE. Si fuera un pago único, el cliente
 *     paga, la cuenta se activa y NO SE RENUEVA JAMÁS. Y en el entrenador hay
 *     un daño extra: sin `subscriptionPlan: 'annual'` se queda con el tope de
 *     cinco alumnos, pagando 240 €.
 *
 *  2. EL CUPÓN DEL PRIMER AÑO TIENE QUE DURAR "UNA VEZ". Con `forever`, el
 *     50 % se aplica a TODAS las renovaciones: cada entrenador paga 120 € al
 *     año para siempre en vez de 240 €. Nadie se entera nunca, porque el cobro
 *     entra, la cuenta se renueva y todo parece correcto. Se descubre mirando
 *     las cuentas del año siguiente.
 *
 * Ninguna de las dos cosas se puede comprobar leyendo el código, porque no
 * están en el código. Esto las lee de donde están.
 *
 * De paso imprime los identificadores de precio (`price_...`), que es lo que
 * hace falta para las variables de entorno del endpoint de pago.
 *
 * SIN LIBRERÍAS. Habla con Stripe por HTTP a pelo, y no es por purismo: la
 * librería `stripe` solo está instalada en payments-webhook/, así que un
 * `import` de aquí obligaría a instalar cosas en la raíz para un guion que se
 * ejecuta cuatro veces al año. Son tres lecturas: no hace falta nada.
 */

const clave = process.env.STRIPE_SECRET_KEY;
if (!clave) {
  console.error(`
Falta la clave.

  STRIPE_SECRET_KEY=sk_live_... node scripts/comprobar-stripe.mjs

La encuentras en Stripe → Desarrolladores → Claves de API. Solo se lee, no se
escribe nada.
`);
  process.exit(1);
}

const enPruebas = clave.startsWith('sk_test');

/**
 * Una lectura de la API de Stripe.
 *
 * Los fallos de red se cuentan como lo que son y no como un problema de
 * configuración: decir "el cupón no existe" porque se cayó el wifi mandaría a
 * alguien a crear un cupón duplicado.
 */
async function leer(ruta) {
  let r;
  try {
    r = await fetch(`https://api.stripe.com/v1/${ruta}`, {
      headers: { Authorization: `Bearer ${clave}` },
    });
  } catch (e) {
    console.error(`\nNo se ha podido hablar con Stripe: ${e.message}`);
    console.error('Revisa la conexión y vuelve a intentarlo. No se ha comprobado nada.');
    process.exit(2);
  }
  const cuerpo = await r.json().catch(() => ({}));
  if (r.status === 401) {
    console.error('\nLa clave no vale. Cópiala otra vez de Stripe → Desarrolladores → Claves de API.');
    process.exit(2);
  }
  if (!r.ok) {
    const e = new Error(cuerpo?.error?.message ?? `error ${r.status}`);
    e.noEncontrado = r.status === 404;
    throw e;
  }
  return cuerpo;
}

let fallos = 0;
let avisos = 0;
const ok = (n, c, detalle = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? 'OK   ' : 'FALLO'} ${n}${detalle ? ` — ${detalle}` : ''}`);
};
const aviso = (t) => {
  avisos++;
  console.log(`  AVISO ${t}`);
};

/** 24000 céntimos -> "240,00 €" */
const euros = (centimos, moneda = 'eur') =>
  `${(centimos / 100).toFixed(2).replace('.', ',')} ${moneda === 'eur' ? '€' : moneda.toUpperCase()}`;

/*
 * Los enlaces que la app y la web usan de verdad, sacados del propio
 * repositorio para que esto compruebe LO QUE ESTÁ PUBLICADO y no lo que yo
 * creo que está publicado.
 */
const { COACH_LINK, ATHLETE_LINK } = await import('../lib/enlacesDeCobro.ts');

/** De "https://buy.stripe.com/abc123?..." saca "abc123". */
const idDelEnlace = (url) => (url.split('?')[0].split('/').pop() ?? '').trim();

console.log(
  `\nMirando ${enPruebas ? 'el Stripe DE PRUEBAS' : 'el Stripe DE VERDAD'}${
    enPruebas ? ' (ojo: esto no es lo que cobra a los clientes)' : ''
  }`
);

const esperado = [
  ['Entrenador', COACH_LINK, 24000],
  ['Atleta', ATHLETE_LINK, 6000],
];

/** Los precios que hacen falta para el endpoint de pago, al final. */
const paraElEndpoint = [];

for (const [quien, enlace, centimosEsperados] of esperado) {
  console.log(`\n${quien}`);
  if (!enlace) {
    aviso('no hay enlace puesto (está vacío a propósito: el botón no se enseña)');
    continue;
  }
  const id = idDelEnlace(enlace);
  let link;
  try {
    link = await leer(`payment_links/${id}?expand[]=line_items`);
  } catch (e) {
    ok(`el enlace ${id} existe`, false, e.message);
    continue;
  }
  ok('el enlace existe', true, id);
  ok('está activo', link.active, link.active ? '' : 'está desactivado: nadie puede pagar');

  const linea = link.line_items?.data?.[0];
  if (!linea) {
    ok('tiene un producto', false, 'el enlace no lleva nada dentro');
    continue;
  }
  const precio = linea.price;
  paraElEndpoint.push([quien, precio.id, precio.recurring?.interval ?? 'pago único']);

  /*
   * LO PRIMERO Y MÁS CARO: que sea una suscripción. Un pago único cobra, activa
   * la cuenta y no renueva nunca — y deja al entrenador con el tope de cinco
   * alumnos aunque haya pagado.
   */
  ok(
    'es una SUSCRIPCIÓN, no un pago suelto',
    !!precio.recurring,
    precio.recurring ? '' : 'PAGO ÚNICO: cobra una vez y no renueva jamás'
  );
  if (precio.recurring) {
    ok(
      'se renueva cada año',
      precio.recurring.interval === 'year' && precio.recurring.interval_count === 1,
      `va cada ${precio.recurring.interval_count} ${precio.recurring.interval}`
    );
  }
  ok(
    `cuesta ${euros(centimosEsperados)}`,
    precio.unit_amount === centimosEsperados,
    `en Stripe pone ${euros(precio.unit_amount ?? 0, precio.currency)}`
  );

  // El IVA: sin registro fiscal, Stripe cobra el 0 % y la diferencia sale de tu
  // bolsillo cuando Hacienda la pida.
  if (precio.tax_behavior === 'unspecified') {
    aviso('el precio no dice si el IVA va incluido (tax_behavior: unspecified)');
  }

  console.log(`  ---> identificador del precio: ${precio.id}`);
}

/*
 * EL CUPÓN DEL PRIMER AÑO. Aquí es donde se decide la pregunta de siempre:
 * "pagan 120 y al año siguiente 240, ¿verdad?".
 */
console.log('\nEl descuento del primer año');
const CODIGO = 'PRIMERANO';
let cupon = null;
{
  let promos;
  try {
    promos = await leer(`promotion_codes?code=${encodeURIComponent(CODIGO)}&limit=1`);
  } catch (e) {
    // Sin esto, un tropiezo aquí acaba en una traza de Node y el resumen de
    // abajo —que es para lo que se ejecuta esto— no llega a imprimirse.
    ok(`se puede consultar el código ${CODIGO}`, false, e.message);
    promos = { data: [] };
  }
  const promo = promos.data?.[0];
  ok(`existe el código ${CODIGO}`, !!promo, 'sin él, la pasarela cobra el precio entero sin avisar');
  if (promo) {
    ok('está activo', promo.active);
    cupon = promo.coupon;
    ok('el cupón está activo', cupon.valid);

    const porcentaje = cupon.percent_off;
    const fijo = cupon.amount_off;
    console.log(
      `  el descuento es ${porcentaje ? `del ${porcentaje} %` : `de ${euros(fijo ?? 0, cupon.currency ?? 'eur')}`}`
    );

    /*
     * LA DURACIÓN. El campo entero de esta comprobación.
     *
     *   once      -> solo la primera factura. Es lo que se quiere.
     *   forever   -> TODAS las facturas, para siempre. Media empresa regalada.
     *   repeating -> N meses.
     *
     * No se puede cambiar después de crear el cupón: si está mal, hay que
     * crear otro y cambiar el código en los enlaces.
     */
    ok(
      'dura UNA SOLA VEZ (solo la primera factura)',
      cupon.duration === 'once',
      cupon.duration === 'forever'
        ? 'dura PARA SIEMPRE: el descuento se aplica también a cada renovación'
        : `dura "${cupon.duration}"${cupon.duration_in_months ? ` (${cupon.duration_in_months} meses)` : ''}`
    );

    if (promo.max_redemptions) {
      console.log(`  usos: ${promo.times_redeemed}/${promo.max_redemptions}`);
      if (promo.times_redeemed >= promo.max_redemptions) {
        ok('le quedan usos', false, 'agotado: ya no descuenta a nadie');
      }
    }
    if (promo.expires_at) {
      const cuando = new Date(promo.expires_at * 1000);
      console.log(`  caduca: ${cuando.toLocaleDateString('es-ES')}`);
      ok('no ha caducado', promo.expires_at * 1000 > Date.now());
    }
  }
}

/* Y la respuesta en cristiano, que es lo que se quería saber. */
console.log('\nLo que va a pagar un entrenador');
{
  const linea = esperado[0];
  const entero = linea[2];
  if (!cupon) {
    console.log('  No se puede decir: falta el cupón.');
  } else {
    const primera = cupon.percent_off
      ? Math.round(entero * (1 - cupon.percent_off / 100))
      : Math.max(0, entero - (cupon.amount_off ?? 0));
    const siguiente = cupon.duration === 'once' ? entero : primera;
    console.log(`  Hoy:            ${euros(primera)}`);
    console.log(`  Dentro de un año: ${euros(siguiente)}`);
    if (cupon.duration !== 'once') {
      console.log('  ^ Esto NO es lo que se anuncia. El descuento se está repitiendo.');
    }
  }
}

if (paraElEndpoint.length) {
  console.log('\nPara las variables de entorno del endpoint de pago (Vercel):');
  for (const [quien, id, cada] of paraElEndpoint) {
    console.log(`  ${quien.padEnd(12)} ${id}   (${cada})`);
  }
}

console.log(
  fallos === 0
    ? `\nTodo correcto${avisos ? ` (con ${avisos} aviso(s) arriba)` : ''}`
    : `\n${fallos} fallo(s). Ninguno da error al cobrar: por eso hay que mirarlos.`
);
process.exit(fallos === 0 ? 0 : 1);
