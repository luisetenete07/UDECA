/*
 * Los comentarios del entrenador en las fotos de la libreta.
 *
 * La mitad de esto ya existía sin servir para nada: el alumno llevaba meses
 * pintando `p.caption` y no había ni una pantalla donde escribirlo. Un campo
 * que solo se lee es un campo que nadie nota que está roto, así que lo primero
 * que se vigila aquí es que las dos mitades sigan puestas.
 *
 * La lógica (limpiar el texto, ponerlo, quitarlo) vive suelta en
 * lib/libretaDeComidas.ts para poder ejecutarla de verdad desde aquí. Lo demás
 * —las pantallas— se lee como texto: arrastran React Native y no se pueden
 * importar desde Node pelado.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-libreta-de-comidas.mjs
 */
import { readFileSync } from 'node:fs';
import {
  LARGO_DEL_COMENTARIO,
  LARGO_QUE_CABE,
  conComentario,
  cuantasComentadas,
  limpiarComentario,
  seCorta,
} from '../lib/libretaDeComidas.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}
const lee = (ruta) => readFileSync(ruta, 'utf8');

console.log('\nEl texto se guarda limpio');
{
  comprueba(
    'los espacios de más se juntan',
    limpiarComentario('  120 g   de   arroz  ') === '120 g de arroz',
    limpiarComentario('  120 g   de   arroz  ')
  );
  comprueba(
    'y los saltos de línea pegados no dejan renglones vacíos',
    limpiarComentario('Arroz\n\n\nPollo') === 'Arroz\nPollo',
    JSON.stringify(limpiarComentario('Arroz\n\n\nPollo'))
  );
  // El corte va después de limpiar. Al revés, los espacios sobrantes se
  // comerían letras que sí caben.
  const largo = limpiarComentario(`${'a  '.repeat(200)}`);
  comprueba(
    `no pasa de ${LARGO_DEL_COMENTARIO} caracteres`,
    largo.length <= LARGO_DEL_COMENTARIO,
    String(largo.length)
  );
  comprueba('y no acaba en un espacio suelto', largo === largo.trimEnd(), JSON.stringify(largo.slice(-3)));
}

console.log('\nPoner y quitar un comentario');
{
  const fotos = [
    { id: 'a', imageURL: 'data:1' },
    { id: 'b', imageURL: 'data:2', caption: 'lo de antes' },
  ];

  const puesto = conComentario(fotos, 'a', '  Con 120 g de arroz  ');
  comprueba('se pone en la foto que toca', puesto[0].caption === 'Con 120 g de arroz', String(puesto[0].caption));
  comprueba('y no toca a las demás', puesto[1].caption === 'lo de antes');

  // LO IMPORTANTE. Vaciar el campo tiene que BORRAR la clave, no dejarla a ''.
  // Una cadena vacía no se ve en pantalla (la condición del alumno la filtra),
  // así que este fallo sería invisible, y se quedaría escrita para siempre en
  // un documento que ya compite con doce fotos por su megabyte.
  const quitado = conComentario(fotos, 'b', '   ');
  comprueba(
    'vaciarlo borra la clave, no la deja vacía',
    !('caption' in quitado[1]),
    JSON.stringify(quitado[1])
  );

  // La pantalla pinta la lista antes de que Firestore conteste y guarda la
  // anterior para poder deshacer. Si se mutara, las dos serían la misma.
  comprueba('no se muta la lista original', fotos[0].caption === undefined && fotos[1].caption === 'lo de antes');
  comprueba('un id que no existe no rompe nada', conComentario(fotos, 'zzz', 'hola').length === 2);

  comprueba('el contador cuenta las que llevan texto', cuantasComentadas(puesto) === 2, String(cuantasComentadas(puesto)));
  comprueba('y no cuenta las vacías', cuantasComentadas(quitado) === 0, String(cuantasComentadas(quitado)));
}

console.log('\n"Toca para leerlo" solo cuando falta algo por leer');
{
  comprueba('sin comentario, no se avisa', !seCorta(undefined));
  comprueba('lo corto se lee entero', !seCorta('Avena con plátano.'));
  comprueba(
    'lo largo avisa',
    seCorta('x'.repeat(LARGO_QUE_CABE + 1)),
    String(LARGO_QUE_CABE)
  );
  // Tres renglones es lo que se pinta. El cuarto no se ve aunque sea corto.
  comprueba('y cuatro renglones también', seCorta('a\nb\nc\nd'));
  comprueba('tres no', !seCorta('a\nb\nc'));
}

console.log('\nLas dos mitades siguen enchufadas');
{
  const coach = lee('app/(trainer)/clients/meal-books.tsx');
  const alumno = lee('components/PanelDeNutricion.tsx');

  comprueba('el entrenador puede escribirlo', /conComentario\(/.test(coach));
  comprueba('desde un panel con la foto grande', /titulo="Comentario de la foto"/.test(coach));
  comprueba(
    'y el campo tiene tope de verdad',
    /maxLength=\{LARGO_DEL_COMENTARIO\}/.test(coach)
  );
  // Tocar la foto abre el comentario, pero la equis sigue borrando: si el
  // mismo gesto hiciera las dos cosas, comentar una foto la borraría.
  comprueba('borrar sigue teniendo su propio botón', /handleRemovePhoto\(book, p\.id\)/.test(coach));
  // Con el campo vacío y sin comentario previo no hay nada que hacer: el botón
  // diría "Quitar el comentario" sobre una foto que no tiene ninguno.
  comprueba(
    'y no se ofrece quitar lo que no existe',
    /disabled=\{!limpiarComentario\(comentario\) && !fotoComentada\.caption\}/.test(coach)
  );

  comprueba('el alumno lo ve', /p\.caption \? \(/.test(alumno));
  comprueba(
    'recortado bajo la miniatura, que mide 130 px',
    /style=\{styles\.bookCaption\} numberOfLines=\{3\}/.test(alumno)
  );
  comprueba('y entero al ampliar la foto', /zoomPhoto\.comentario/.test(alumno));
  comprueba('el aviso de leerlo se decide, no se pinta siempre', /seCorta\(p\.caption\)/.test(alumno));
  comprueba(
    'con el comentario viajando al visor',
    /setZoomPhoto\(\{ uri: p\.imageURL, comentario: p\.caption \}\)/.test(alumno)
  );

  // El nombre del campo no se toca: hay libretas guardadas con él.
  comprueba(
    'el campo guardado se sigue llamando caption',
    /caption\?: string;/.test(lee('lib/types.ts'))
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
