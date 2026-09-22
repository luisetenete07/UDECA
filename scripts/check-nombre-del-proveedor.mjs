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
import {
  esCorreoEscondido,
  nombreDeApple,
  nombreDeCorreo,
  nombreParaEmpezar,
  nombreRecordado,
  olvidarNombreDelProveedor,
  recordarNombreDelProveedor,
} from '../lib/nombreDelProveedor.ts';

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

console.log('\nApple solo manda el nombre UNA vez: se guarda al vuelo');
{
  /*
   * LA CARRERA QUE PERDÍA EL NOMBRE, y que costó el segundo rechazo.
   *
   * En cuanto `signInWithCredential` resuelve, Firebase avisa de que hay
   * sesión, el contexto reparte el usuario y la app salta a completar cuenta —
   * todo ANTES de que termine el `updateProfile`. La pantalla leía vacío y su
   * estado inicial no se recalcula nunca.
   *
   * Por eso el nombre se guarda en una caja suelta ANTES de llamar a Firebase.
   */
  olvidarNombreDelProveedor();
  ok('empieza vacío', nombreRecordado() === '');
  recordarNombreDelProveedor('  Luis Tena  ');
  ok('se guarda limpio', nombreRecordado() === 'Luis Tena');
  // Vacío NO pisa lo que ya había: en las entradas siguientes Apple manda
  // vacío, y borrarlo sería tirar el único nombre que llegó a haber.
  recordarNombreDelProveedor('');
  ok('y lo vacío no lo borra', nombreRecordado() === 'Luis Tena');
  olvidarNombreDelProveedor();
  ok('al cerrar sesión se olvida', nombreRecordado() === '');

  const apple = sinComentar(lee('lib/appleAuth.ts'));
  ok('appleAuth lo guarda', /recordarNombreDelProveedor\(nombre\)/.test(apple));
  ok(
    'y ANTES de llamar a Firebase',
    apple.indexOf('recordarNombreDelProveedor(nombre)') <
      apple.indexOf('await signInWithCredential('),
    'vuelve a perder la carrera contra la pantalla'
  );
  ok(
    'y al cerrar sesión se olvida',
    /olvidarNombreDelProveedor\(\)/.test(sinComentar(lee('lib/auth-context.tsx'))),
    'el siguiente en entrar vería el nombre del anterior'
  );
}

console.log('\nY siempre se llega con uno puesto');
{
  ok('manda el guardado', nombreParaEmpezar('Sara Vidal', 'Otro', 'x@y.es') === 'Sara Vidal');
  ok('luego el que acaba de dar el proveedor', nombreParaEmpezar('', 'Luis Tena', 'x@y.es') === 'Luis Tena');
  ok('y si no, el del correo', nombreParaEmpezar('', '', 'luis.tena@gmail.com') === 'Luis Tena');

  ok('el correo se parte por los puntos', nombreDeCorreo('luis.tena@gmail.com') === 'Luis Tena');
  ok('y por guiones y barras bajas', nombreDeCorreo('ana_gil-ruiz@x.es') === 'Ana Gil Ruiz');
  // La etiqueta del correo no es parte del nombre de nadie.
  ok('sin la etiqueta de detrás del +', nombreDeCorreo('udeca.app+coach@gmail.com') === 'Udeca App');
  /*
   * DEL CORREO ESCONDIDO DE APPLE NO SALE NADA. Son letras y números al azar:
   * poner "X7k2m9" de nombre es peor que no poner ninguno, y ahí es donde la
   * pantalla enseña el campo — opcional.
   */
  ok('el correo escondido se reconoce', esCorreoEscondido('x7k2m9@privaterelay.appleid.com'));
  ok('y de él no sale nombre', nombreDeCorreo('x7k2m9@privaterelay.appleid.com') === '');
  ok('sin correo, vacío', nombreParaEmpezar('', '', '') === '');
  ok('y con nulos, vacío', nombreParaEmpezar(null, '', null) === '');
}

console.log('\nLa pantalla NO pide el nombre');
{
  const pantalla = sinComentar(lee('app/(auth)/completar.tsx'));
  ok(
    'llega con uno puesto',
    /const nombreDePartida = nombreParaEmpezar\(/.test(pantalla)
  );
  /*
   * LO MÁS IMPORTANTE DE TODO EL FICHERO. Dos rechazos de Apple han salido de
   * aquí. El campo NO sale por defecto: se enseña el nombre con un enlace para
   * cambiarlo, y solo aparece el campo si no ha habido forma de sacar ninguno.
   */
  ok(
    'el campo no sale por defecto',
    /const \[editandoNombre, setEditandoNombre\] = useState\(false\)/.test(pantalla),
    'vuelve a salir el campo del nombre nada más entrar con Apple'
  );
  ok(
    'y solo si no hay ningún nombre',
    /\{editandoNombre \|\| !nombreDePartida \?/.test(pantalla)
  );
  ok('marcado como opcional', /Tu nombre \(opcional\)/.test(pantalla));
  // Apple deja cambiar el nombre en su ventana; quien quiera otro tiene que
  // poder escribirlo sin salir y volver a entrar.
  ok('con una salida para cambiarlo', /setEditandoNombre\(true\)/.test(pantalla));
  ok('que se puede pulsar', /Cambiar</.test(pantalla));

  /*
   * Y GUARDAR NO LO COMPRUEBA. Esta era la cara visible de la norma 4: quien
   * entraba con Apple sin que Apple mandara nombre no podía pasar de aquí.
   */
  ok(
    'guardar no exige nombre',
    !/if \(!name\.trim\(\)\)/.test(pantalla),
    'vuelve a haber un nombre obligatorio: es el rechazo de la norma 4'
  );
  ok('y no queda el aviso de ponerlo', !/Pon tu nombre/.test(pantalla));
  // El código del entrenador SÍ se sigue exigiendo, y no es lo mismo: eso
  // Apple no lo da ni lo puede dar.
  ok('pero el código del entrenador sí', /if \(role === 'client' && !codigo\.trim\(\)\)/.test(pantalla));

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
