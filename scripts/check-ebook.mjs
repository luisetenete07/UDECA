/*
 * Los e-books se leen a pantalla completa.
 *
 * DE DÓNDE VIENE ESTO: el e-book salía RECORTADO. Estaba metido en una caja de
 * 480 px dentro de la página de la clase, el navegador encogía la página entera
 * hasta que cabía, y debajo quedaba media pantalla negra sin usar. Se estaba
 * cobrando por un material que no se podía leer.
 *
 * Lo que se vigila aquí son las tres cosas que, si se rompen, no dan error:
 *
 *  1. QUE EL DOCUMENTO NO VUELVA A UNA CAJA. En cuanto la clase que es un
 *     e-book vuelva a caer dentro del `ScrollView` del texto, vuelve el
 *     recorte. Compila igual y se ve igual de mal.
 *  2. QUE ANDROID SIGA TENIENDO SU PUENTE. El WebView de Android no sabe
 *     pintar un PDF —nunca ha traído visor— y sin el puente el alumno ve un
 *     recuadro en blanco. No hay error, no hay aviso: no hay nada.
 *  3. QUE LA REGLA DE "ESTO ES UN E-BOOK" SIGA SIENDO UNA. Estaba copiada en
 *     cuatro sitios; cuatro copias acaban diciendo cuatro cosas, y entonces la
 *     miniatura enseña un libro y el reproductor abre un vídeo vacío.
 *
 * La lógica vive suelta en lib/visorDeEbook.ts. La pantalla se lee como texto:
 * arrastra React Native.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-ebook.mjs
 */
import { readFileSync } from 'node:fs';
import {
  ALTO_MAXIMO,
  ALTO_MINIMO,
  VISOR_DE_GOOGLE,
  ajusteDeLectura,
  altoDeLaMuestra,
  comoSeEmbebe,
  enlaceDeLectura,
  esEbook,
  puedeAbrirse,
} from '../lib/visorDeEbook.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');
const sinComentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\nQué es un e-book y qué no');
{
  ok('lo que lo dice a las claras', esEbook({ kind: 'pdf', pdfUrl: 'x.pdf' }));
  // Los cursos de antes de que existiera `kind` no lo llevan: sin vídeo y con
  // PDF es un e-book, y hay cursos publicados así.
  ok('y lo que se deduce', esEbook({ pdfUrl: 'x.pdf' }));
  ok('un vídeo no lo es', !esEbook({ videoUrl: 'v' }));
  // LO IMPORTANTE de este caso: una clase de vídeo CON e-book de apoyo sigue
  // siendo una clase de vídeo. Si contara como e-book, el alumno abriría el
  // PDF y no vería nunca el vídeo que venía a ver.
  ok('ni un vídeo con e-book de apoyo', !esEbook({ videoUrl: 'v', pdfUrl: 'x.pdf' }));
  ok('lo vacío no lo es', !esEbook({}) && !esEbook(null) && !esEbook(undefined));
}

console.log('\nLos enlaces que se pegan se convierten');
{
  ok(
    'Drive, a su versión embebible',
    comoSeEmbebe('https://drive.google.com/file/d/AB1/view?usp=sharing') ===
      'https://drive.google.com/file/d/AB1/preview'
  );
  ok('Dropbox, a la directa', comoSeEmbebe('https://www.dropbox.com/s/x/a.pdf?dl=0').endsWith('?raw=1'));
  ok('y lo demás se queda igual', comoSeEmbebe('https://x.com/a.pdf') === 'https://x.com/a.pdf');
}

console.log('\nCómo se encaja la página');
{
  // No es gusto, es la forma de la ventana: ver lib/visorDeEbook.ts.
  ok('móvil de pie: llena el ancho', ajusteDeLectura(390, 844) === 'FitH');
  ok('portátil: la página entera', ajusteDeLectura(1440, 900) === 'Fit');
  ok('tablet de pie: llena el ancho', ajusteDeLectura(834, 1112) === 'FitH');
}

console.log('\nLa dirección que se le da al visor');
{
  const enMovil = enlaceDeLectura('https://x.com/a.pdf', 'ios', 390, 844);
  /*
   * `toolbar=0` NO es estética. La barra del navegador se pone ENCIMA del
   * documento y se come la primera y la última línea de cada página —era la
   * mitad del recorte que se veía—, y además lleva el botón de descargar, el
   * de imprimir y el de abrir en una pestaña nueva: la puerta por la que se
   * saca de la app un material de pago.
   */
  ok('sin la barra del navegador', /toolbar=0/.test(enMovil), enMovil);
  ok('y con el ajuste puesto', /#view=FitH/.test(enMovil), enMovil);
  ok('en un portátil, la página entera', /#view=Fit&/.test(enlaceDeLectura('https://x.com/a.pdf', 'web', 1440, 900)));

  // Dos almohadillas en una dirección no son dos ajustes: es una dirección
  // rota, y el visor abre por donde le parece.
  const conAncla = enlaceDeLectura('https://x.com/a.pdf#page=4', 'web', 1440, 900);
  ok('una sola almohadilla', (conAncla.match(/#/g) || []).length === 1, conAncla);

  /*
   * ANDROID. Su WebView no trae visor de PDF (lo trae Chrome, que es otra
   * cosa): sin el puente, el alumno abre el e-book y ve un recuadro en blanco.
   * Ni error ni aviso.
   */
  const enAndroid = enlaceDeLectura('https://x.com/a.pdf', 'android', 390, 844);
  ok('Android va por el visor de Google', enAndroid.startsWith(VISOR_DE_GOOGLE), enAndroid);
  ok('con la dirección bien escapada', enAndroid.includes(encodeURIComponent('https://x.com/a.pdf')));

  // Drive ya devuelve una página web con el documento pintado: ni parámetros
  // de PDF ni puente. Meterle el puente sería pedirle a Google que abra una
  // página de Google como si fuera un PDF.
  const drive = enlaceDeLectura('https://drive.google.com/file/d/AB1/view', 'android', 390, 844);
  ok('Drive se deja en paz', drive === 'https://drive.google.com/file/d/AB1/preview', drive);

  ok('sin enlace, nada', enlaceDeLectura('', 'web', 1440, 900) === '');
  ok('y con espacios, tampoco revienta', enlaceDeLectura('  ', 'web', 1440, 900) === '');
}

console.log('\nEl e-book no sale de la app');
{
  /*
   * POR QUÉ IMPORTA: un e-book abierto fuera —otra ventana, otra pestaña, el
   * navegador del teléfono— deja de ser el e-book de la app y pasa a ser un
   * archivo en el navegador de alguien, con su botón de descargar, su botón de
   * compartir y su dirección a la vista para pegársela a quien sea. Todo lo
   * demás que se hace para proteger el material da igual si queda una puerta.
   */
  const doc = 'https://f.example/a.pdf#view=Fit&toolbar=0';
  ok('el documento se carga', puedeAbrirse('https://f.example/a.pdf', doc));
  // Moverse por el documento no es irse a otro.
  ok('y moverse por él también', puedeAbrirse('https://f.example/a.pdf#page=7', doc));
  ok('otro documento no', !puedeAbrirse('https://f.example/otro.pdf', doc));
  // Un e-book con enlaces dentro es de lo más normal, y cualquiera de ellos se
  // lleva al alumno a un navegador dentro de la app.
  ok('un enlace de dentro del PDF, no', !puedeAbrirse('https://otra.cosa/x', doc));
  ok('ni nada vacío', !puedeAbrirse('', doc));

  /*
   * EL BOTÓN DE "ABRIR EN UNA VENTANA" DEL VISOR DE GOOGLE (Android). Es la
   * puerta de verdad: quita el `embedded=true` y sirve el documento en su
   * página completa, con descarga e impresión.
   */
  const puente = VISOR_DE_GOOGLE + encodeURIComponent('https://f.example/a.pdf');
  ok('el visor empotrado se carga', puedeAbrirse(puente, puente));
  ok(
    'y una redirección suya, si sigue empotrada',
    puedeAbrirse('https://docs.google.com/viewer?embedded=true&url=x', puente)
  );
  ok(
    'pero el botón de abrir en una ventana, NO',
    !puedeAbrirse('https://drive.google.com/viewerng/viewer?url=x', puente),
    'se puede sacar el e-book de la app por ahí'
  );
  ok('ni irse a otro sitio', !puedeAbrirse('https://cualquier.cosa/x', puente));
}

console.log('\nLa muestra tiene suelo y techo');
{
  // Sin suelo, en una ventana bajita se queda en nada. Sin techo, en un
  // monitor grande se come la página y hay que bajar a ciegas al botón.
  for (const [nombre, alto] of [
    ['móvil', 844],
    ['ventana bajita', 400],
    ['monitor grande', 1440],
  ]) {
    const a = altoDeLaMuestra(alto);
    ok(`${nombre} (${alto})`, a >= ALTO_MINIMO && a <= ALTO_MAXIMO, String(a));
  }
  ok('y con cero no sale negativo', altoDeLaMuestra(0) === ALTO_MINIMO);
}

console.log('\nEn la pantalla: el documento ES la pantalla');
{
  const curso = sinComentar(lee('app/(client)/courses/[id].tsx'));

  /*
   * LO QUE SE PROTEGE AQUÍ. El e-book tiene que quedar FUERA del `ScrollView`
   * del texto de la clase. Dentro vuelve a ser una caja con alto propio dentro
   * de algo que se desplaza, y con eso vuelve el recorte: el navegador encoge
   * la página entera hasta que cabe en la ranura.
   */
  const dondeEmpiezaElEbook = curso.indexOf('{esPdf ? (');
  const dondeEmpiezaElScroll = curso.indexOf('<ScrollView');
  ok('hay rama propia para el e-book', dondeEmpiezaElEbook > 0);
  ok(
    'y va ANTES del ScrollView, no dentro',
    dondeEmpiezaElEbook > 0 && dondeEmpiezaElEbook < dondeEmpiezaElScroll,
    'el e-book ha vuelto dentro de la página que se desplaza'
  );
  ok('el documento va lleno', /<EmbeddedDoc url=\{contenido\.pdfUrl\} lleno \/>/.test(curso));
  ok('y lleno es flex: 1', /pdfLleno: \{ flex: 1/.test(curso));

  // El alto de 480 px a fuego era el problema. Que no vuelva por ningún lado.
  ok('sin altos a fuego', !/height: 480/.test(curso), 'ha vuelto la caja de 480 px');

  // El e-book de apoyo de una clase de vídeo también se lee entero: en la
  // página es una portada, y para leerlo está el botón.
  ok('el e-book de apoyo se puede abrir entero', /<BotonLeerEntero/.test(curso));
  ok('y tiene su lector', /<LectorAPantallaCompleta/.test(curso));
  /*
   * Y el botón, ENCIMA de la muestra. Debajo hay que cruzar el documento para
   * llegar a él, y un dedo que cruza un documento que se desplaza se queda
   * dentro: quien quería abrirlo entero pasa páginas de la muestra sin querer.
   */
  ok(
    'y el botón va antes que la muestra',
    curso.indexOf('<BotonLeerEntero') < curso.indexOf('<EmbeddedDoc url={contenido.pdfUrl} />'),
    'el botón ha vuelto debajo del documento'
  );

  // La dirección la compone el módulo. Si la pantalla se la vuelve a inventar,
  // Android se queda sin puente sin que nadie lo note.
  ok(
    'la dirección la pone el módulo',
    /enlaceDeLectura\(url, Platform\.OS, width, height\)/.test(curso)
  );

  /*
   * Y LAS PUERTAS, CERRADAS. Ninguna de estas da error al soltarse: el e-book
   * se sigue viendo igual, solo que además se puede sacar de la app.
   */
  ok(
    'solo se carga el documento',
    /onShouldStartLoadWithRequest=\{\(r[^)]*\) =>[\s\S]{0,140}puedeAbrirse\(r\.url, src\)/.test(curso),
    'el visor vuelve a poder navegar a donde sea'
  );
  // Los marcos de dentro pasan: el visor de Google pinta el documento en un
  // marco suyo, y cortarlo dejaría Android en blanco.
  ok('sin cortar los marcos de dentro', /r\.isTopFrame === false \? true/.test(curso));
  ok('no se abre ninguna ventana', /onOpenWindow=\{\(\) => \{\}\}/.test(curso));
  ok('ni por varias ventanas', /setSupportMultipleWindows=\{false\}/.test(curso));
  ok('ni desde el JavaScript de la página', /javaScriptCanOpenWindowsAutomatically=\{false\}/.test(curso));
}

console.log('\nY la regla de "esto es un e-book" sigue siendo una');
{
  /*
   * Estaba copiada en cuatro sitios: la fila de la lista, la miniatura, el
   * reproductor y el recuento de lo visto. Cuatro copias de una regla acaban
   * diciendo cuatro cosas distintas — la miniatura enseñando un libro y el
   * reproductor abriendo un vídeo vacío—, y eso no da ningún error.
   */
  for (const ruta of [
    'app/(client)/courses/[id].tsx',
    'components/MiniaturaCurso.tsx',
    'lib/courseProgress.ts',
  ]) {
    const f = sinComentar(lee(ruta));
    ok(`${ruta} usa esEbook`, /esEbook\(/.test(f));
    ok(`${ruta} no la repite`, !/kind === 'pdf'/.test(f), 'vuelve a llevar la regla copiada');
  }
  // Y que se pueda seguir ejecutando desde aquí: en cuanto el módulo importe
  // React Native, todas las pruebas de arriba dejan de correr.
  ok('el módulo vive suelto', !/^import /m.test(lee('lib/visorDeEbook.ts')));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
