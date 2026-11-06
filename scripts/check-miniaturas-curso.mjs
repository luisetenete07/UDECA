/**
 * El entrenador puede QUITAR las miniaturas de un curso y dejarlas vacías:
 * la portada del curso, la de cada sección y la de cada clase (y mini clase).
 *
 * En una clase, quitar la miniatura la deja en blanco: ni la subida ni la que
 * pondría la plataforma del vídeo (`sinMiniatura`). Y se puede volver a la del
 * vídeo. Al guardar, lo quitado se BORRA (antes la portada quitada volvía).
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-miniaturas-curso.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (desc, bien) => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

console.log('\nLa miniatura vacía');
{
  const m = lee('components/MiniaturaCurso.tsx');
  ok('sin miniatura: ni la subida ni la de la plataforma', /const imagen = vacia \? null : \(thumbURL \?\? miniaturaDelEnlace\(contenido\.videoUrl\) \?\? deVimeo\);/.test(m));
  ok('y ni siquiera se pregunta a Vimeo', /useMiniaturaDeVimeo\(esPdf \|\| vacia \? undefined : contenido\.videoUrl\)/.test(m));
  ok('el campo existe en el contenido del curso', /sinMiniatura\?: boolean;/.test(lee('lib/types.ts')));
}

console.log('\nEl editor');
{
  const e = lee('components/EditorDeLeccion.tsx');
  ok('"Quitar miniatura" la deja vacía (también en las mini clases)', /onQuitarMiniatura\?\.\(\);\s*onCambiar\(\{ sinMiniatura: true \}\);/.test(e) && />Quitar miniatura</.test(e));
  ok('y "Usar la del vídeo" la devuelve', /onCambiar\(\{ sinMiniatura: undefined \}\)/.test(e) && />Usar la del vídeo</.test(e));
  const c = lee('app/(trainer)/courses/[id].tsx');
  ok('subir una nueva la vuelve a poner', /\{ thumbURL: url, sinMiniatura: undefined \}/.test(c));
  ok('la portada del curso se quita', /onPress=\{\(\) => setCoverURL\(undefined\)\}/.test(c) && />Quitar portada</.test(c));
  ok('y la de cada sección', /\{ \.\.\.x, coverURL: undefined \}/.test(c) && />Quitar portada de la sección</.test(c));
}

console.log('\nAl guardar, lo quitado se borra');
{
  const f = lee('lib/firestore/courses.ts');
  ok('la portada quitada y la descripción vaciada, con deleteField', /\(\['coverURL', 'description'\] as const\)\.filter\(\(k\) => k in data && data\[k\] === undefined\)/.test(f) && /\[k, deleteField\(\)\]/.test(f));
}

console.log(fallos === 0 ? '\n✔ Miniaturas del curso: se pueden quitar' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
