/*
 * El cobro que entra sin cuenta a la que aplicarlo.
 *
 * EL CAMINO NORMAL DE UN CLIENTE ES ÉSTE, no un caso raro: llega a udeca.app,
 * paga, y DESPUÉS se crea la cuenta en la app. Cuando paga todavía no existe
 * ningún uid, así que el cobro llega a Stripe sin `client_reference_id` y no
 * hay a quién activar.
 *
 * Mientras la entrada fue un pago suelto, eso lo recogía `altaPagadaSinCuenta`,
 * que lo apunta por correo para que lo reclame al registrarse. Pero esa rama
 * solo corre cuando el pago NO es suscripción, y `activateSubscription` —la
 * que sí corre— empezaba con un `if (!uid) return;`.
 *
 * O sea que el día que la entrada pasó a ser una suscripción, ese `return` se
 * convirtió en un agujero con forma de dinero: cobro hecho, cuenta sin activar,
 * y NI UN SOLO ERROR en ninguna parte. No se descubre probando. Se descubre
 * leyendo las cuentas del mes, o por un correo enfadado.
 *
 * Esto se lee como texto: el webhook importa firebase-admin y stripe, y no se
 * puede ejecutar aquí sin credenciales. Se vigila que las tres piezas de la
 * cadena sigan enganchadas, porque si una se suelta no protesta nadie.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-suscripcion-sin-cuenta.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
function ok(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}
const lee = (ruta) => readFileSync(ruta, 'utf8');

/**
 * El código sin sus comentarios.
 *
 * Hace falta porque el comentario que explica este arreglo CITA el código que
 * se quitó ("aquí había un `if (!uid) return;`"), y buscarlo a pelo lo
 * encuentra ahí y da por roto lo que está bien. Es el mismo tropiezo que ya
 * tuvo check-video-movil: en un repositorio donde los comentarios explican lo
 * que se quitó y por qué, un guardián que lee el fichero entero acaba
 * comprobando la prosa en vez del código.
 */
const sinComentar = (texto) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const webhook = lee('payments-webhook/api/stripe-webhook.js');
const alta = lee('payments-webhook/api/_alta.js');
const claim = lee('payments-webhook/api/claim-entry.js');

console.log('\nUna suscripción sin uid no se tira');
{
  // Lo que había: `const uid = ...; if (!uid) return;` como primera línea.
  const cuerpo = sinComentar(
    webhook.slice(
      webhook.indexOf('async function activateSubscription'),
      webhook.indexOf('async function suscripcionSinCuenta')
    )
  );
  ok('activateSubscription sigue existiendo', cuerpo.length > 0);
  ok(
    'y ya no se rinde cuando no hay uid',
    !/if \(!uid\) return;/.test(cuerpo),
    'ese return es el cobro perdido'
  );
  ok(
    'sino que lo guarda por correo',
    /await suscripcionSinCuenta\(session/.test(cuerpo)
  );
}

console.log('\nY se guarda lo que la hace una suscripción');
{
  const cuerpo = webhook.slice(
    webhook.indexOf('async function suscripcionSinCuenta'),
    webhook.indexOf('async function altaPagadaSinCuenta')
  );
  ok('la función existe', cuerpo.length > 0);
  // Los tres campos. Sin el plan, un entrenador que pague en la web entra sin
  // alumnos ilimitados —que es lo que acaba de comprar— y no lo sabe nadie.
  for (const campo of ['id:', 'until', 'plan']) {
    ok(`guarda ${campo.replace(':', '')}`, cuerpo.includes(campo));
  }
  ok(
    'si ya hay cuenta con ese correo, la activa ahora',
    /aplicarAlta\(db, q\.docs\[0\]\.id/.test(cuerpo)
  );
  ok(
    'y si no, la deja en entryPayments para reclamarla',
    /collection\('entryPayments'\)/.test(cuerpo)
  );
  // Sin correo no hay forma humana de saber de quién es ese dinero. Callar
  // sería exactamente el fallo que este fichero existe para impedir.
  ok('y un pago sin correo al menos grita en el registro', /console\.error/.test(cuerpo));
}

console.log('\nAl reclamarla se aplica entera');
{
  ok(
    'claim-entry le pasa la suscripción a aplicarAlta',
    /suscripcion: datos\.suscripcion \|\| null/.test(claim)
  );
  ok(
    'aplicarAlta la acepta',
    /suscripcion = null/.test(alta),
    'si no la recibe, el parámetro se pierde en silencio'
  );
  // Los tres campos, otra vez, pero ya sobre el perfil.
  for (const [que, re] of [
    ['enlaza la suscripción', /datos\.stripeSubscriptionId = suscripcion\.id/],
    ['escribe el plan', /datos\.subscriptionPlan = suscripcion\.plan/],
    ['y la fecha de fin real', /datos\.subscriptionUntil = Math\.max\(suscripcion\.until/],
  ]) {
    ok(que, re.test(alta));
  }
  /*
   * Y el año contado a mano NO se usa cuando hay suscripción.
   *
   * Si se usaran los dos, ganaría el mayor de los dos `Math.max` y la cuenta
   * caducaría un día distinto al del cargo de Stripe. Un día de diferencia no
   * suena a nada hasta que cae del lado malo: cuenta bloqueada con la
   * suscripción al corriente, o cobro sin acceso.
   */
  ok(
    'y el año calculado a mano se aparta cuando hay suscripción',
    /if \(!suscripcion && !perfil\.entryPaidAt\)/.test(alta)
  );
}

console.log('\nEl plan anual es lo que quita el tope de alumnos');
{
  // No es un efecto secundario: es lo que se ha comprado. `planIlimitado` mira
  // `subscriptionPlan === 'annual'`, y `planDeLaSuscripcion` lo saca del
  // intervalo del precio de Stripe. Si el enlace del entrenador dejara de ser
  // una suscripción anual, pagaría 240 € y seguiría con cinco alumnos.
  ok(
    'planDeLaSuscripcion devuelve annual por intervalo',
    /intervalo === 'year'\) return 'annual'/.test(webhook)
  );
  ok(
    'y planIlimitado se fía de ese mismo valor',
    /subscriptionPlan === 'annual'/.test(lee('lib/planBase.ts'))
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
