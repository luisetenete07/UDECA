/*
 * Actualizar es obligatorio (lib/version.ts).
 *
 * POR QUÉ ESTE GUARDIÁN EXISTE
 *
 * Un muro que tapa la app entera es de las poquísimas cosas que pueden dejar
 * fuera a TODOS los usuarios a la vez. Si la comparación de versiones se
 * equivoca, o si un fallo de red se confunde con "tu versión ya no vale", el
 * daño no es una pantalla fea: es que nadie puede entrenar.
 *
 * Por eso la regla de esta función es una sola y no se negocia: ANTE CUALQUIER
 * DUDA, NO SE BLOQUEA. Documento que falta, red caída, un campo vacío, un texto
 * que no es una versión — todo eso deja pasar.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-actualizar.mjs
 */
import { readFileSync } from 'node:fs';
import { comparaVersiones, esVersion, tocaActualizar } from '../lib/version.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

console.log('\nComparar dos versiones');
{
  ok('la 1.0.0 es anterior a la 1.0.1', comparaVersiones('1.0.0', '1.0.1') < 0);
  ok('la 1.2.0 es posterior a la 1.1.9', comparaVersiones('1.2.0', '1.1.9') > 0);
  ok('la misma es la misma', comparaVersiones('2.3.4', '2.3.4') === 0);
  // "1.2" y "1.2.0" son la misma: lo que falta cuenta como cero.
  ok('lo que falta cuenta como cero', comparaVersiones('1.2', '1.2.0') === 0);
  // Y no se comparan como texto: "10" es mayor que "9", aunque alfabéticamente
  // vaya antes. Es el fallo clásico de esto.
  ok('la 1.10.0 es posterior a la 1.9.0', comparaVersiones('1.10.0', '1.9.0') > 0);
  ok('y la 2.0.0 a la 1.99.99', comparaVersiones('2.0.0', '1.99.99') > 0);
}

console.log('\nQué se acepta como versión');
{
  ok('1.0.0 sí', esVersion('1.0.0'));
  ok('1.2 también', esVersion('1.2'));
  ok('con espacios alrededor, también', esVersion(' 1.0.0 '));
  ok('vacío no', !esVersion(''));
  ok('una palabra no', !esVersion('última'));
  ok('1.x no', !esVersion('1.x'));
  ok('un número suelto no', !esVersion(1));
  ok('nada no', !esVersion(null) && !esVersion(undefined));
}

console.log('\nCuándo se obliga a actualizar');
{
  ok('con una versión por debajo de la mínima, sí', tocaActualizar('1.0.0', '1.1.0'));
  ok('justo con la mínima, no', !tocaActualizar('1.1.0', '1.1.0'));
  ok('por encima de la mínima, tampoco', !tocaActualizar('1.2.0', '1.1.0'));
}

/*
 * LA PARTE QUE DE VERDAD IMPORTA
 *
 * Cada uno de estos casos es una forma de que el servidor conteste algo raro.
 * Todos tienen que dejar pasar. Si alguno bloqueara, un fallo de red o un dedo
 * torpe en la consola de Firebase dejaría a todos los usuarios sin app.
 */
console.log('\nAnte la duda, NO se bloquea a nadie');
{
  ok('sin mínima (documento que no existe)', !tocaActualizar('1.0.0', undefined));
  ok('mínima nula', !tocaActualizar('1.0.0', null));
  ok('mínima vacía', !tocaActualizar('1.0.0', ''));
  ok('mínima que no es una versión', !tocaActualizar('1.0.0', 'la última'));
  ok('mínima que es un número, no un texto', !tocaActualizar('1.0.0', 2));
  ok('mínima que es un objeto', !tocaActualizar('1.0.0', { minima: '9.9.9' }));
  ok('mínima que es una lista', !tocaActualizar('1.0.0', ['9.9.9']));
  // Y si la app no sabe qué versión lleva, tampoco se la juega.
  ok('sin saber la versión propia', !tocaActualizar('', '1.1.0'));
  ok('con una versión propia rara', !tocaActualizar('desconocida', '1.1.0'));
}

console.log('\nEl muro, tal y como está montado');
{
  const sinComentarios = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const lee = (f) => sinComentarios(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));

  const muro = lee('components/ActualizacionObligatoria.tsx');
  const layout = lee('app/_layout.tsx');
  const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const html = lee('app/+html.tsx');

  // Si el muro no está montado en la raíz, solo taparía una pantalla.
  ok('el muro está montado sobre toda la app', /<ActualizacionObligatoria \/>/.test(layout));
  // Sin salida: ni botón de cerrar, ni "ahora no", ni "más tarde".
  ok('no se puede cerrar', !/(cerrar|Ahora no|Más tarde|onClose)/i.test(muro));
  ok('tapa la pantalla entera', /position: 'absolute'/.test(muro) && /zIndex: 9999/.test(muro));
  // Vuelve a preguntar al volver a la app: es cuando acaban de actualizar.
  ok('vuelve a mirar al volver del segundo plano', /AppState\.addEventListener/.test(muro));
  // Y si falla la consulta, no se bloquea: el catch va vacío a propósito.
  ok('un fallo al consultar no bloquea', /\.catch\(\(\) => \{\}\)/.test(muro));

  // La app tiene que poder leer esa versión: si no, el muro no sale nunca.
  ok('la app puede leer config/version',
    /match \/config\/version \{[\s\S]{0,120}allow read: if true;/.test(reglas));
  // Pero nadie puede escribirla desde la app: con eso se dejaría fuera a todos.
  ok('y nadie puede escribirla desde la app',
    /match \/config\/version \{[\s\S]{0,160}allow write: if false;/.test(reglas));
  ok('el resto de config sigue cerrado',
    /match \/config\/\{docId\} \{\s*allow read, write: if false;/.test(reglas));

  // En la web el aviso también obliga: tapa la pantalla y solo deja recargar.
  ok('en la web el aviso tapa la pantalla', /position:fixed;inset:0/.test(html));
  ok('y no se puede seguir usando por detrás',
    /document\.documentElement\.style\.overflow = 'hidden'/.test(html));
  ok('pero no recarga sola', !/setTimeout\([^)]*location\.reload/.test(html));
  /*
   * Y NO SALE EN LA PRIMERA VISITA.
   *
   * El service worker que se instala por primera vez también avisa de "cambio
   * de mando". Sin distinguirlo, quien abre la app por primera vez se
   * encontraría un muro pidiéndole que actualice lo que acaba de cargar — lo
   * primero que vería, y encima sin poder tocar nada.
   */
  ok('no sale la primera vez que se entra',
    /var yaHabiaControl = !!navigator\.serviceWorker\.controller/.test(html) &&
      /if \(yaHabiaControl\) showUpdateBanner\(\)/.test(html));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
