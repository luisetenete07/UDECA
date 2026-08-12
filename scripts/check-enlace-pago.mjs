/*
 * El enlace de cobro, uno por alumno (lib/enlaceDePago.ts).
 *
 * Lo que hay que proteger: que el botón de pagar de un alumno abra SU enlace y
 * el de nadie más. Antes había uno solo para todo el grupo, y con planes
 * distintos eso significa cobrarle de menos a unos y de más a otros. Un cobro
 * equivocado no es un fallo de pantalla: es dinero mal cobrado a una persona
 * que confía en su entrenador.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-enlace-pago.mjs
 */
import {
  enlaceDePagoDe,
  enlaceValido,
  pistaDelEnlace,
  urlDePago,
} from '../lib/enlaceDePago.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nQué vale como enlace de cobro');
{
  comprueba('un enlace de Stripe', enlaceValido('https://buy.stripe.com/abc'));
  comprueba('uno de PayPal', enlaceValido('https://paypal.me/luis/40'));
  comprueba('http también (hay pasarelas viejas)', enlaceValido('http://cobro.ejemplo/1'));
  comprueba('con espacios alrededor, igual', enlaceValido('  https://buy.stripe.com/abc  '));

  comprueba('vacío no', !enlaceValido(''));
  comprueba('nada no', !enlaceValido(undefined) && !enlaceValido(null));
  comprueba('un texto suelto no', !enlaceValido('bizum al 600123456'));
  comprueba('sin protocolo no', !enlaceValido('buy.stripe.com/abc'));
  // Un javascript: en un campo que se abre con Linking es una puerta abierta.
  comprueba('javascript: NO', !enlaceValido('javascript:alert(1)'));
  comprueba('un archivo del móvil tampoco', !enlaceValido('file:///etc/passwd'));
}

console.log('\nDe quién es el enlace que se abre');
{
  const alumno = { paymentLink: 'https://buy.stripe.com/alumno' };
  comprueba('el suyo', enlaceDePagoDe(alumno) === 'https://buy.stripe.com/alumno');
  comprueba('recortado', enlaceDePagoDe({ paymentLink: '  https://x.test/1 ' }) === 'https://x.test/1');

  // Aquí está el fondo del cambio: sin enlace propio NO se cae al del grupo.
  // Quien tiene tarifa distinta pagaría la de los demás sin enterarse.
  comprueba('sin enlace propio, ninguno', enlaceDePagoDe({}) === null);
  comprueba('sin perfil, ninguno', enlaceDePagoDe(null) === null);
  comprueba('con un enlace inservible, ninguno', enlaceDePagoDe({ paymentLink: 'a saber' }) === null);
  comprueba('vale más ningún botón que uno que cobra otra cosa',
    enlaceDePagoDe({ paymentLink: '' }) === null);
}

console.log('\nLa dirección que se abre de verdad');
{
  // El client_reference_id es lo que permite al webhook saber QUIÉN pagó y
  // marcar el cobro solo. Sin él, todo cobro habría que confirmarlo a mano.
  const conStripe = urlDePago('https://buy.stripe.com/abc', 'uid-123');
  comprueba('a Stripe se le dice quién paga', conStripe.includes('client_reference_id=uid-123'), conStripe);
  comprueba('respetando los parámetros que ya llevaba',
    urlDePago('https://buy.stripe.com/abc?x=1', 'uid-123') ===
      'https://buy.stripe.com/abc?x=1&client_reference_id=uid-123');
  comprueba('escapando el identificador',
    urlDePago('https://buy.stripe.com/abc', 'a b/c').includes('a%20b%2Fc'));
  // Dos client_reference_id en la misma dirección es un pago que no se sabe
  // de quién es: si ya viene puesto, no se toca.
  const yaLoLleva = 'https://buy.stripe.com/abc?client_reference_id=otro';
  comprueba('si ya lo lleva, no se duplica', urlDePago(yaLoLleva, 'uid-123') === yaLoLleva);

  // Los demás no entienden ese parámetro: se abren tal cual.
  comprueba('a Bizum o PayPal no se le añade nada',
    urlDePago('https://paypal.me/luis/40', 'uid-123') === 'https://paypal.me/luis/40');
  comprueba('sin alumno, tal cual',
    urlDePago('https://buy.stripe.com/abc', '') === 'https://buy.stripe.com/abc');
}

console.log('\nLo que se le dice al entrenador');
{
  // Sin enlace no hay fallo: hay quien cobra en mano y no quiere botón.
  const vacio = pistaDelEnlace('', 40);
  comprueba('sin enlace no se le riñe', !/error|fallo|mal/i.test(vacio), vacio);
  comprueba('pero se le dice qué se pierde', /toque/i.test(vacio));
  comprueba('y con qué cuota', vacio.includes('40 €'));
  comprueba('sin cuota, sigue teniendo sentido', pistaDelEnlace('').length > 20);

  comprueba('un enlace roto sí se avisa', /https:\/\//.test(pistaDelEnlace('vaya vaya')));
  comprueba('con Stripe se dice que el cobro se confirma solo',
    /solo/i.test(pistaDelEnlace('https://buy.stripe.com/abc')));
  comprueba('con otro, que habrá que confirmarlo a mano',
    /a mano/i.test(pistaDelEnlace('https://paypal.me/luis/40')));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
