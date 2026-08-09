/*
 * El árbol de un curso: secciones, lecciones y mini clases (lib/curso.ts).
 *
 * Mover algo de sitio en un árbol de tres niveles parece trivial y se rompe
 * por los bordes: el primero, el último, la lista de uno. Y lo que se rompe es
 * el trabajo de alguien —el orden en que un entrenador dejó sus lecciones—,
 * así que conviene comprobarlo sin abrir la app.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-curso.mjs
 */
import {
  cabeElCurso,
  conLeccionCambiada,
  conMiniCambiada,
  conMiniNueva,
  cuantasMiniaturas,
  leccionesReordenadas,
  minisReordenadas,
  movido,
  pesoDelCurso,
  seccionesReordenadas,
  sinMini,
  TOPE_SEGURO,
} from '../lib/curso.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const secciones = () => [
  {
    id: 's1',
    title: 'Base',
    lessons: [
      { id: 'l1', title: 'Uno', videoUrl: 'v', minis: [
        { id: 'm1', title: 'Mini A', videoUrl: 'v' },
        { id: 'm2', title: 'Mini B', videoUrl: 'v' },
        { id: 'm3', title: 'Mini C', videoUrl: 'v' },
      ]},
      { id: 'l2', title: 'Dos', videoUrl: 'v' },
      { id: 'l3', title: 'Tres', videoUrl: 'v' },
    ],
  },
  { id: 's2', title: 'Avanzado', lessons: [{ id: 'l4', title: 'Cuatro', videoUrl: 'v' }] },
];
const ids = (lista) => lista.map((x) => x.id).join();

console.log('\nMover, por los bordes');
{
  const l = ['a', 'b', 'c'];
  comprueba('del primero al último', movido(l, 0, 2).join() === 'b,c,a');
  comprueba('del último al primero', movido(l, 2, 0).join() === 'c,a,b');
  comprueba('al mismo sitio, igual', movido(l, 1, 1) === l);
  comprueba('fuera de rango por arriba, igual', movido(l, 0, 9) === l);
  comprueba('fuera de rango por abajo, igual', movido(l, -1, 0) === l);
  comprueba('una lista de uno no se rompe', movido(['a'], 0, 0).join() === 'a');
  comprueba('una lista vacía tampoco', movido([], 0, 1).length === 0);
  comprueba('no toca la original', l.join() === 'a,b,c');
}

console.log('\nReordenar secciones y lecciones');
{
  const s = seccionesReordenadas(secciones(), 0, 1);
  comprueba('la sección se mueve', ids(s) === 's2,s1');
  comprueba('y se lleva sus lecciones', s[1].lessons.length === 3);

  const l = leccionesReordenadas(secciones(), 's1', 2, 0);
  comprueba('la lección se mueve dentro de su sección', ids(l[0].lessons) === 'l3,l1,l2');
  comprueba('la otra sección no se entera', ids(l[1].lessons) === 'l4');
  comprueba(
    'una sección que no existe no cambia nada',
    ids(leccionesReordenadas(secciones(), 'noexiste', 0, 1)[0].lessons) === 'l1,l2,l3'
  );
}

console.log('\nReordenar mini clases');
{
  const s = minisReordenadas(secciones(), 's1', 'l1', 0, 2);
  comprueba('la mini se mueve', ids(s[0].lessons[0].minis) === 'm2,m3,m1');
  comprueba(
    'las lecciones vecinas no se tocan',
    s[0].lessons[1].minis === undefined && ids(s[0].lessons) === 'l1,l2,l3'
  );
  comprueba(
    'reordenar minis en una lección que no tiene no inventa ninguna',
    (minisReordenadas(secciones(), 's1', 'l2', 0, 1)[0].lessons[1].minis ?? []).length === 0
  );
}

console.log('\nCrear y quitar mini clases');
{
  const conUna = conMiniNueva(secciones(), 's1', 'l2');
  comprueba('la lección sin minis pasa a tener una', conUna[0].lessons[1].minis.length === 1);
  comprueba('nace vacía y lista para escribir', conUna[0].lessons[1].minis[0].title === '');
  comprueba('con id propio', !!conUna[0].lessons[1].minis[0].id);
  comprueba(
    'se añade al final, no al principio',
    ids(conMiniNueva(secciones(), 's1', 'l1')[0].lessons[0].minis).startsWith('m1,m2,m3')
  );

  const quitandoUna = sinMini(secciones(), 's1', 'l1', 'm2');
  comprueba('quitar una deja las otras', ids(quitandoUna[0].lessons[0].minis) === 'm1,m3');

  // Quitar la última tiene que dejar la lección EXACTAMENTE como antes de que
  // existieran las mini clases: sin el campo, no con una lista vacía.
  let sola = conMiniNueva(secciones(), 's1', 'l2');
  const idMini = sola[0].lessons[1].minis[0].id;
  sola = sinMini(sola, 's1', 'l2', idMini);
  comprueba('quitar la última borra el campo entero', !('minis' in sola[0].lessons[1]));
}

console.log('\nCambiar campos');
{
  const s = conLeccionCambiada(secciones(), 's1', 'l2', {
    title: 'Nuevo',
    durationLabel: '12 min',
    thumbURL: 'data:x',
  });
  comprueba('cambia lo que se le pide', s[0].lessons[1].title === 'Nuevo');
  comprueba('y de una vez', s[0].lessons[1].durationLabel === '12 min');
  comprueba('sin perder lo que ya tenía', s[0].lessons[1].videoUrl === 'v');
  comprueba('sin tocar las hermanas', s[0].lessons[0].title === 'Uno');

  const m = conMiniCambiada(secciones(), 's1', 'l1', 'm2', { durationLabel: '3 min' });
  comprueba('la mini cambia', m[0].lessons[0].minis[1].durationLabel === '3 min');
  comprueba('sus hermanas no', m[0].lessons[0].minis[0].durationLabel === undefined);
}

console.log('\nEl peso del curso (un documento son 1 MB y las fotos van dentro)');
{
  const chico = { sections: secciones() };
  comprueba('un curso normal cabe de sobra', cabeElCurso(chico).cabe);
  comprueba('y no avisa de nada', cabeElCurso(chico).aviso === undefined);
  comprueba('sin miniaturas, cero', cuantasMiniaturas(secciones()) === 0);

  const conFotos = conMiniCambiada(
    conLeccionCambiada(secciones(), 's1', 'l1', { thumbURL: 'data:1' }),
    's1', 'l1', 'm1', { thumbURL: 'data:2' }
  );
  comprueba('se cuentan las de lecciones y minis', cuantasMiniaturas(conFotos) === 2);
  conFotos[0].coverURL = 'data:3';
  comprueba('y la portada de la sección', cuantasMiniaturas(conFotos) === 3);

  // Un curso pasado de peso: el aviso tiene que decir qué hacer, no solo que
  // ha fallado.
  const gordo = {
    sections: [
      {
        id: 's',
        title: 'Pesada',
        lessons: [{ id: 'l', title: 'x', videoUrl: 'v', thumbURL: 'd'.repeat(TOPE_SEGURO + 1000) }],
      },
    ],
  };
  const r = cabeElCurso(gordo);
  comprueba('no cabe', !r.cabe);
  comprueba('dice cuánto pesa', /KB/.test(r.aviso ?? ''));
  comprueba('dice cuántas imágenes lleva', /1 imagen/.test(r.aviso ?? ''), r.aviso);
  comprueba('y dice qué hacer', /quita alguna miniatura/i.test(r.aviso ?? ''));

  // Las tildes ocupan dos bytes: medir caracteres se quedaría corto justo en
  // los cursos escritos en español, que son todos.
  const conTildes = { sections: [{ id: 's', title: 'ñññ', lessons: [] }] };
  comprueba(
    'se miden bytes, no caracteres',
    pesoDelCurso(conTildes) > JSON.stringify(conTildes).length
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
