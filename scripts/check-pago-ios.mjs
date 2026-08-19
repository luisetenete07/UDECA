/*
 * En iPhone no se ofrece pagar. Que siga siendo verdad.
 *
 * POR QUÉ EXISTE
 *
 * La norma 3.1.1 de la App Store prohíbe los botones y enlaces que lleven a
 * pagar contenido digital fuera de las compras integradas de Apple. Es el
 * motivo de rechazo más común que hay, y se descubre DESPUÉS de esperar la
 * revisión: un envío perdido por una línea.
 *
 * Toda la decisión vive en `CAN_LINK_TO_PAYMENT` (lib/subscription.ts), que en
 * iOS vale `false`. El peligro no es que alguien cambie esa línea a propósito
 * —eso está documentado y es una decisión—, sino que se añada una pantalla
 * NUEVA que ofrezca pagar y se olvide de mirar la constante. Esa pantalla se
 * vería perfecta en el navegador y en Android, y solo aparecería en el iPhone
 * del revisor de Apple.
 *
 * Esto comprueba dos cosas:
 *
 *   1. Que la constante sigue apagada en iOS.
 *   2. Que todo el que sepa construir una URL de pago de UDECA la mire antes.
 *
 * Lo que un ALUMNO le paga a su ENTRENADOR queda fuera a propósito: es un
 * servicio real entre dos personas, no contenido digital, y Apple lo excluye
 * expresamente de las compras integradas. Por eso `lib/enlaceDePago.ts` no
 * entra aquí.
 *
 *   node scripts/check-pago-ios.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const CARPETAS = ['app', 'components'];

/** Las funciones que devuelven una URL para pagarle a UDECA. */
const CONSTRUCTORES = ['subscriptionCheckoutUrl', 'entryCheckoutUrl'];
const GUARDA = 'CAN_LINK_TO_PAYMENT';

let fallos = 0;
const ok = (n, c, d = '') => {
  if (!c) fallos++;
  console.log(`${c ? '  OK  ' : '  FALLO'} ${n}${d ? ' -- ' + d : ''}`);
};

/**
 * El código sin sus comentarios.
 *
 * Hace falta, y no es cosmética: este fichero busca nombres, y los nombres que
 * importan aparecen también en los comentarios que los explican. Sin quitarlos,
 * una pantalla a la que se le hubiera borrado la comprobación seguía pareciendo
 * correcta solo porque un comentario nombraba la constante. Se comprobó, y así
 * pasaba: el guardián decía que todo estaba bien con la guarda ya quitada.
 *
 * El `[^:]` de delante de las barras es para no cortar las URLs por la mitad
 * (`https://...`), que no son comentarios.
 */
function sinComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function ficheros(dir, salida = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) ficheros(p, salida);
    else if (/\.tsx?$/.test(p)) salida.push(p);
  }
  return salida;
}

// --- 1. La constante sigue apagada en iOS ---------------------------------
console.log('== La decisión, en su única línea ==');
const fuente = readFileSync(join(RAIZ, 'lib/subscription.ts'), 'utf8');
const linea = /export const CAN_LINK_TO_PAYMENT\s*=\s*([^;]+);/.exec(fuente);
ok('CAN_LINK_TO_PAYMENT está definida', !!linea);
if (linea) {
  const valor = linea[1].trim();
  ok(
    'y en iOS vale false',
    /Platform\.OS\s*!==\s*'ios'/.test(valor),
    valor
  );
  if (valor === 'true') {
    console.log('         Con `true`, el iPhone vuelve a enseñar botones de pago');
    console.log('         a la web. Si es lo que se quiere, es una decisión: cámbialo');
    console.log('         aquí y en el comentario de lib/subscription.ts, que explica');
    console.log('         lo contrario.');
  }
}

// --- 2. Nadie construye una URL de pago sin mirar la guarda ---------------
console.log('\n== Quien sabe construir una URL de pago, la mira antes ==');
const sinGuarda = [];
let revisados = 0;
for (const carpeta of CARPETAS) {
  for (const f of ficheros(join(RAIZ, carpeta))) {
    const src = sinComentarios(readFileSync(f, 'utf8'));
    if (!CONSTRUCTORES.some((c) => src.includes(c))) continue;
    revisados++;
    if (!src.includes(GUARDA)) sinGuarda.push(relative(RAIZ, f));
  }
}
ok(
  `las ${revisados} pantallas que pueden llevar a pagar miran ${GUARDA}`,
  sinGuarda.length === 0,
  sinGuarda.join(', ')
);
if (sinGuarda.length) {
  console.log('\n         Estas pantallas saben construir una URL de pago de UDECA y no');
  console.log('         comprueban si esta plataforma puede ofrecerla. En el iPhone del');
  console.log('         revisor de Apple saldría el botón, y eso es rechazo por 3.1.1.');
  console.log(`         Envuélvelo: const url = ${GUARDA} ? ...checkoutUrl(profile) : null;`);
}

console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
