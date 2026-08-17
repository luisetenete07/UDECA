#!/usr/bin/env node
/**
 * Entrar con Google en el móvil: que la vuelta del navegador tenga puerta.
 *
 * POR QUÉ EXISTE
 *
 * En el móvil, "Continuar con Google" abría el navegador, Google hacía lo suyo
 * y ahí se quedaba: la pestaña girando, y al volver a la app no había pasado
 * nada. Parecía un fallo de Google o de Firebase. No lo era.
 *
 * `expo-auth-session` le dice a Google a qué dirección tiene que devolver la
 * respuesta, y esa dirección la construye así (providers/Google.js):
 *
 *     `${Application.applicationId}:/oauthredirect`
 *
 * Es decir, `entrenadores.app:/oauthredirect` en Android y
 * `com.udeca.app:/oauthredirect` en iPhone. Para que el sistema sepa que ESA
 * dirección la abre nuestra app, el identificador tiene que estar declarado
 * como esquema en app.json. Solo estaba `udeca`, así que el móvil no tenía a
 * quién dársela: el navegador se quedaba con la respuesta y la app no se
 * enteraba de nada.
 *
 * No se ve en el navegador (ahí Firebase abre su propia ventana y no hace falta
 * ningún esquema) ni en los tipos ni en las comprobaciones normales: es un
 * fichero de configuración contra una librería. Por eso está escrito aquí.
 *
 * Si algún día cambia el identificador de la app en cualquiera de las dos
 * tiendas, hay que añadir el nuevo a `scheme` o el acceso con Google deja de
 * funcionar en esa plataforma, en silencio.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-google.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const hay = (ruta) => existsSync(new URL(`../${ruta}`, import.meta.url));
const app = JSON.parse(lee('app.json')).expo;

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

const esquemas = Array.isArray(app.scheme) ? app.scheme : [app.scheme].filter(Boolean);
const idAndroid = app.android?.package;
const idIOS = app.ios?.bundleIdentifier;

console.log('\nLa vuelta de Google tiene puerta en las dos tiendas');
ok(
  `Android (${idAndroid})`,
  esquemas.includes(idAndroid),
  `expo-auth-session vuelve a ${idAndroid}:/oauthredirect y ese esquema no está en "scheme"`
);
ok(
  `iPhone (${idIOS})`,
  esquemas.includes(idIOS),
  `expo-auth-session vuelve a ${idIOS}:/oauthredirect y ese esquema no está en "scheme"`
);

console.log('\nY el esquema de siempre sigue el primero');
ok(
  'udeca abre la app',
  esquemas[0] === 'udeca',
  'el primero es el que usa expo-router para los enlaces de la propia app'
);

console.log('\nY cuando vuelve, hay una pantalla esperándola');
{
  // Android abre la app con `udeca://oauthredirect?code=...`, y ese enlace lo
  // recibe también expo-router. Sin un fichero con ese nombre, expo-router
  // enseña su "Unmatched Route — Page could not be found": el acceso funciona
  // pero el usuario acaba en un callejón sin salida, en inglés, con el código
  // de Google escrito en pantalla. Pasó de verdad.
  ok(
    'existe app/oauthredirect.tsx',
    hay('app/oauthredirect.tsx'),
    'sin ella, expo-router enseña "Unmatched Route" al volver de Google'
  );
  const pantalla = lee('app/oauthredirect.tsx');
  ok(
    'y manda a la raíz en vez de quedarse',
    /<Redirect href="\/" \/>/.test(pantalla),
    'app/index.tsx es quien sabe repartir según haya sesión o no'
  );
  ok(
    'con margen para el intercambio del código',
    /ESPERA_MAXIMA_MS/.test(pantalla),
    'sin esperar, se devuelve a la pantalla de entrar a quien acaba de entrar bien'
  );
}

console.log('\nEl identificador de cliente de Google, uno por plataforma');
{
  // No son secretos: viajan dentro de la app. Lo que protege la cuenta es el
  // identificador de la app y su firma, declarados junto al cliente en Google
  // Cloud. Aquí solo se comprueba que el despliegue los pasa: sin ellos el
  // botón desaparece y nadie puede entrar.
  const workflows = ['deploy.yml', 'verify.yml']
    .map((f) => lee(`.github/workflows/${f}`))
    .join('\n');
  for (const v of [
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  ]) {
    ok(`${v} va en los workflows`, workflows.includes(v));
  }
  const eas = lee('eas.json');
  for (const v of ['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID']) {
    ok(`${v} va en las builds de tienda`, eas.includes(v));
  }
}

console.log('\nY el icono no se pinta del color del fondo de pantalla');
{
  // La capa monocroma de Android (iconos "temáticos", Android 13+) se rellena
  // ENTERA con el color de acento del sistema. Si el PNG no tiene transparencia,
  // el acento se come el cuadro completo y el icono sale con fondo amarillo, o
  // verde, o del color que tenga puesto cada uno.
  const mono = './assets/android-icon-monochrome.png';
  ok('hay capa monocroma declarada', app.android?.adaptiveIcon?.monochromeImage === mono);
  const png = readFileSync(new URL(`../${mono.slice(2)}`, import.meta.url));
  // Byte 25 del PNG: el tipo de color. 6 = RGBA, 4 = gris con alfa.
  const tipoDeColor = png[25];
  ok(
    'y tiene transparencia (RGBA)',
    tipoDeColor === 6 || tipoDeColor === 4,
    `tipo de color ${tipoDeColor}: sin canal alfa, Android pintaría el cuadro entero`
  );
  ok(
    'el fondo del icono es negro liso, sin segunda copia del logo',
    app.android?.adaptiveIcon?.backgroundColor === '#000000' &&
      !app.android?.adaptiveIcon?.backgroundImage
  );
}

console.log(
  fallos === 0 ? '\n✔ Entrar con Google puede volver a la app' : `\n${fallos} fallo(s)`
);
process.exit(fallos === 0 ? 0 : 1);
