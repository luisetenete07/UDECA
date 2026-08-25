/*
 * Los enlaces de cobro de Stripe (lib/enlacesDeCobro.ts y web/config.js).
 *
 * Lo que hay que proteger son dos cosas que no dan error hasta que ya han
 * pasado:
 *
 *  1. QUE NO SE PUBLIQUE EN MODO PRUEBAS. Un enlace `buy.stripe.com/test_…`
 *     funciona: abre la pasarela, acepta la tarjeta y da las gracias. Lo único
 *     que no hace es cobrar. Nadie se entera hasta que se miran las cuentas del
 *     mes, y para entonces hay clientes convencidos de que pagaron.
 *  2. QUE LAS DOS COPIAS NO SE SEPAREN. Los enlaces del alta de 1 € están
 *     escritos DOS veces —en la app y en la web— porque no pueden importarse
 *     entre sí. El día que se cambie uno y no el otro, la mitad de las altas
 *     irán a un producto y la otra mitad a otro.
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

// Los cinco enlaces viven en lib/enlacesDeCobro.ts (antes estaban en
// subscription.ts, y se sacaron de ahí para poder recorrer la cadena de cobro
// entera desde Node — ver scripts/check-cadena-cobro.mjs).
const app = readFileSync('lib/enlacesDeCobro.ts', 'utf8');
const web = readFileSync('web/config.js', 'utf8');

/** El valor de una constante exportada, tal y como está escrito. */
function constante(texto, nombre) {
  const m = texto.match(new RegExp(`${nombre}[^=]*=\\s*\\n?\\s*'([^']+)'`));
  return m ? m[1] : null;
}

/** El valor de una clave dentro del objeto `pagos` de la web. */
function claveWeb(texto, nombre) {
  const m = texto.match(new RegExp(`${nombre}:\\s*'([^']+)'`));
  return m ? m[1] : null;
}

const ENLACES = {
  'suscripción del coach': constante(app, 'COACH_PAYMENT_LINK'),
  'suscripción del atleta': constante(app, 'ATHLETE_PAYMENT_LINK'),
  'atleta, pagando el año': constante(app, 'ATHLETE_ANNUAL_LINK'),
  'alta del coach (app)': constante(app, 'COACH_ENTRY_LINK'),
  'alta del atleta (app)': constante(app, 'ATHLETE_ENTRY_LINK'),
  'alta del coach (web)': claveWeb(web, 'altaCoach'),
  'alta del atleta (web)': claveWeb(web, 'altaAtleta'),
};

const esPruebas = (u) => /\/test_/.test(u ?? '');

/**
 * ¿Se cobra ya?
 *
 * Se lee de `lib/planBase.ts` como texto, igual que los enlaces: es la misma
 * razón —importar desde Node lo que arrastra React Native no se puede— y así
 * este guion sigue sin depender de nada.
 *
 * Con los pagos apagados, las seis comprobaciones de abajo no solo sobran: son
 * falsas. No hay enlaces que comparar, ni modo de cobro que mirar. Lo que hay
 * que proteger entonces es lo contrario, y es igual de importante: que no se
 * quede ningún enlace de Stripe a medio quitar, apuntando a un producto que
 * nadie vigila.
 */
const base = readFileSync('lib/planBase.ts', 'utf8');
const PAGOS_ACTIVOS = /export const PAGOS_ACTIVOS\s*=\s*true\s*;/.test(base);

if (!PAGOS_ACTIVOS) {
  console.log('\nAhora mismo NO se cobra (PAGOS_ACTIVOS = false)');
  console.log('Lo que se comprueba es que no quede ningún enlace suelto.\n');

  for (const nombre of [
    'suscripción del coach',
    'suscripción del atleta',
    'atleta, pagando el año',
    'alta del coach (app)',
    'alta del atleta (app)',
  ]) {
    comprueba(`${nombre}: vacío`, ENLACES[nombre] === null, String(ENLACES[nombre]));
  }
  for (const nombre of ['alta del coach (web)', 'alta del atleta (web)']) {
    comprueba(
      `${nombre}: lleva a /proximamente`,
      ENLACES[nombre] === '/proximamente',
      String(ENLACES[nombre])
    );
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

console.log('\nLos siete enlaces están puestos');
for (const [nombre, url] of Object.entries(ENLACES)) {
  comprueba(nombre, !!url && url.startsWith('https://buy.stripe.com/'), String(url));
}

console.log('\nLas dos copias del alta dicen lo mismo');
{
  // Si se separan, la mitad de las altas van a un producto y la otra mitad a
  // otro, y el webhook activa cuentas que no han pagado lo que cree.
  comprueba(
    'el alta del coach coincide en la app y en la web',
    ENLACES['alta del coach (app)'] === ENLACES['alta del coach (web)'],
    `${ENLACES['alta del coach (app)']} vs ${ENLACES['alta del coach (web)']}`
  );
  comprueba(
    'el alta del atleta coincide en la app y en la web',
    ENLACES['alta del atleta (app)'] === ENLACES['alta del atleta (web)'],
    `${ENLACES['alta del atleta (app)']} vs ${ENLACES['alta del atleta (web)']}`
  );
}

console.log('\nNo hay enlaces cruzados');
{
  // Cada rol al suyo: con el enlace del atleta en el botón del coach, alguien
  // paga 10 € creyendo que ha pagado 180 y la cuenta no se activa.
  const todos = Object.values(ENLACES).filter(Boolean);
  const distintos = new Set([
    ENLACES['suscripción del coach'],
    ENLACES['suscripción del atleta'],
    ENLACES['atleta, pagando el año'],
    ENLACES['alta del coach (app)'],
    ENLACES['alta del atleta (app)'],
  ]);
  comprueba('los cinco productos son cinco enlaces distintos', distintos.size === 5,
    `${distintos.size} distintos de 5`);
  comprueba('ninguno se ha quedado a medias', todos.every((u) => u.length > 30));
}

console.log('\nModo de cobro');
{
  const enPruebas = Object.entries(ENLACES).filter(([, u]) => esPruebas(u));
  const enReal = Object.entries(ENLACES).filter(([, u]) => u && !esPruebas(u));

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
  } else {
    console.log('  ✔ cobrando de verdad');
  }
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
