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

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

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

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
