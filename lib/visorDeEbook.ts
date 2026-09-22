/**
 * Cómo se lee un e-book dentro de la app.
 *
 * EL PROBLEMA QUE RESUELVE: el documento salía recortado.
 *
 * El visor estaba metido en una caja de 480 px de alto dentro de la página de
 * la clase. El navegador hace lo único que puede hacer con una caja así:
 * encoger la página entera hasta que quepa, y una página A4 encogida a 480 px
 * no se lee — se adivina. Encima, debajo del documento quedaba media pantalla
 * negra vacía. Se estaba desperdiciando la pantalla y cobrando por un e-book
 * ilegible.
 *
 * LA REGLA: un e-book se lee a pantalla completa. No es una tarjeta más de la
 * clase; cuando la clase ES el e-book, el documento es la pantalla.
 *
 * LOS TRES SITIOS DONDE SE PINTA UN PDF NO SON EL MISMO, y por eso esto vive
 * aquí suelto y no dentro de la pantalla:
 *
 *  - Web: un `iframe` con el visor de PDF del navegador.
 *  - iOS: un `WebView`, que enseña PDF de serie.
 *  - Android: un `WebView`, QUE NO ENSEÑA PDF. El WebView de Android nunca ha
 *    traído visor de PDF (lo trae Chrome, que es otra cosa). Un alumno de
 *    Android abriendo un e-book veía un recuadro en blanco. Por eso ahí el
 *    documento va por el visor de Google, que lo pinta como páginas dentro de
 *    la misma pantalla.
 *
 * Aquí no se importa nada para que el guardián pueda ejecutarlo:
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-ebook.mjs
 */

/**
 * El visor de Google, el puente para Android.
 *
 * Le pasas la dirección del PDF y te devuelve una página web con el documento
 * pintado. Quien lo sirve es Google, igual que quien guarda el PDF (Firebase
 * Storage es Google), así que el documento no cambia de manos: sale de un
 * servidor de Google y lo pinta otro servidor de Google.
 */
export const VISOR_DE_GOOGLE = 'https://drive.google.com/viewerng/viewer?embedded=true&url=';

/**
 * Cuánto ocupa la MUESTRA: el e-book de apoyo que cuelga de una clase de vídeo.
 *
 * Esa no va a pantalla completa —debajo siguen el texto de la clase y el botón
 * de marcarla— pero tampoco puede ser la ranura de 480 px de antes. Se le da
 * un buen trozo de la ventana, con suelo y techo: sin suelo, en una ventana
 * bajita se queda en nada; sin techo, en un monitor grande se come la página
 * entera y hay que bajar a ciegas para encontrar el botón.
 *
 * Para LEERLO de verdad está el botón de pantalla completa, que es donde se va
 * a leer. Esto es una portada con la que decidir si te interesa.
 */
export const PARTE_DE_LA_PANTALLA = 0.55;
export const ALTO_MINIMO = 320;
export const ALTO_MAXIMO = 620;

/** Lo que hace falta saber de un contenido para decidir si es un e-book. */
export interface AlgoQueAbrir {
  kind?: 'video' | 'pdf';
  videoUrl?: string;
  pdfUrl?: string;
}

/**
 * ¿Esto es un e-book?
 *
 * La regla estaba copiada en cuatro sitios —la fila de la lista, la miniatura,
 * el reproductor y el recuento de lo visto—, y una regla copiada cuatro veces
 * es una regla que tarde o temprano dice cuatro cosas distintas: la miniatura
 * enseñando un libro y el reproductor abriendo un vídeo vacío.
 *
 * `kind` manda. Y si no está —los cursos de antes de que existiera el campo no
 * lo tienen—, se deduce: sin vídeo y con PDF, es un e-book.
 */
export function esEbook(contenido: AlgoQueAbrir | null | undefined): boolean {
  if (!contenido) return false;
  if (contenido.kind === 'pdf') return true;
  return !contenido.videoUrl && !!contenido.pdfUrl;
}

/**
 * Los enlaces que la gente pega no son el documento, son la página que lo
 * envuelve. Se convierten a su versión embebible o el visor enseña la web de
 * Drive con su barra de compartir en vez del e-book.
 */
export function comoSeEmbebe(url: string): string {
  if (url.includes('drive.google.com')) return url.replace(/\/view.*$/, '/preview');
  if (url.includes('dropbox.com')) return url.replace('?dl=0', '?raw=1');
  return url;
}

/** Drive y Docs ya devuelven una página web con el documento pintado. */
export function esVisorDeGoogle(url: string): boolean {
  return /(?:drive|docs)\.google\.com/.test(url);
}

/**
 * Cómo se encaja la página en la pantalla.
 *
 * `FitH` llena el ANCHO y se baja leyendo. `Fit` mete la página ENTERA.
 *
 * No es una preferencia, es la forma de la ventana. En un móvil de pie la
 * página entera saldría diminuta y con dos franjas negras a los lados: ahí lo
 * que se quiere es que el texto llene el ancho y se baje. En un portátil
 * tumbado pasa lo contrario: la página entera cabe de sobra y se lee de un
 * vistazo, mientras que llenar el ancho de 1.900 px dejaría media línea en
 * pantalla y obligaría a bajar cuatro veces por página.
 */
export function ajusteDeLectura(anchoVentana: number, altoVentana: number): 'Fit' | 'FitH' {
  return anchoVentana >= altoVentana ? 'Fit' : 'FitH';
}

/**
 * La dirección que se le da al visor.
 *
 * Además del ajuste va `toolbar=0`, y eso tiene dos motivos que apuntan al
 * mismo sitio. Para LEER: la barra del navegador se pone encima del documento
 * y se come la primera y la última línea de cada página —era la mitad del
 * recorte que se veía—. Y para PROTEGER: en esa barra están el botón de
 * descargar, el de imprimir y el de "abrir en una pestaña nueva", que es
 * precisamente la puerta por la que se saca de la app un material de pago.
 */
export function enlaceDeLectura(
  url: string | undefined | null,
  plataforma: string,
  anchoVentana: number,
  altoVentana: number
): string {
  const base = comoSeEmbebe((url ?? '').trim());
  if (!base) return '';
  // Ya es una página web con el documento dentro: los parámetros de PDF no
  // pintan nada ahí y el puente de Android sobra.
  if (esVisorDeGoogle(base)) return base;
  // Lo que venga detrás de la almohadilla se tira: dos almohadillas en una
  // dirección no son dos ajustes, son una dirección rota.
  const limpio = base.split('#')[0];
  if (plataforma === 'android') return VISOR_DE_GOOGLE + encodeURIComponent(limpio);
  const ajuste = ajusteDeLectura(anchoVentana, altoVentana);
  return `${limpio}#view=${ajuste}&toolbar=0&navpanes=0&pagemode=none`;
}

/** El alto de la muestra, con suelo y techo (ver PARTE_DE_LA_PANTALLA). */
export function altoDeLaMuestra(altoVentana: number): number {
  const querido = Math.round(Math.max(0, altoVentana) * PARTE_DE_LA_PANTALLA);
  return Math.min(ALTO_MAXIMO, Math.max(ALTO_MINIMO, querido));
}

/** Una dirección sin lo que va detrás de la almohadilla. */
function sinAncla(url: string): string {
  return url.split('#')[0];
}

/**
 * EL E-BOOK NO SALE DE LA APP.
 *
 * Un e-book abierto fuera —en otra ventana, en otra pestaña, en el navegador
 * del teléfono— deja de ser el e-book de la app y pasa a ser un archivo en el
 * navegador de alguien: con su botón de descargar, su botón de compartir y su
 * dirección a la vista para pegársela a quien sea. Todo lo demás que se hace
 * aquí para proteger el material da igual si queda una puerta que lleva fuera.
 *
 * Las puertas son tres, y esta función cierra las tres en el móvil:
 *
 *  1. El botón de "abrir en una ventana" del visor de Google (Android). Quita
 *     el `embedded=true` y sirve el documento en su página de verdad, con
 *     descarga e impresión.
 *  2. Un enlace dentro del propio PDF. Un e-book con enlaces es normal, y
 *     cualquiera de ellos se lleva al alumno a un navegador dentro de la app.
 *  3. Cualquier redirección a un sitio que no es el documento.
 *
 * LA REGLA: solo se carga EL DOCUMENTO. Lo que se pidió, o el visor de Google
 * mientras siga siendo el empotrado. Nada más.
 *
 * Los marcos de dentro no se tocan (`esMarcoDeDentro`): el visor de Google
 * pinta el documento en un marco suyo, y bloquearlo sería dejar la pantalla en
 * blanco en Android — cerrar la puerta tirando la casa.
 */
export function puedeAbrirse(destino: string, documento: string): boolean {
  if (!destino) return false;
  // Lo que se pidió. La almohadilla no cuenta: cambiarla es moverse por el
  // documento, no irse a otro.
  if (sinAncla(destino) === sinAncla(documento)) return true;
  // El visor de Google puede redirigir dentro de su propia casa, y eso sigue
  // siendo nuestro visor MIENTRAS siga empotrado. En cuanto pierde el
  // `embedded=true` es la otra página, la que tiene los botones.
  if (esVisorDeGoogle(documento)) {
    return esVisorDeGoogle(destino) && /[?&]embedded=(?:true|1)\b/.test(destino);
  }
  return false;
}
