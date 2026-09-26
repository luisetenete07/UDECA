/*
 * LA PUERTA DE SERVICIO CON CORREO. SE QUEDA, Y ESTE GUARDIÁN CON ELLA.
 *
 * Apple rechazó la 1.1.2 por la norma 2.1(a) pidiendo "a user name and
 * password" para revisar la app, y UDECA solo entra con Google o Apple. Se
 * añadió esta entrada para darle credenciales al revisor. Se iba a quitar al
 * aprobarse, pero Apple revisa CADA actualización con esas mismas
 * credenciales: quitarla es un rechazo garantizado en la siguiente versión.
 *
 * Lo que se vigila:
 *
 *  1. Que funcione: que el botón no mande peticiones vacías y que entre por
 *     `signIn`, el mismo camino de siempre.
 *  2. QUE SIGA FUERA DE ANDROID, discreta y marcada, con el porqué escrito.
 *     Una puerta de servicio sin cartel acaba o borrada por alguien que no
 *     sabe para qué está —y entonces rechazan la siguiente versión— o
 *     convertida en la entrada principal sin que nadie lo decida.
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

console.log('\nEn todo menos Android, discreta y con su porqué');
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
    'si esto se amplía a Android, se enseña donde nadie la ha pedido'
  );
  ok('y el bloque solo se pinta con eso', /\{conCorreo \? \(/.test(login));
  // El porqué, escrito donde se ve. Una puerta de servicio sin cartel se queda
  // abierta para siempre.
  ok('el bloque va marcado como puerta de servicio', /PUERTA DE SERVICIO/.test(login));
  // Y que NADIE la quite pensando que era temporal: sin ella, Apple no tiene
  // con qué entrar a revisar la siguiente versión.
  ok('y dice que no se quita', /NO SE QUITA/.test(login));
  ok('discreta: en gris, no como un enlace más', /styles\.correoDiscreto/.test(login) && /correoDiscreto: \{[^}]*colors\.textFaint/.test(login));
  ok('y el módulo dice dónde se ve', /EN TODO MENOS ANDROID/.test(lee('lib/accesoConCorreo.ts')));
  const modulo = lee('lib/accesoConCorreo.ts');
  ok('y el módulo explica por qué se queda', /POR QUÉ SE QUEDA/.test(modulo));
  ok('sin imports, para poder probarlo', !/^import /m.test(modulo));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
