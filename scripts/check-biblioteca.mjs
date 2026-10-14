/**
 * La biblioteca de ejercicios del coach (app/(trainer)/exercises/index.tsx).
 *
 * Era una lista de filas de texto iguales. Lo que se protege:
 *
 *  - Que cada ejercicio tenga cara: la miniatura de su vídeo, o el color de su
 *    categoría con "Sin vídeo" (lo que el coach necesita ver para completarla).
 *  - Que las miniaturas sean las pequeñas: cien de las grandes son megas.
 *  - Que diga qué músculos trabaja (los principales, hasta tres).
 *  - Que con "Todos" se agrupe por categoría, y las pastillas digan cuántos hay.
 *  - Que se puedan ver de una vez los que aún no tienen vídeo.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-biblioteca.mjs
 */
import { readFileSync } from 'node:fs';
import { musculosPrincipales } from '../lib/muscles.ts';
import { miniaturaDelEnlace } from '../lib/video.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const lee = (f) => readFileSync(f, 'utf8');
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nMúsculos principales');
{
  const r = musculosPrincipales({
    name: 'Muscle up',
    muscleWeights: { lats: 100, chest: 75, triceps: 50, biceps: 25, abs: 50 },
  });
  ok('de más a menos, sin los de un cuarto, y hasta tres', igual(r, ['Dorsales', 'Pecho', 'Tríceps']), r.join(', '));
  const l = musculosPrincipales({ name: 'Algo', muscles: ['abs', 'shoulders'] });
  ok('con la lista antigua, todos cuentan', igual(l, ['Abdomen', 'Hombros']), l.join(', '));
  const n = musculosPrincipales({ name: 'Dominadas supinas' });
  ok('sin datos, se deducen del nombre', n[0] === 'Dorsales' || n[0] === 'Bíceps', n.join(', '));
  ok('nada que decir, nada que pintar', musculosPrincipales({ name: 'Zzz' }).length === 0);
}

console.log('\nMiniaturas');
{
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  ok('la pequeña, para listas', miniaturaDelEnlace(url, 'mq') === 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  ok('la de siempre no cambia', miniaturaDelEnlace(url) === 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  const tarjeta = lee('components/TarjetaDeEjercicio.tsx');
  ok('la tarjeta pide la pequeña', /miniaturaDelEnlace\(ejercicio\.videoUrl, 'mq'\)/.test(tarjeta));
  ok('y la de Vimeo, a Vimeo', /useMiniaturaDeVimeo\(ejercicio\.videoUrl\)/.test(tarjeta));
  ok('sin vídeo, se dice', />Sin vídeo</.test(tarjeta));
  ok('y se ve su categoría con o sin imagen', /styles\.filo, \{ backgroundColor: color \}/.test(tarjeta));
}

console.log('\nLa lista');
{
  const pantalla = lee('app/(trainer)/exercises/index.tsx');
  ok('cada ejercicio es una TarjetaDeEjercicio', /<TarjetaDeEjercicio/.test(pantalla));
  ok('con "Todos", en bloques por categoría', /const k = muscleFilter \? \(e\.subgroup \?\? ''\) : e\.muscleGroup;/.test(pantalla));
  ok('en el orden del coach', /filterCategories\.indexOf\(a\[0\]\) - filterCategories\.indexOf\(b\[0\]\)/.test(pantalla));
  ok('las pastillas, con su color y su cuenta', /punto=\{categoryColor\(group\)\}/.test(pantalla) && /cuenta=\{porCategoria\.get\(group\) \?\? 0\}/.test(pantalla));
  ok('y un filtro con los que aún no tienen vídeo', /\(!soloSinVideo \|\| !e\.videoUrl\)/.test(pantalla) && /texto="Sin vídeo"/.test(pantalla));
}

console.log(fallos === 0 ? '\n✔ La biblioteca enseña cada ejercicio con su cara' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
