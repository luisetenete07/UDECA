/*
 * ACCESO TEMPORAL CON CORREO. ESTE GUARDIÁN SE BORRA CON ÉL.
 *
 * Apple rechazó la 1.1.2 por la norma 2.1(a) pidiendo "a user name and
 * password" para revisar la app. Pero UDECA entra solo con Google o con Apple,
 * así que la cuenta de demostración que crea seed-test-accounts.mjs no abría
 * nada: se le estaban dando al revisor unas credenciales inservibles.
 *
 * Lo que se vigila mientras esto viva son dos cosas, y la segunda es la que
 * importa de verdad:
 *
 *  1. Que funcione: que el botón no mande peticiones vacías y que entre por
 *     `signIn`, el mismo camino de siempre.
 *  2. QUE SIGA SIENDO SOLO DE iOS Y SIGA MARCADO COMO TEMPORAL. Lo fácil, y lo
 *     que pasa siempre, es que una puerta de servicio se quede abierta para
 *     siempre porque nadie se acuerda de por qué se abrió. Aquí el porqué está
 *     escrito, y este guardián se cae si alguien lo borra o si lo extiende a
 *     Android.
 *
 * CUANDO APPLE ACEPTE LA VERSIÓN: borrar lib/accesoConCorreo.ts, este fichero
 * y el bloque marcado ACCESO TEMPORAL en app/(auth)/login.tsx.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-acceso-con-correo.mjs
 */
import { readFileSync } from 'node:fs';
import { correoValido, puedeEntrarConCorreo } from '../lib/accesoConCorreo.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');

console.log('\nNo se manda una petición por un dedazo');
{
  ok('un correo normal vale', correoValido('udeca.app+coach@gmail.com'));
  ok('sin arroba no', !correoValido('udeca.app'));
  ok('sin dominio tampoco', !correoValido('luis@gmail'));
  ok('ni vacío', !correoValido('   '));
  // Se permite lo raro pero legítimo: el que manda es Firebase, y una
  // expresión regular estricta acaba rechazando direcciones que existen.
  ok('y un correo con etiqueta sí', correoValido('a+b.c@sub.dominio.es'));

  ok('sin contraseña no se puede pulsar', !puedeEntrarConCorreo('a@b.co', ''));
  ok('con las dos cosas sí', puedeEntrarConCorreo('a@b.co', 'loquesea'));
}

console.log('\nEstá puesto, y entra por donde entra todo el mundo');
{
  const login = lee('app/(auth)/login.tsx');
  ok('hay entrada con correo', /const entrarConCorreo = async/.test(login));
  // Por `signIn` del contexto, que es el mismo camino del rescate de cuentas
  // antiguas. Un segundo camino de entrada sería un segundo sitio donde
  // equivocarse con la sesión.
  ok('usa el signIn de siempre', /await signIn\(correo\.trim\(\), password\)/.test(login));
  ok('y el botón no se puede pulsar en vacío', /disabled=\{!puedeEntrarConCorreo\(correo, password\)\}/.test(login));
  // Y que un fallo se cuente como lo que es, no como "esa contraseña no es"
  // cuando el fallo viene de otra parte.
  ok('los errores se traducen', /setError\(mensajeDeEntrada\(e\)\)/.test(login));
}

console.log('\nEn todo menos Android, y marcado para borrar');
{
  const login = lee('app/(auth)/login.tsx');
  /*
   * LO IMPORTANTE: QUE ANDROID SIGA FUERA.
   *
   * En iPhone y iPad porque lo pide la revisión de Apple; en la web para poder
   * probarlo sin esperar una compilación. Android es donde hay usuarios de
   * verdad y donde nadie ha pedido nada: enseñar allí una forma de entrar que
   * vamos a quitar sería enseñársela para retirársela después.
   */
  ok(
    'la puerta NO se abre en Android',
    /const conCorreo = Platform\.OS !== 'android';/.test(login),
    'si esto se amplía a Android, deja de ser temporal sin que nadie lo decida'
  );
  ok('y el bloque solo se pinta con eso', /\{conCorreo \? \(/.test(login));
  // El porqué, escrito donde se ve. Una puerta de servicio sin cartel se queda
  // abierta para siempre.
  ok('el bloque va marcado como temporal', /ACCESO TEMPORAL/.test(login));
  ok('y el módulo dice dónde se ve', /EN TODO MENOS ANDROID/.test(lee('lib/accesoConCorreo.ts')));
  const modulo = lee('lib/accesoConCorreo.ts');
  ok('y el módulo explica cómo quitarlo', /CÓMO SE QUITA/.test(modulo));
  ok('sin imports, para poder probarlo', !/^import /m.test(modulo));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
