/*
 * Los enlaces de cobro de Stripe (lib/enlacesDeCobro.ts y web/config.js).
 *
 * Lo que hay que proteger son tres cosas que no dan error hasta que ya han
 * pasado:
 *
 *  1. QUE NO SE PUBLIQUE EN MODO PRUEBAS. Un enlace `buy.stripe.com/test_…`
 *     funciona: abre la pasarela, acepta la tarjeta y da las gracias. Lo único
 *     que no hace es cobrar. Nadie se entera hasta que se miran las cuentas del
 *     mes, y para entonces hay clientes convencidos de que pagaron.
 *  2. QUE LAS DOS COPIAS NO SE SEPAREN. Los enlaces del primer año están
 *     escritos DOS veces —en la app y en la web— porque no pueden importarse
 *     entre sí. El día que se cambie uno y no el otro, la mitad de las altas
 *     irán a un producto y la otra mitad a otro.
 *  3. QUE UN ENLACE PENDIENTE NO SE QUEDE A MEDIAS. Los precios cambiaron
 *     (17 € y 27 € el primer año) y los Payment Links nuevos todavía no
 *     existen. Mientras no estén, el sitio que los usa tiene que estar VACÍO en
 *     la app y en /proximamente en la web: un enlace viejo ahí cobraría 1 €
 *     por lo que la página anuncia a 17, sin dar ningún error a nadie.
 *
 * Los ficheros se leen como TEXTO a propósito: así se comprueba lo que está
 * ESCRITO, sin depender de que se pueda importar. `web/config.js` no es un
 * módulo que se pueda cargar aquí, y con los enlaces leídos igual en los dos
 * lados la comparación es de verdad línea contra línea.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-stripe.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

// Los cuatro enlaces viven en lib/enlacesDeCobro.ts (antes estaban en
// subscription.ts, y se sacaron de ahí para poder recorrer la cadena de cobro
// entera desde Node — ver scripts/check-cadena-cobro.mjs).
const app = readFileSync('lib/enlacesDeCobro.ts', 'utf8');
const web = readFileSync('web/config.js', 'utf8');

/**
 * El valor de una constante exportada, tal y como está escrito ('' = null).
 *
 * Sigue UN alias. Desde que el alta y la cuota son el mismo producto, los
 * cuatro nombres de siempre (`COACH_ENTRY_LINK`, `COACH_PAYMENT_LINK`…) apuntan
 * a las dos constantes de verdad (`COACH_LINK`, `ATHLETE_LINK`). Sin seguir el
 * alias, esto leía `null` y daba por retirado un enlace que está puesto.
 */
function constante(texto, nombre, saltos = 1) {
  // Comillas simples o acento grave: los enlaces llevan el código del primer
  // año pegado con una plantilla, y leyendo solo `'...'` esto devolvía null y
  // daba por retirado un enlace que está puesto y cobrando.
  const directo = texto.match(new RegExp(`${nombre}[^=]*=\\s*\\n?\\s*'([^']*)'`));
  if (directo) return directo[1] || null;
  const plantilla = texto.match(new RegExp(`${nombre}[^=]*=\\s*\\n?\\s*\`([^\`]*)\``));
  if (plantilla) {
    // `${CONSTANTE}` dentro de la plantilla se sustituye por su valor.
    const resuelto = plantilla[1].replace(/\$\{(\w+)\}/g, (_, x) => constante(texto, x, 0) ?? '');
    return resuelto || null;
  }
  const alias = texto.match(new RegExp(`${nombre}\\s*=\\s*([A-Z_][A-Z0-9_]*)\\s*;`));
  if (alias && saltos > 0) return constante(texto, alias[1], saltos - 1);
  return null;
}

/** El valor de una clave dentro del objeto `pagos` de la web. */
function claveWeb(texto, nombre) {
  const m = texto.match(new RegExp(`${nombre}:\\s*'([^']*)'`));
  return m && m[1] ? m[1] : null;
}

/**
 * Los cuatro productos del modelo nuevo.
 *
 *   - Primer año de entrenador:   27 €  (pago único)
 *   - Primer año de atleta:       17 €  (pago único)
 *   - Cuota anual de entrenador: 180 €/año  (el plan que quita el tope)
 *   - Cuota anual de atleta:      95 €/año
 */
const ENLACES = {
  'primer año del entrenador (app)': constante(app, 'COACH_ENTRY_LINK'),
  'primer año del atleta (app)': constante(app, 'ATHLETE_ENTRY_LINK'),
  'primer año del entrenador (web)': claveWeb(web, 'altaCoach'),
  'primer año del atleta (web)': claveWeb(web, 'altaAtleta'),
  'cuota anual del entrenador': constante(app, 'COACH_PAYMENT_LINK'),
  'cuota anual del atleta': constante(app, 'ATHLETE_ANNUAL_LINK'),
};

const esPruebas = (u) => /\/test_/.test(u ?? '');

/**
 * ¿Se cobra ya?
 *
 * Se lee de `lib/planBase.ts` como texto, igual que los enlaces: es la misma
 * razón —importar desde Node lo que arrastra React Native no se puede— y así
 * este guion sigue sin depender de nada.
 *
 * Con los pagos apagados, comparar enlaces no solo sobra: es falso. Lo que hay
 * que proteger entonces es lo contrario, y es igual de importante: que no se
 * quede ningún enlace de Stripe a medio quitar, apuntando a un producto que
 * nadie vigila.
 */
const base = readFileSync('lib/planBase.ts', 'utf8');
const PAGOS_ACTIVOS = /export const PAGOS_ACTIVOS\s*=\s*true\s*;/.test(base);

if (!PAGOS_ACTIVOS) {
  console.log('\nAhora mismo NO se cobra (PAGOS_ACTIVOS = false)');
  console.log('Lo que se comprueba es que no quede ningún enlace suelto.\n');

  for (const [nombre, url] of Object.entries(ENLACES)) {
    if (nombre.endsWith('(web)')) {
      comprueba(`${nombre}: lleva a /proximamente`, url === '/proximamente', String(url));
    } else {
      comprueba(`${nombre}: vacío`, url === null, String(url));
    }
  }
  const aStripe = Object.entries(ENLACES).filter(([, u]) => (u ?? '').includes('stripe.com'));
  comprueba(
    'ninguno apunta a Stripe',
    aStripe.length === 0,
    aStripe.map(([n]) => n).join(', ')
  );

  console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
  process.exit(fallos === 0 ? 0 : 1);
}

/*
 * QUÉ CUENTA COMO "PENDIENTE"
 *
 * Un producto cuyo Payment Link todavía no se ha creado. En la app se escribe
 * como cadena vacía y en la web como '/proximamente', y las dos cosas se
 * comportan solas: `entryCheckoutUrl` devuelve null y el botón no se enseña, y
 * la web manda a una página que lo explica. Lo que NO puede pasar es que uno
 * de los dos lados se quede con el enlace viejo: ese es el único estado en el
 * que alguien paga un importe que no es el que ha leído.
 */
const pendientes = Object.entries(ENLACES).filter(
  ([, u]) => u === null || u === '/proximamente'
);
const puestos = Object.entries(ENLACES).filter(([, u]) => u && u !== '/proximamente');

console.log('\nLos botones van al endpoint de pago');
/*
 * Los botones ya NO van al Payment Link: van a /api/pagar, que crea la sesión
 * con el descuento dentro y la pasarela abre con 120 € en vez de enseñar 240 €
 * y repintarlo. Cada botón con SU rol: `rol=trainer` en el del atleta cobra
 * 240 € por lo que vale 60.
 */
for (const [nombre, url] of puestos) {
  const rol = nombre.includes('entrenador') ? 'trainer' : 'athlete';
  comprueba(nombre, url === `https://udeca.vercel.app/api/pagar?rol=${rol}`, String(url));
}
if (puestos.length === 0) console.log('  · ninguno todavía');

console.log('\nY la red, si el endpoint falla, es el Payment Link de siempre');
for (const [nombre, clave] of [['entrenador', 'COACH_LINK'], ['atleta', 'ATHLETE_LINK']]) {
  const red = constante(app, clave);
  comprueba(`red del ${nombre}: Payment Link`, (red ?? '').startsWith('https://buy.stripe.com/'), String(red));
  // Sin el código, el día que el endpoint falle se cobra el precio entero.
  comprueba(`red del ${nombre}: con el primer año`, /prefilled_promo_code=PRIMERANO/.test(red ?? ''), String(red));
}

console.log('\nLas dos copias del primer año dicen lo mismo');
{
  // Si se separan, la mitad de las altas van a un producto y la otra mitad a
  // otro, y el webhook activa cuentas que no han pagado lo que cree. Con el
  // enlace pendiente la pareja también tiene que ir a la vez: vacío en la app
  // y /proximamente en la web, nunca uno de cada.
  for (const rol of ['entrenador', 'atleta']) {
    const enApp = ENLACES[`primer año del ${rol} (app)`];
    const enWeb = ENLACES[`primer año del ${rol} (web)`];
    const coinciden = enApp === null ? enWeb === '/proximamente' : enApp === enWeb;
    comprueba(
      `el primer año del ${rol} coincide en la app y en la web`,
      coinciden,
      `${enApp} vs ${enWeb}`
    );
  }
}

console.log('\nNo hay enlaces cruzados');
{
  /*
   * LA REGLA SE HA DADO LA VUELTA, Y CONVIENE ENTENDER POR QUÉ.
   *
   * Antes había cuatro productos y la regla era "cada uno con su enlace":
   * poner el del alta en el botón de la cuota hacía que alguien pagase 27 €
   * creyendo pagar 180 y se quedara sin plan.
   *
   * Ahora hay DOS. El alta y la cuota son el mismo producto —una suscripción
   * anual con la primera factura a mitad—, así que los dos botones de un mismo
   * rol tienen que apuntar al MISMO sitio: eso ya no es un cruce, es lo que se
   * quería. Exigir cuatro enlaces distintos hoy obligaría a inventarse dos
   * productos que no existen.
   *
   * Lo que sigue sin poder pasar es lo caro: que el entrenador y el atleta
   * compartan enlace. Ahí sí se cobran 60 € por lo que vale 240, o al revés.
   */
  const coach = ENLACES['primer año del entrenador (app)'];
  const atleta = ENLACES['primer año del atleta (app)'];
  comprueba(
    'el entrenador y el atleta no comparten enlace',
    !coach || !atleta || coach !== atleta,
    `${coach} vs ${atleta}`
  );
  comprueba(
    'y en cada rol, entrar y renovar van al mismo producto',
    ENLACES['cuota anual del entrenador'] === coach &&
      ENLACES['cuota anual del atleta'] === atleta,
    'si se separan, la web y la app cobran cosas distintas'
  );
}

console.log('\nModo de cobro');
{
  const enPruebas = puestos.filter(([, u]) => esPruebas(u));
  const enReal = puestos.filter(([, u]) => !esPruebas(u));

  // Mezclar los dos modos es lo peor de todo: unos cobran y otros no, y a
  // simple vista está "puesto".
  comprueba(
    'todos van en el mismo modo',
    enPruebas.length === 0 || enReal.length === 0,
    `${enPruebas.length} de pruebas y ${enReal.length} de verdad`
  );

  if (enPruebas.length > 0) {
    console.log('\n  ┌───────────────────────────────────────────────────────────┐');
    console.log('  │  MODO PRUEBAS: estos enlaces NO COBRAN.                   │');
    console.log('  │  Abren la pasarela, aceptan la tarjeta y dan las gracias.  │');
    console.log('  │  Antes de publicar en las tiendas hay que cambiarlos por   │');
    console.log('  │  los de verdad (Stripe → Payment Links, sin modo prueba).  │');
    console.log('  └───────────────────────────────────────────────────────────┘');
    for (const [nombre] of enPruebas) console.log(`     · ${nombre}`);
  } else if (enReal.length > 0) {
    console.log('  ✔ cobrando de verdad');
  }
}

/*
 * Los pendientes no son un fallo —vacío es el estado seguro— pero tampoco
 * pueden pasar desapercibidos: mientras uno lo esté, NADIE puede darse de alta
 * de ese rol ni en la app ni en la web. Se avisa en grande para que no se
 * publique una tienda creyendo que el cobro está abierto.
 */
if (pendientes.length > 0) {
  console.log('\n  ┌───────────────────────────────────────────────────────────┐');
  console.log('  │  ENLACES PENDIENTES: por aquí no se puede pagar todavía.  │');
  console.log('  │  Mientras estén así, nadie puede darse de alta de ese      │');
  console.log('  │  rol. Se crean en Stripe (Payments → Payment Links, modo   │');
  console.log('  │  producción) y se pegan en lib/enlacesDeCobro.ts y, los    │');
  console.log('  │  del primer año, también en web/config.js.                 │');
  console.log('  └───────────────────────────────────────────────────────────┘');
  for (const [nombre] of pendientes) console.log(`     · ${nombre}`);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
