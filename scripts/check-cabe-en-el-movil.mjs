/*
 * Que la app siga cabiendo en un móvil de verdad.
 *
 * POR QUÉ EXISTE
 *
 * En un móvil apareció el selector de programación con la pastilla dorada
 * dibujada FUERA de su caja, encima del texto de abajo, y los botones partidos
 * a mitad de palabra: "Borrado" y una "r" suelta debajo.
 *
 * No era un fallo de estilo, eran dos fallos de fondo:
 *
 *  1. LA PASTILLA SE COLOCABA CON UNA CUENTA. Fila = índice / 2, columna =
 *     índice % 2, por el ancho y el alto teóricos. Esa cuenta y el reparto real
 *     que hace flexbox son dos verdades sobre lo mismo, y el día que dejan de
 *     coincidir —un ancho que llega tarde, una letra más grande, una
 *     rotación— la pastilla se pinta donde no hay nada. Y como la cuenta no
 *     sabe que se ha equivocado, no se corrige sola.
 *
 *  2. LA LETRA DEL SISTEMA NO TENÍA TECHO. En iOS y Android se puede subir el
 *     tamaño de texto en los ajustes, y React Native lo aplica a todo sin
 *     límite. Con el ajuste alto, un texto de 15 puntos se pinta a 52: no hay
 *     botón que aguante eso.
 *
 * Los dos son invisibles en un monitor y en los tipos. Esto los vigila.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-cabe-en-el-movil.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** Una promesa escrita en un comentario no cumple nada. */
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const segmented = sinComentarios(lee('components/Segmented.tsx'));
const texto = sinComentarios(lee('components/Texto.tsx'));
const boton = sinComentarios(lee('components/Button.tsx'));

console.log('\nLa pastilla del selector va donde ESTÁ el segmento');
ok('cada segmento dice dónde ha quedado', /onLayout=\{\(e\) => \{[\s\S]{0,160}mide\(i,/.test(segmented));
ok('y la pastilla se coloca con esa medida', /cajaActiva/.test(segmented));
ok('su tamaño también sale de la medida',
  /width: cajaActiva\.ancho/.test(segmented) && /height: cajaActiva\.alto/.test(segmented));
/*
 * Lo que NO puede volver: deducir la posición de la fila y la columna. Es la
 * cuenta que se separaba de la realidad.
 */
ok('ya no se deduce la fila del índice', !/Math\.floor\(i \/ porFila\)/.test(segmented));
ok('ni la columna', !/\(i % porFila\)/.test(segmented));
// Sin esto, `onLayout` guarda un objeto nuevo en cada pasada y vuelve a pintar
// sin parar: la pantalla se queda quemando batería sin que se vea nada raro.
ok('y no se repinta sin fin al medir', /if \(v && v\.x === c\.x/.test(segmented));
// Con la letra grande, una altura fija recorta el texto por la mitad.
ok('el segmento puede crecer con la letra', /minHeight: alto/.test(segmented));
ok('y no lleva una altura fija', !/\{ height: alto \}/.test(segmented));

console.log('\nLa letra del sistema tiene techo');
ok('el Text de la app pone un tope', /maxFontSizeMultiplier=\{TOPE_DE_LETRA\}/.test(texto));
const tope = Number((texto.match(/TOPE_DE_LETRA = ([\d.]+)/) ?? [])[1]);
// Ni tanto que descuadre la app ni tan poco que sea no dejar crecer nada. Quien
// necesita la letra grande la necesita de verdad.
ok('y el tope deja crecer sin romper', tope >= 1.2 && tope <= 1.5, String(tope));
// El tope va ANTES de `...resto`: así quien de verdad necesite otro lo pasa por
// prop y gana. Al revés, la prop no serviría de nada.
ok('quien necesite otro tope puede ponerlo',
  texto.indexOf('maxFontSizeMultiplier=') < texto.indexOf('{...resto}'));

console.log('\nUn botón no parte palabras por la mitad');
ok('el texto del botón va en una línea', /numberOfLines=\{1\}/.test(boton));
// Y para que no llegue a hacer falta cortar: menos margen cuando van en fila.
ok('hay una variante estrecha para los que van en fila', /baseCompacta/.test(boton));

/*
 * EL ESTILO VA AL PULSABLE, NO A UNA CAPA DE DENTRO
 *
 * `PressableScale` envolvía sus hijos en una vista con el estilo y la
 * animación. El estilo caía en esa vista y NO en el pulsable, así que un
 * `flex: 1` puesto por quien lo usa no estiraba el pulsable: seguía midiendo lo
 * que midieran sus contenidos.
 *
 * En una fila eso deja a cero lo único elástico. En la lista de "Entrar como"
 * se veía la foto, la flecha y la equis, y en medio nada: ni el nombre ni el
 * tipo de cuenta. Con dos cuentas del mismo dueño no había forma de saber cuál
 * era cuál.
 *
 * Alguien ya se lo encontró una vez en la pantalla de entreno y lo rodeó
 * metiendo otra vista por fuera. Rodearlo deja el fallo esperando al siguiente.
 */
console.log('\nEl estilo de un pulsable va al pulsable');
const pulsable = sinComentarios(lee('components/PressableScale.tsx'));
ok('el pulsable ES la caja animada', /Animated\.createAnimatedComponent\(Pressable\)/.test(pulsable));
ok('y el estilo se le pone a él', /<PulsableAnimado[\s\S]{0,400}style=\{\[style,/.test(pulsable));
// Lo que no puede volver: una vista en medio quedándose con el estilo.
ok('ya no hay una vista en medio con el estilo',
  !/<Animated\.View style=\{\[style,/.test(pulsable));

console.log('\nLos botones que van en fila caben o se parten en dos filas');
const rutina = sinComentarios(lee('app/(trainer)/clients/[id]/routine.tsx'));
ok('la fila de acciones puede partirse', /actionsRow: \{[\s\S]{0,120}flexWrap: 'wrap'/.test(rutina));
ok('y cada botón tiene un ancho mínimo', /minWidth: 96/.test(rutina));

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
