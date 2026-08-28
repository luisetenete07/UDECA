/*
 * Que cualquiera pueda borrar su cuenta, entrara como entrara.
 *
 * EL FALLO QUE ESTO PERSIGUE
 *
 * El último paso pedía SIEMPRE la contraseña. Desde que UDECA entra solo con
 * Google y Apple, casi nadie tiene contraseña: escribieran lo que escribieran,
 * Firebase respondía que la credencial no vale. O sea que nadie que hubiera
 * entrado con Google o con Apple —es decir, todo el mundo nuevo— podía borrar
 * su cuenta.
 *
 * No salía en ningún sitio: la pantalla se pintaba entera, el botón se
 * encendía, y el fallo aparecía en el último toque, en un camino por el que casi
 * nadie pasa. Y es justo lo que un revisor de Apple prueba a mano: poder
 * borrarse desde dentro de la app es obligatorio (norma 5.1.1 de Apple y la
 * política de datos de Google Play), y no poder hacerlo es rechazo directo.
 *
 * Lo que se vigila es que el camino siga siendo el del proveedor con el que se
 * entró, y —lo más importante de todo— que no se borre una cuenta distinta de
 * la que se estaba mirando.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-borrar-cuenta.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

const pantalla = lee('app/account-deletion.tsx');

console.log('\nSe vuelve a identificar con lo que cada uno usa');
{
  ok('mira con qué proveedor entró', /providerData\?\.\[0\]\?\.providerId/.test(pantalla));
  ok('conoce el camino de Google', /conGoogle = proveedor === 'google\.com'/.test(pantalla));
  ok('y el de Apple', /conApple = proveedor === 'apple\.com'/.test(pantalla));
  ok('usa el acceso de Google para confirmar', /google\.entrar\(/.test(pantalla));
  ok('y el de Apple', /apple\.entrar\(/.test(pantalla));
  // Las cuentas de correo y contraseña de antes de la mudanza siguen valiendo.
  ok('a quien tiene contraseña se la sigue pidiendo', /reauthenticate\(password\)/.test(pantalla));
}

console.log('\nLa contraseña NO bloquea a quien no tiene ninguna');
{
  /*
   * Esto es lo que estaba roto: el botón exigía texto en el campo de la
   * contraseña. Quien entra con Google no tiene ninguna que escribir, así que
   * el botón no se encendía nunca.
   */
  ok('el campo solo se pinta si hay contraseña', /\{conPassword \? \([\s\S]{0,400}?TextField/.test(pantalla));
  ok('y el botón no la exige a los demás',
    /disabled=\{segundos > 0 \|\| \(conPassword && password\.length === 0\) \|\| borrando\}/.test(pantalla),
    'el botón vuelve a pedir contraseña a todo el mundo');
}

console.log('\nNo se borra la cuenta equivocada');
{
  /*
   * En la ventana de Google se puede elegir OTRA cuenta —tener la personal y la
   * del trabajo es lo normal—. Si eso pasa, la sesión pasa a ser esa otra, y
   * seguir adelante borraría la que no era. No tiene vuelta atrás.
   */
  ok('se apunta a quién se iba a borrar', /const uidQueSeBorra = auth\.currentUser\?\.uid/.test(pantalla));
  ok('y se comprueba al volver', /auth\.currentUser\?\.uid !== uidQueSeBorra/.test(pantalla));
  // La comprobación tiene que ir ANTES de tocar los datos, no después.
  ok('la comprobación va antes de borrar nada',
    pantalla.indexOf('auth.currentUser?.uid !== uidQueSeBorra') < pantalla.indexOf('eraseMyData('),
    'se comprueba después de haber empezado a borrar');
}

console.log('\nY lo que se le cuenta a la gente es verdad');
{
  // Tres sitios dicen cómo se borra la cuenta: la pantalla de ayuda de la app,
  // la página que miran las tiendas y el diccionario del inglés. Si uno se
  // queda diciendo "con tu contraseña", queda mintiendo.
  for (const [nombre, ruta] of [
    ['la pantalla de ayuda', 'app/delete-account.tsx'],
    ['la página de las tiendas', 'web/eliminar-cuenta.html'],
  ]) {
    const texto = lee(ruta);
    ok(`${nombre} ya no habla de la contraseña`, !/confirmar con tu\s+contraseña/i.test(texto.replace(/\s+/g, ' ')));
    ok(`${nombre} dice con qué se confirma`, /Google o con\s*Apple|Google or Apple/i.test(texto));
  }
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
