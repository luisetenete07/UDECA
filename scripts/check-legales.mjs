/**
 * Las dos páginas que las tiendas comprueban solas.
 *
 * Google Play rechazó el envío por esto, y merece la pena entender por qué antes
 * de tocarlo:
 *
 *     "La página de la política de privacidad devuelve un error de página no
 *      encontrada."
 *     "La página de eliminación de cuenta devuelve un error de página no
 *      encontrada."
 *
 * Las dos direcciones apuntaban a pantallas DE LA APP (app.udeca.app/...). Una
 * pantalla de la app necesita que arranque un bundle de React para enseñar la
 * primera letra, y quien abre esa URL no es una persona: es un revisor
 * automático que pide el HTML, no ejecuta JavaScript y no tiene sesión. Lo que
 * le llega no es la política, es una página vacía.
 *
 * Así que las dos viven ahora en la web pública, en HTML plano, y estas
 * comprobaciones cuidan de que sigan cumpliendo las tres condiciones que ponen
 * las tiendas:
 *
 *   1. Que existan y digan lo que tienen que decir.
 *   2. Que se lean SIN JavaScript (el texto va en el fichero, no lo pinta un
 *      script).
 *   3. Que la de borrar la cuenta ofrezca una vía para quien YA NO tiene la app
 *      instalada. Un botón dentro de la app no vale por sí solo: quien la
 *      desinstaló no puede pulsarlo.
 *
 * Y que las direcciones no se rompan por el camino: los alias declarados en
 * web/vercel.json tienen que llevar a una página que exista.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-legales.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const hay = (ruta) => existsSync(new URL(`../${ruta}`, import.meta.url));

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

const CORREO = 'luistenaf@gmail.com';

console.log('\nLas dos páginas existen en la web pública');
ok('web/privacidad.html', hay('web/privacidad.html'));
ok('web/eliminar-cuenta.html', hay('web/eliminar-cuenta.html'));
if (fallos > 0) {
  console.log('\nSin las páginas no hay nada más que comprobar.');
  process.exit(1);
}

const privacidad = lee('web/privacidad.html');
const borrado = lee('web/eliminar-cuenta.html');

console.log('\nSe leen sin JavaScript y sin pedir nada al exterior');
for (const [nombre, pagina] of [
  ['privacidad', privacidad],
  ['eliminar-cuenta', borrado],
]) {
  // El único <script> tolerable sería uno decorativo; el texto legal NO puede
  // depender de que se ejecute nada.
  ok(`${nombre}: no monta el texto con un script`, !/<script[\s>]/i.test(pagina));
  ok(`${nombre}: el texto va en el fichero`, pagina.length > 3000, `${pagina.length} caracteres`);
  // Y no puede depender de NINGÚN otro fichero: se publica en dos sitios
  // distintos (GitHub Pages y Vercel) y un /styles.css que exista en uno y no
  // en el otro deja la página como un documento en blanco y negro sin formato
  // justo en el sitio donde la mira la tienda.
  ok(`${nombre}: no carga hojas de estilo de fuera`, !/<link[^>]+stylesheet/i.test(pagina));
  ok(`${nombre}: no carga fuentes de fuera`, !/fonts\.(googleapis|gstatic)\.com/i.test(pagina));
  ok(`${nombre}: no carga imágenes`, !/<img[\s>]/i.test(pagina));
  ok(`${nombre}: lleva su propio estilo dentro`, /<style[\s>]/i.test(pagina));
}

console.log('\nLa política dice lo que tiene que decir');
for (const trozo of [
  'Política de privacidad',
  'Datos que recogemos',
  'Stripe',
  'Firebase',
  'Conservación',
  'Tus derechos',
  CORREO,
]) {
  ok(`habla de "${trozo}"`, privacidad.includes(trozo));
}
ok('y también en inglés', privacidad.includes('UDECA privacy policy'));

console.log('\nY la de borrar la cuenta, también');
ok('explica cómo se hace desde la app', /Perfil → Eliminar mi cuenta/.test(borrado));
ok('dice qué se elimina', borrado.includes('Qué se elimina'));
ok('y qué se conserva', borrado.includes('Qué se conserva'));
ok('y también en inglés', borrado.includes('Delete your UDECA account'));

console.log('\nLo que exige la tienda: se puede pedir SIN tener la app');
ok(
  'hay un correo al que escribir',
  borrado.includes(`mailto:${CORREO}`),
  'quien desinstaló la app no puede pulsar un botón que está dentro de ella'
);
ok('con un plazo escrito', /30 días/.test(borrado));

console.log('\nLas direcciones no se rompen');
{
  const vercel = JSON.parse(lee('web/vercel.json'));
  const paginas = new Set(['/privacidad', '/eliminar-cuenta']);
  for (const r of vercel.redirects ?? []) {
    ok(`${r.source} lleva a una página que existe`, paginas.has(r.destination), r.destination);
  }
  // Las rutas que la app tenía publicadas antes: si alguien (o una tienda) las
  // guardó, tienen que seguir llevando a alguna parte.
  for (const antigua of ['/privacy-policy', '/delete-account']) {
    ok(
      `${antigua} sigue teniendo salida`,
      (vercel.redirects ?? []).some((r) => r.source === antigua)
    );
  }
  ok('las URLs limpias siguen activadas', vercel.cleanUrls === true, 'sin esto /privacidad daría 404');
}

console.log('\nSe publican solas, sin que nadie tenga que acordarse');
{
  const deploy = lee('.github/workflows/deploy.yml');
  ok(
    'el despliegue de la app las copia',
    /for pagina in privacidad eliminar-cuenta/.test(deploy),
    'es el único despliegue automático que hay; Vercel se lanza a mano'
  );
  ok(
    'y ya no se salta los cambios de web/',
    !/^\s*-\s*'web\/\*\*'/m.test(deploy),
    'si los ignora, se publica la política vieja'
  );
}

console.log('\nY la web enlaza a las suyas, no a las de la app');
{
  const inicio = lee('web/index.html');
  ok('el pie enlaza a /privacidad', inicio.includes('href="/privacidad"'));
  ok('el pie enlaza a /eliminar-cuenta', inicio.includes('href="/eliminar-cuenta"'));
  ok(
    'y ya no manda a app.udeca.app a leer la política',
    !inicio.includes('app.udeca.app/privacy-policy')
  );
}

console.log('\nLas pantallas de dentro de la app siguen ahí');
ok('app/privacy-policy.tsx', hay('app/privacy-policy.tsx'), 'la enlaza la propia app');
ok('app/delete-account.tsx', hay('app/delete-account.tsx'));

console.log(
  fallos === 0
    ? '\n✔ Las dos páginas legales se abren sin la app y sin JavaScript'
    : `\n${fallos} fallo(s)`
);
process.exit(fallos === 0 ? 0 : 1);
