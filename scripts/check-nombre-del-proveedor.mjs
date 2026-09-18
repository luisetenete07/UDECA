/*
 * El nombre que da el proveedor NO se vuelve a pedir.
 *
 * ES LA NORMA 4 DE APPLE, y ya costó un rechazo. El 17 de septiembre, sobre la
 * 1.1.2: "users are required to provide their name and/or email address after
 * using Sign in with Apple even though that information is already provided by
 * the Authentication Services framework".
 *
 * LA CADENA ENTERA, que es lo que hay que vigilar, tiene tres eslabones y
 * ninguno protesta al soltarse:
 *
 *  1. Apple manda el nombre en el PRIMER inicio de sesión y nunca más, y NO va
 *     dentro del identity token. Si no se guarda en ese instante, se pierde
 *     para siempre.
 *  2. Firebase no lo ve, así que hay que escribirlo a mano con `updateProfile`.
 *  3. Y la pantalla de completar cuenta tiene que dejar de pedirlo cuando ya
 *     está.
 *
 * Así estaba antes: `nombreDeApple` escrita, exportada y SIN USAR por nadie. El
 * nombre se tiraba y la pantalla lo pedía por escrito. Todo compilaba, ningún
 * guardián se quejaba y la app funcionaba — solo que Apple no la publica.
 *
 * Se lee como texto: los dos ficheros arrastran Firebase y React Native.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-nombre-del-proveedor.mjs
 */
import { readFileSync } from 'node:fs';
import { nombreDeApple } from '../lib/nombreDelProveedor.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');
const sinComentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\nEl nombre de Apple se compone bien');
{
  ok('nombre y apellido', nombreDeApple({ givenName: 'Luis', familyName: 'Tena' }) === 'Luis Tena');
  // Apple deja dar solo uno de los dos, y también ninguno.
  ok('solo el nombre', nombreDeApple({ givenName: 'Luis' }) === 'Luis');
  ok('solo el apellido', nombreDeApple({ familyName: 'Tena' }) === 'Tena');
  ok('sin nada, vacío', nombreDeApple(null) === '');
  ok('y con nulos dentro, vacío', nombreDeApple({ givenName: null, familyName: null }) === '');
}

console.log('\nY se guarda en el instante en que llega');
{
  const apple = sinComentar(lee('lib/appleAuth.ts'));
  // ESTO es lo que faltaba: la función existía y no la llamaba nadie.
  ok('se llama a nombreDeApple', /const nombre = nombreDeApple\(credencial\.fullName\)/.test(apple));
  // Y que siga pudiendo ejecutarse desde aquí: en cuanto vuelva a un fichero
  // que importe React Native, las cinco pruebas de arriba dejan de correr.
  ok(
    'la función vive suelta y sin imports',
    !/^import /m.test(lee('lib/nombreDelProveedor.ts'))
  );
  ok(
    'y appleAuth la sigue ofreciendo',
    /export \{ nombreDeApple \} from '\.\/nombreDelProveedor'/.test(lee('lib/appleAuth.ts'))
  );
  ok(
    'y se escribe en la cuenta de Firebase',
    /updateProfile\(sesion\.user, \{ displayName: nombre \}\)/.test(apple)
  );
  /*
   * Solo si no había uno. En las entradas siguientes Apple no manda nombre, y
   * escribir vacío encima borraría el que se guardó la primera vez — que es la
   * única que lo dio.
   */
  ok(
    'sin pisar el que ya hubiera',
    /if \(nombre && !sesion\.user\.displayName\)/.test(apple)
  );
  // Y que no tumbe la entrada: quedarse sin nombre es un incordio, quedarse
  // sin entrar por no poder escribirlo, no.
  ok('y sin romper la entrada si falla', /updateProfile\([^)]*\)[\s\S]{0,40}\.catch\(/.test(apple));
}

console.log('\nLa pantalla deja de pedirlo cuando ya lo tiene');
{
  const pantalla = sinComentar(lee('app/(auth)/completar.tsx'));
  ok(
    'mira si el proveedor dio nombre',
    /const nombreDelProveedor = \(firebaseUser\?\.displayName \?\? ''\)\.trim\(\)/.test(pantalla)
  );
  // LO IMPORTANTE. Con nombre, el campo NO sale: un campo obligatorio relleno
  // con lo que acabas de dar sigue siendo pedirlo.
  ok(
    'y solo enseña el campo si no lo dio',
    /useState\(!nombreDelProveedor\)/.test(pantalla)
  );
  ok('con una salida para cambiarlo', /setEditandoNombre\(true\)/.test(pantalla));
  // Apple deja ocultar el nombre real; quien lo haga tiene que poder escribir
  // el suyo sin salir y volver a entrar.
  ok('que se puede pulsar', /Cambiar</.test(pantalla));

  // Y que el texto no diga "Google" a fuego: a esta pantalla se llega por los
  // dos, y decir el que no es hace dudar de si la cuenta es la correcta.
  ok(
    'sin dar por hecho de qué proveedor viene',
    !/tu cuenta de Google/.test(pantalla),
    'sigue diciendo Google a alguien que entró con Apple'
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
