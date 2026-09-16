/*
 * La pantalla de entrar: cuentas guardadas, sin correo y de un toque.
 *
 * Estos ficheros se leen como TEXTO a propósito, igual que en check-stripe:
 * `lib/googleAuth.ts` importa React Native y `app/(auth)/login.tsx` es una
 * pantalla entera, así que no se pueden importar desde Node pelado. Y por red
 * tampoco se puede comprobar: el flujo de Google sale a accounts.google.com,
 * que no es alcanzable desde el entorno de pruebas.
 *
 * Lo que se protege son tres cosas que, si se rompen, no dan ningún error:
 *
 *  1. QUE NO VUELVA EL CORREO. Un correo en la pantalla de entrar no ayuda a
 *     nadie a reconocerse —uno sabe cuál es su cara— y sí se lo enseña a quien
 *     mire el móvil por encima del hombro.
 *  2. QUE EL ATAJO SIGA SIENDO UN ATAJO. Sin `login_hint`, tocar tu cuenta te
 *     lleva igualmente al "elige una cuenta" de Google: el botón parece que
 *     funciona y no ahorra nada.
 *  3. QUE LA SESIÓN NO SE PIERDA. Firebase la guarda solo si se le da
 *     almacenamiento; en móvil hay que pasárselo a mano.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-login-directo.mjs
 */
import { readFileSync } from 'node:fs';
import { mensajeDeEntrada } from '../lib/mensajesDeEntrada.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const lee = (ruta) => readFileSync(ruta, 'utf8');

const google = readFileSync('lib/googleAuth.ts', 'utf8');
const login = readFileSync('app/(auth)/login.tsx', 'utf8');
const firebase = readFileSync('lib/firebase.ts', 'utf8');
const cuentas = readFileSync('lib/rememberedAccounts.ts', 'utf8');

console.log('\nY "usar otra cuenta" abre OTRA cuenta');
{
  // La petición de Google se reconstruye cuando cambia la pista, y hasta que
  // no lo ha hecho sigue siendo la anterior, con su login_hint dentro. Si se
  // abre sin comprobarlo, pedir "otra cuenta" lleva a la de antes y el botón
  // parece roto. Pasó de verdad.
  comprueba(
    'no se abre Google con la petición de la cuenta anterior',
    /request\.extraParams\?\.login_hint !== pista/.test(google),
    'falta esperar a que la petición lleve la pista nueva'
  );
  comprueba(
    'y el efecto se entera de que la pista ha cambiado',
    /\}, \[porAbrir, request, pista\]\)/.test(google),
    '`pista` no está en las dependencias: el efecto no vuelve a entrar'
  );
  comprueba(
    'sin pista, Google pregunta con qué cuenta',
    /prompt: 'select_account'/.test(google)
  );
}

console.log('\nEl atajo entra directo a esa cuenta');
{
  comprueba('Google recibe la pista de cuenta', /login_hint/.test(google));
  comprueba('en web', /setCustomParameters\([\s\S]{0,200}login_hint/.test(google));
  comprueba('y en móvil', /extraParams[\s\S]{0,120}login_hint/.test(google));
  comprueba('`entrar` acepta la pista', /entrar:\s*\(pista\?: string\)/.test(google));
  // Sin pista se sigue preguntando: quien tiene la personal y la del trabajo
  // no puede entrar con la equivocada sin haber podido elegir.
  comprueba('sin pista, Google sigue preguntando', /prompt:\s*'select_account'/.test(google));
  comprueba('la pantalla se la pasa', /entrarCon\(suyo,[\s\S]{0,80}acc\.email/.test(login));
}

console.log('\nEl correo no se enseña');
{
  // El correo puede aparecer en el fichero por dos motivos legítimos: como
  // `key` de la lista y como la pista que se le pasa a Google. Lo que no puede
  // es acabar dentro de un <Text>, que es lo que lo pondría en pantalla.
  const lineasConCorreo = login
    .split('\n')
    .filter((l) => /acc\.email/.test(l))
    .filter((l) => !/key=\{acc\.email\}/.test(l))
    .filter((l) => !/forgetAccount\(acc\.email\)/.test(l))
    .filter((l) => !/entrarCon\(/.test(l));
  comprueba('la lista no pinta el correo', lineasConCorreo.length === 0,
    lineasConCorreo.join(' | ').slice(0, 160));
  comprueba('y no hay ningún <Text> con el correo dentro',
    !/<Text[^>]*>\s*\{acc\.email\}/.test(login));
  comprueba('ni queda el rótulo de antes', !/Ya has entrado aquí/.test(login));
  comprueba('pero se guarda, que hace falta para el atajo', /email:\s*string/.test(cuentas));
  comprueba('y se enseña el nombre', /\{acc\.name\}/.test(login));
}

console.log('\nSolo se ofrecen atajos que funcionan');
{
  // Una cuenta de cuando había contraseña no tiene proveedor: su botón no
  // llevaría a ninguna parte.
  comprueba('se filtran por proveedor', /provider === 'google'[\s\S]{0,80}provider === 'apple'/.test(login));
  comprueba('y por disponibilidad en este aparato',
    /google\.disponible/.test(login) && /apple\.disponible/.test(login));
}

console.log('\nLa sesión se guarda sola');
{
  // Sin esto, en el móvil habría que entrar cada vez que se abre la app.
  comprueba('en móvil se le da almacenamiento a Firebase',
    /getReactNativePersistence\(AsyncStorage\)/.test(firebase));
  comprueba('y en web se usa el `getAuth` normal, que ya persiste',
    /getAuth\(app\)/.test(firebase));
  // Cerrar sesión NO puede borrar las cuentas guardadas: son los atajos para
  // volver a entrar.
  const auth = readFileSync('lib/auth-context.tsx', 'utf8');
  const signOut = auth.slice(auth.indexOf('const signOut'), auth.indexOf('const signOut') + 400);
  comprueba('cerrar sesión no borra los atajos', !/forgetAccount/.test(signOut), signOut.slice(0, 120));
}

/*
 * EL MENSAJE CUANDO FALLA GOOGLE O APPLE.
 *
 * LO QUE COSTÓ: el 15 de septiembre Apple rechazó la app por la norma 2.1(a).
 * El revisor pulsó "Entrar con Apple" en un iPad, falló, y la app le contestó
 * "Esa contraseña no es. Si no te acuerdas, pide restablecerla desde abajo" —
 * en una pantalla sin campo de contraseña, en una app que NO tiene
 * contraseñas.
 *
 * El motivo: `auth/invalid-credential` significa dos cosas distintas. Con
 * correo y clave es "la contraseña no es"; con Google o con Apple es "Firebase
 * ha rechazado la credencial", y ahí no hay contraseña de por medio. Estaban
 * mapeados al mismo texto.
 *
 * Lo que se vigila:
 *
 *  1. Que la función SEPA de dónde viene el intento. Sin ese dato vuelve a ser
 *     imposible distinguir los dos casos.
 *  2. Que las dos pantallas de entrada se lo digan. Es lo que se olvida al
 *     añadir una tercera.
 *  3. Que un fallo de proveedor no hable de contraseñas.
 *  4. Que el mensaje lleve el código de Firebase detrás. Es la diferencia entre
 *     arreglar el siguiente fallo con una captura o gastar tres compilaciones
 *     adivinando — y esta vez se gastó un rechazo entero.
 */
console.log('\nUn fallo de Google o de Apple no habla de contraseñas');
{
  const mensajes = lee('lib/mensajesDeEntrada.ts');
  comprueba(
    'el mensaje sabe de dónde viene el intento',
    /mensajeDeEntrada\(e: unknown, origen: OrigenDeEntrada/.test(mensajes)
  );
  // Y que siga pudiendo ejecutarse desde aquí. En cuanto este fichero importe
  // Firebase o React Native, las cuatro comprobaciones de abajo dejan de correr
  // y volvemos a fiarnos de leer el texto, que es lo que dejó pasar el fallo.
  comprueba('los mensajes no arrastran dependencias', !/^import /m.test(mensajes));
  comprueba(
    'y enlazarCuenta.ts los sigue ofreciendo',
    /export \{ mensajeDeEntrada[^}]*\} from '\.\/mensajesDeEntrada'/.test(
      lee('lib/enlazarCuenta.ts')
    )
  );
  for (const pantalla of ['app/(auth)/login.tsx', 'app/(auth)/register.tsx']) {
    comprueba(
      `${pantalla} lo dice al fallar un proveedor`,
      /mensajeDeEntrada\(e, 'proveedor'\)/.test(lee(pantalla))
    );
  }
  // Y que de verdad conteste otra cosa. Se llama a la función con el error que
  // devuelve Firebase cuando rechaza una credencial de Apple.
  const fallo = { code: 'auth/invalid-credential' };
  const conProveedor = mensajeDeEntrada(fallo, 'proveedor');
  const conClave = mensajeDeEntrada(fallo);
  comprueba(
    'con Apple no dice "esa contraseña no es"',
    !/contrase/i.test(conProveedor),
    conProveedor
  );
  comprueba(
    'y lleva el código de Firebase detrás',
    /\(invalid-credential\)/.test(conProveedor),
    conProveedor
  );
  comprueba(
    'pero con correo y clave sigue diciéndolo',
    /contrase/i.test(conClave),
    conClave
  );
  // Sin código, nada de paréntesis vacíos.
  comprueba(
    'sin código no se inventa un paréntesis',
    !/\(\s*\)/.test(mensajeDeEntrada({}, 'proveedor')),
    mensajeDeEntrada({}, 'proveedor')
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
