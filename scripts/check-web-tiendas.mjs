/*
 * Las insignias de las tiendas y lo que la web le cuenta a Google.
 *
 * POR QUÉ ESTO EXISTE
 *
 * Son tres cosas que fallan CALLADAS. Ninguna rompe la página, ninguna sale en
 * la consola, y las tres las descubre antes un desconocido que nosotros.
 *
 *  1. LAS INSIGNIAS SON ARCHIVOS. Si alguien mueve o renombra un .svg de
 *     web/assets, la página sigue cargando perfecta y donde había una insignia
 *     queda el hueco del texto alternativo. Y están en la PORTADA: es lo
 *     primero que ve quien llega, justo donde tiene que decidir si esto es una
 *     app de verdad.
 *
 *  2. LAS INSIGNIAS SON DE OTROS. La de Apple y la de Google vienen de sus
 *     dueños y sus guías de marca prohíben retocarlas. Un "ya que estoy" de
 *     recolorearlas para que peguen con el negro de UDECA no lo detecta nadie
 *     mirando, y es incumplir las dos condiciones que hay firmadas por tener la
 *     app publicada. Aquí se comprueba que siguen siendo los archivos que se
 *     bajaron, por tamaño y por lo que llevan dentro.
 *
 *  3. LOS PRECIOS DE LOS DATOS ESTRUCTURADOS NO SE VEN. El bloque JSON-LD de
 *     la cabecera es lo que lee Google para enseñar el precio en el resultado
 *     de búsqueda. No lo pinta nadie en pantalla, así que si se queda con el
 *     precio viejo nadie se entera: la web dirá 17 € y el buscador seguirá
 *     anunciando otra cosa durante meses. Tienen que salir de lib/precios.ts,
 *     como todo lo demás.
 *
 * Y una cuarta, de tamaño: la insignia de Google trae dentro su margen de
 * respeto obligatorio y la de Apple no, así que a la misma altura de CSS la de
 * Google se ve un tercio más pequeña. Está compensado a mano en styles.css;
 * esto vigila que nadie las "cuadre" igualándolas, que es exactamente lo que
 * las descuadra.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-web-tiendas.mjs
 */
import { readFileSync, statSync } from 'node:fs';
import { ATHLETE_FIRST_YEAR_EUR, COACH_FIRST_YEAR_EUR } from '../lib/precios.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const pesa = (f) => {
  try {
    return statSync(new URL(`../${f}`, import.meta.url)).size;
  } catch {
    return 0;
  }
};

const html = lee('web/index.html');
const css = lee('web/styles.css');
const js = lee('web/main.js');
const config = lee('web/config.js');

// =========================================================================
console.log('\n1 · Las insignias existen y se usan');
// =========================================================================
const INSIGNIAS = [
  ['web/assets/badge-app-store.svg', 'App Store'],
  ['web/assets/badge-google-play.svg', 'Google Play'],
];
for (const [ruta, tienda] of INSIGNIAS) {
  ok(`el archivo de ${tienda} está`, pesa(ruta) > 2000, `falta ${ruta} o está vacío`);
  const nombre = ruta.replace('web', '');
  ok(
    `y la página lo pide (${tienda})`,
    html.includes(nombre),
    'si el nombre del archivo y el del src se separan, queda el hueco del alt'
  );
}
/*
 * En la PORTADA y en el CIERRE, como mínimo. Y no es repetirse.
 *
 * Arriba, porque son la prueba más rápida de que esto es una app de verdad y no
 * una página que promete una: quien llega buscando eso lo ve sin bajar.
 *
 * Abajo, porque quien ha leído la página entera ya ha decidido, y obligarle a
 * subir hasta el principio a buscar el botón es la forma más tonta de perder a
 * alguien convencido.
 *
 * Se comprueba por SECCIÓN y no contando apariciones: contar obliga a tocar
 * esta cuenta cada vez que se añade una sección, y una comprobación que hay que
 * ajustar cada dos por tres acaba ajustándose sin mirar qué protegía.
 */
const trozo = (desde, hasta) => {
  const i = html.indexOf(desde);
  if (i < 0) return '';
  const j = hasta ? html.indexOf(hasta, i) : -1;
  return html.slice(i, j < 0 ? html.length : j);
};
const PORTADA = trozo('<section class="hero"', '</section>');
const CIERRE = trozo('<section class="cierre"', '</section>');
const DESCARGAS = trozo('<section id="descargas"', '</section>');

ok('la portada existe', PORTADA.length > 0);
ok('y el cierre también', CIERRE.length > 0);
for (const [ruta, tienda] of INSIGNIAS) {
  const nombre = ruta.replace('web', '');
  ok(`${tienda} está en la portada`, PORTADA.includes(nombre));
  ok(`${tienda} está en el cierre`, CIERRE.includes(nombre));
  ok(`${tienda} está en descargas`, DESCARGAS.includes(nombre));
}

// =========================================================================
console.log('\n2 · Nadie las ha retocado');
// =========================================================================
const apple = lee('web/assets/badge-app-store.svg');
const play = lee('web/assets/badge-google-play.svg');
ok(
  'la de Apple sigue diciendo lo que decía',
  /Download_on_the_App_Store_Badge/.test(apple),
  'el título interno del archivo original ha desaparecido: ya no es el que se bajó'
);
ok(
  'y conserva su caja original',
  /viewBox="0 0 119\.66407 40"/.test(apple),
  'redimensionar la caja deforma la cápsula'
);
ok(
  'la de Google conserva su caja original',
  /viewBox="0 0 155 60"/.test(play),
  'esa caja incluye el margen de respeto que exige su guía de marca'
);
ok(
  'y sus cuatro colores',
  ['#00a0ff', '#ffe000', '#ff3a44', '#32a071'].filter((c) => play.toLowerCase().includes(c)).length >= 3,
  'recolorear el triángulo de Play incumple su guía'
);
// Ninguna de las dos debe traer nada ejecutable: son archivos de fuera.
for (const [nombre, svg] of [['Apple', apple], ['Google', play]]) {
  ok(
    `la de ${nombre} no trae nada ejecutable`,
    !/<script|onload=|onerror=|xlink:href=["']https?:/i.test(svg),
    'un SVG de terceros con script dentro se ejecuta como parte de la página'
  );
}

// =========================================================================
console.log('\n3 · Los tamaños están compensados, no igualados');
// =========================================================================
const alto = (clase) => {
  const m = css.match(new RegExp(`\\.${clase}\\s*\\{[^}]*height:\\s*(\\d+)px`));
  return m ? Number(m[1]) : 0;
};
const altoApple = alto('badge-apple');
const altoPlay = alto('badge-play');
ok('la de Apple tiene altura fija', altoApple > 0);
ok('la de Google también', altoPlay > 0);
/*
 * La cápsula de Google ocupa el 67 % de su caja (medido: 134 px de 200), así
 * que para que las dos se vean iguales la suya tiene que ir ~1,49 veces más
 * alta. Se deja margen porque es un ajuste a ojo sobre una medida, no una
 * fórmula sagrada; lo que no vale es igualarlas.
 */
const razon = altoPlay / (altoApple || 1);
ok(
  'y va más alta para que las cápsulas se vean iguales',
  razon > 1.35 && razon < 1.65,
  `la de Google es ${razon.toFixed(2)}× la de Apple; debería rondar 1,49 (48 → 72)`
);

// =========================================================================
console.log('\n4 · Una tienda sin ficha no enseña insignia');
// =========================================================================
ok(
  'sin enlace configurado, la insignia se quita',
  /classList\.contains\('badge'\)/.test(js) && /el\.remove\(\)/.test(js),
  'una insignia oficial que no lleva a la tienda hace dudar de la página entera'
);
ok(
  'las dos tiendas tienen enlace ahora mismo',
  /appStore:\s*'https:\/\/apps\.apple\.com/.test(config) &&
    /playStore:\s*'https:\/\/play\.google\.com/.test(config),
  'si se vacía uno a propósito, este aviso es el recordatorio de que la web lo esconderá'
);

// =========================================================================
console.log('\n5 · Lo que lee Google dice lo mismo que la página');
// =========================================================================
const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
ok('hay datos estructurados', !!ld);
if (ld) {
  let datos = null;
  try {
    datos = JSON.parse(ld[1]);
  } catch (e) {
    ok('y son JSON válido', false, String(e.message));
  }
  if (datos) {
    ok('y son JSON válido', true);
    ok('declara que es una aplicación', datos['@type'] === 'SoftwareApplication');
    const ofertas = datos.offers || [];
    const precios = ofertas.map((o) => Number(o.price)).sort((a, b) => a - b);
    ok(
      'el primer año del atleta coincide con lib/precios.ts',
      precios.includes(ATHLETE_FIRST_YEAR_EUR),
      `en los datos hay ${precios.join(', ')} y el del atleta es ${ATHLETE_FIRST_YEAR_EUR}`
    );
    ok(
      'el del entrenador también',
      precios.includes(COACH_FIRST_YEAR_EUR),
      `en los datos hay ${precios.join(', ')} y el del entrenador es ${COACH_FIRST_YEAR_EUR}`
    );
    ok(
      'y en euros',
      ofertas.every((o) => o.priceCurrency === 'EUR'),
      'una moneda equivocada se anuncia sola en el buscador'
    );
  }
}

// =========================================================================
console.log('\n6 · Detalles que se pierden solos');
// =========================================================================
ok(
  'un enlace del menú no esconde el titular bajo la cabecera',
  /scroll-margin-top:/.test(css),
  'la cabecera es pegajosa: sin esto, "Planes" deja el título tapado'
);
ok(
  'quien va con el teclado ve por dónde va',
  /:focus-visible/.test(css),
  'sobre negro, el recuadro por defecto del navegador casi no se distingue'
);
ok(
  'la portada no promete una tienda donde no está',
  !/Próximamente/.test(html),
  'quedó escrito a mano en el HTML cuando aún no había ficha publicada'
);

console.log(
  fallos === 0
    ? '\n✔ Las tiendas y los datos de la web están en su sitio'
    : `\n${fallos} fallo(s)`
);
process.exit(fallos === 0 ? 0 : 1);
