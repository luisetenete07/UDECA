/*
 * El entrenador decide si sus alumnos ven la comunidad (pestaña Social).
 *
 * Lo que se vigila son los fallos que no dan error:
 *
 *  1. Sin tocar nada se sigue viendo: los grupos de antes no pierden su
 *     pestaña porque haya llegado un interruptor nuevo.
 *  2. Volver a enseñarla BORRA el campo: si solo se escribieran los "sí", un
 *     "oculta" viejo se quedaría en Firestore.
 *  3. Cada sitio donde el alumno ve la comunidad lo respeta: la pestaña y su
 *     puesto en el carné. Uno olvidado es el entrenador creyendo que la ha
 *     escondido.
 *  4. Lo puede escribir el entrenador en su perfil (las reglas no lo bloquean)
 *     y no queda en la lista de lo que decide el servidor.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-comunidad-visible.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');
const sinComentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\nLo que no se toca, se ve');
{
  const social = sinComentar(lee('lib/firestore/social.ts'));
  ok('solo la oculta un "true" puesto a propósito', /comunidadOculta !== true/.test(social));
  ok('y si no se puede leer, se ve', /comunidadAbierta[\s\S]{0,300}catch \{\s*return true;/.test(social));
}

console.log('\nEnseñarla borra el campo');
{
  const users = sinComentar(lee('lib/firestore/users.ts'));
  ok('se guarda con deleteField al enseñarla', /comunidadOculta: oculta \? true : deleteField\(\)/.test(users));
}

console.log('\nEl alumno no la ve en ningún sitio');
{
  const layout = sinComentar(lee('app/(client)/_layout.tsx'));
  ok('la pestaña Social depende de lo que diga el entrenador',
    /comunidadAbierta\(trainerId\)/.test(layout) && /const social = conCompaneros && abierta;/.test(layout));
  ok('y la pestaña se esconde con eso', /href: pestanas\?\.social === false \? null : undefined/.test(layout));
  const carne = sinComentar(lee('components/MemberCard.tsx'));
  ok('el carné no enseña su puesto', /await comunidadAbierta\(profile\.trainerId\)/.test(carne));
}

console.log('\nEl entrenador lo decide donde mira a su grupo');
{
  const tarjeta = sinComentar(lee('components/ClasificacionDelGrupo.tsx'));
  ok('hay interruptor en la clasificación', /<Switch[\s\S]{0,80}value=\{!oculta\}/.test(tarjeta));
  ok('que escribe en su perfil', /setComunidadOculta\(trainerId, !visible\)/.test(tarjeta));
  ok('y vuelve atrás si no se pudo guardar', /catch \{\s*setOculta\(visible\);/.test(tarjeta));
  ok('la tarjeta sigue en Clientes', /<ClasificacionDelGrupo trainerId=\{profile\.uid\} \/>/.test(lee('app/(trainer)/clients/index.tsx')));

  const reglas = lee('firestore.rules');
  const bloqueados = reglas.match(/\.hasAny\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  ok('las reglas dejan que lo escriba él', !/comunidadOculta/.test(bloqueados));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
