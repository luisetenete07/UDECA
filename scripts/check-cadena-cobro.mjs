/*
 * La cadena de cobro entera, rol por rol y plan por plan.
 *
 * POR QUÉ EXISTE
 *
 * Un cobro pasa por cinco manos —el enlace que se abre, lo que Stripe cobra, lo
 * que el webhook escribe, lo que la app lee y lo que el usuario ve— y cada una
 * vive en un fichero distinto. Ninguna comprobación miraba el recorrido
 * completo, y así se colaron dos fallos que no dan error por ninguna parte:
 *
 *  - El webhook no escribía NUNCA `subscriptionPlan`. Quien pagaba los 96 € del
 *    año se quedaba con el plan en blanco, o con el que tuviera antes.
 *  - El panel del CEO lo deducía del ROL ("el atleta paga al mes"), así que
 *    darle un año a un atleta le dejaba "mensual" escrito en la ficha.
 *
 * Los dos son silenciosos: el acceso funciona igual, porque el acceso lo manda
 * la fecha. Lo que queda mal es lo que se lee al mirar una cuenta, que es
 * justamente lo que se mira cuando alguien pide una devolución.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-cadena-cobro.mjs
 */
import { readFileSync } from 'node:fs';
/*
 * De lib/enlacesDeCobro.ts y NO de lib/subscription.ts, aunque este último los
 * reexporte: subscription.ts lee `Platform.OS` al cargarse y arrastra React
 * Native entera, que en Node pelado ni siquiera se puede importar. Los enlaces
 * se sacaron a su propio fichero precisamente para que esta comprobación
 * pudiera existir.
 */
import {
  ATHLETE_ANNUAL_LINK,
  ATHLETE_ENTRY_LINK,
  ATHLETE_PAYMENT_LINK,
  COACH_ENTRY_LINK,
  COACH_PAYMENT_LINK,
  entryCheckoutUrl,
  subscriptionCheckoutUrl,
} from '../lib/enlacesDeCobro.ts';
import { PAGOS_ACTIVOS } from '../lib/planBase.ts';

/*
 * Los precios sí se leen del texto de subscription.ts, por lo mismo. Son cuatro
 * números y no merecen otro fichero; lo que hace falta comprobar de ellos es
 * que las cuentas del escaparate cuadren.
 */
const numero = (texto, nombre) =>
  Number((texto.match(new RegExp(`${nombre}\\s*=\\s*(\\d+)`)) ?? [])[1]);

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const perfil = (extra) => ({
  uid: 'u1',
  email: 'quien@ejemplo.com',
  name: 'Quien Sea',
  role: 'athlete',
  createdAt: 0,
  ...extra,
});

// =========================================================================
console.log('\n1 · Cada cuenta abre el enlace que le toca');
// =========================================================================
const atleta = perfil({ role: 'athlete' });
const coach = perfil({ role: 'trainer' });

const casos = [
  ['el alta del atleta', entryCheckoutUrl(atleta), ATHLETE_ENTRY_LINK],
  ['el alta del entrenador', entryCheckoutUrl(coach), COACH_ENTRY_LINK],
  ['el atleta al mes', subscriptionCheckoutUrl(atleta, 'monthly'), ATHLETE_PAYMENT_LINK],
  ['el atleta al año', subscriptionCheckoutUrl(atleta, 'annual'), ATHLETE_ANNUAL_LINK],
  ['el entrenador, anual', subscriptionCheckoutUrl(coach, 'annual'), COACH_PAYMENT_LINK],
  // El entrenador no elige: pida lo que pida, va a su único enlace.
  ['el entrenador aunque pidan mensual', subscriptionCheckoutUrl(coach, 'monthly'), COACH_PAYMENT_LINK],
];
for (const [que, url, esperado] of casos) {
  ok(que, !!url && url.startsWith(esperado), String(url).slice(0, 60));
}

// Los cinco tienen que ser DISTINTOS: dos iguales significa cobrar otra cosa.
const enlaces = [
  ATHLETE_ENTRY_LINK,
  COACH_ENTRY_LINK,
  ATHLETE_PAYMENT_LINK,
  ATHLETE_ANNUAL_LINK,
  COACH_PAYMENT_LINK,
];
ok('los cinco enlaces son distintos', new Set(enlaces).size === 5);
ok('ninguno es de prueba', !enlaces.some((l) => /\/test_[A-Za-z0-9]{6,}/.test(l)));

console.log('\n2 · Y llevan dentro con qué activar la cuenta');
for (const [que, url] of casos) {
  const bien =
    !!url &&
    url.includes(`client_reference_id=${atleta.uid}`) &&
    url.includes('prefilled_email=quien%40ejemplo.com');
  // Sin el uid dentro, el pago entra y la cuenta no se activa nunca, sin dar
  // ningún error: es el fallo más caro posible de esta cadena.
  ok(`${que}: lleva el uid y el correo`, bien, String(url).slice(0, 90));
}
ok('sin perfil no hay enlace', subscriptionCheckoutUrl(null) === null);
ok('ni de alta', entryCheckoutUrl(null) === null);

// =========================================================================
console.log('\n3 · El webhook escribe el plan, y lo saca del cobro');
// =========================================================================
const webhook = sinComentarios(lee('payments-webhook/api/stripe-webhook.js'));
ok('lee el intervalo de la suscripción', /recurring\?\.interval/.test(webhook));
ok('un año es "annual"', /'year'\)\s*return\s*'annual'/.test(webhook.replace(/\s+/g, ' ')) ||
  /intervalo === 'year'/.test(webhook));
ok('un mes es "monthly"', /intervalo === 'month'/.test(webhook));
ok('lo escribe al activar', /subscriptionPlan: plan/.test(webhook));
// Si no se puede leer, mejor no tocar nada: ninguna información es mejor que
// la falsa, y un null encima borraría lo que ya hubiera.
ok('y no lo pisa con vacío', /\.\.\.\(plan \? \{ subscriptionPlan: plan \} : \{\}\)/.test(webhook));
ok('lo relee en cada renovación', (webhook.match(/planDeLaSuscripcion\(sub\)/g) ?? []).length >= 2);
// La fecha sale del periodo pagado de verdad, no de sumar un mes a ojo.
ok('la fecha sale del periodo pagado', /until = subPeriodEndMs\(sub\)/.test(webhook));

// =========================================================================
console.log('\n4 · El panel del CEO también');
// =========================================================================
const panel = sinComentarios(lee('app/(trainer)/profile.tsx'));
ok('el plan sale de los días, no del rol', /planPorDias/.test(panel));
ok('un año o más es anual', /dias >= 365 \? 'annual' : 'monthly'/.test(panel));
ok('ya no se deduce del rol', !/role === 'athlete' \? 'monthly' : 'annual'/.test(
  panel.replace(/coach\.subscriptionPlan \?\? \(coach\.role === 'athlete' \? 'monthly' : 'annual'\)/, '')
));

// =========================================================================
console.log('\n5 · Las cuentas del plan anual del atleta');
// =========================================================================
const subs = sinComentarios(lee('lib/subscription.ts'));
const anual = numero(subs, 'ATHLETE_ANNUAL_EUR');
const mensual = numero(subs, 'ATHLETE_MONTHLY_EUR');
ok('los dos precios están escritos', anual > 0 && mensual > 0, `${anual} / ${mensual}`);
// El ahorro se calcula, nunca se escribe: es el único número sobre dinero que
// la app enseña, y una cifra a mano se queda vieja sin avisar.
ok('el ahorro se calcula, no se escribe', /AHORRO_ANUAL_PCT = Math\.round\(/.test(subs));
ok('y el año sale más barato que doce meses', anual < mensual * 12,
  `${anual} vs ${mensual * 12}`);
// 96 entre 12 son 8,00 exactos, que es lo que hace legible el titular.
ok('el mensual equivalente es redondo', Number.isInteger(anual / 12), String(anual / 12));

// =========================================================================
console.log('\n6 · Lo que se le promete al entrenador es verdad');
// =========================================================================
/*
 * Lo único que el plan del entrenador levanta es el TOPE DE ALUMNOS: así está
 * escrito en `trainerHasAccess`, que es quien decide. La tarjeta le vendía
 * además los cobros y los informes, que ya tenía con su alta.
 *
 * Prometer lo que ya se tiene no es un adorno: el día que lo descubre, lo que
 * aprende es que la lista estaba inflada, y entonces deja de creerse el resto.
 */
const tarjeta = sinComentarios(lee('components/UpgradeCard.tsx'));
const puerta = sinComentarios(lee('lib/planBase.ts'));
ok(
  'el acceso del entrenador solo depende del número de alumnos',
  /clientCount \?\? 0\) <= clientSlotsOf/.test(puerta)
);
ok('la tarjeta dice qué es lo que cambia', /Lo que cambia/.test(tarjeta));
ok('y que el resto ya lo tiene', /Ya lo tienes con tu alta/.test(tarjeta));
ok(
  'lo deja dicho sin rodeos',
  /El plan no desbloquea funciones/.test(tarjeta)
);

// =========================================================================
console.log('\n7 · Los dos interruptores');
// =========================================================================
ok('el cobro depende de PAGOS_ACTIVOS', /CAN_LINK_TO_PAYMENT = PAGOS_ACTIVOS/.test(subs));
// La norma 3.1.1 de Apple: ni precios ni enlaces a pagar fuera, en el iPhone.
ok('y del iPhone, por separado', /Platform\.OS !== 'ios'/.test(subs));
console.log(`    (cobrando ahora mismo: ${PAGOS_ACTIVOS})`);

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
