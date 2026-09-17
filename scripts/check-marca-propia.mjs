/*
 * La marca propia: la palabra que sustituye a UDECA dentro de la app.
 *
 * Lo que se vigila aquí son las dos cosas que, si se rompen, no dan error.
 *
 * LA PRIMERA es QUIÉN VE QUÉ. Un alumno no tiene marca —no paga y no vende
 * nada—, así que lee la de SU ENTRENADOR. Si eso se invirtiera, el alumno de
 * un coach con marca vería UDECA, y el coach estaría pagando por una marca que
 * no ve nadie. No hay pantalla en rojo que avise de eso.
 *
 * LA SEGUNDA es EL TOPE. Doce letras salen de medir la barra lateral, que es el
 * sitio más estrecho donde se pinta. Subirlo sin volver a medir empuja el
 * emblema o parte la fila, y eso solo se ve abriendo la app en un móvil.
 *
 * La lógica vive suelta en lib/marcaPropia.ts para poder ejecutarla desde aquí.
 * Las pantallas se leen como texto: arrastran React Native.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-marca-propia.mjs
 */
import { readFileSync } from 'node:fs';
import {
  LARGO_DE_LA_MARCA,
  MARCA_POR_DEFECTO,
  limpiarMarca,
  marcaDe,
  tieneMarcaPropia,
} from '../lib/marcaPropia.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');

console.log('\nEl texto se guarda limpio y con tope');
{
  ok('los espacios de más se juntan', limpiarMarca('  Iron   Box  ') === 'Iron Box');
  ok('los saltos de línea también', limpiarMarca('Iron\nBox') === 'Iron Box');
  const largo = limpiarMarca('X'.repeat(50));
  ok(`no pasa de ${LARGO_DE_LA_MARCA}`, largo.length === LARGO_DE_LA_MARCA, String(largo.length));
  // El corte va DESPUÉS de limpiar: al revés, los espacios sobrantes se
  // comerían letras que sí caben.
  ok('y no acaba en un espacio suelto', limpiarMarca('a '.repeat(30)).endsWith('a'));
  ok('vacío es vacío', limpiarMarca('   ') === '');
}

console.log('\nQuién ve qué');
{
  const coach = { role: 'trainer', brandName: 'IRON BOX' };
  const atleta = { role: 'athlete', brandName: 'MI PLAN' };
  const alumno = { role: 'client' };

  ok('el entrenador ve la suya', marcaDe(coach) === 'IRON BOX');
  ok('el atleta ve la suya', marcaDe(atleta) === 'MI PLAN');
  // LO IMPORTANTE. El alumno lee la de su coach, no la suya ni la de la casa.
  ok('el alumno ve la de su entrenador', marcaDe(alumno, coach) === 'IRON BOX');
  // Y un alumno que se pusiera una por su cuenta (las reglas no lo impiden, y
  // no merece la pena impedirlo) no la ve: la app es la de su coach.
  ok(
    'aunque él se hubiera puesto otra',
    marcaDe({ role: 'client', brandName: 'LA MIA' }, coach) === 'IRON BOX'
  );

  ok('sin marca, UDECA', marcaDe({ role: 'trainer' }) === MARCA_POR_DEFECTO);
  ok('sin sesión, UDECA', marcaDe(null) === MARCA_POR_DEFECTO);
  // Mientras el perfil del coach no ha llegado se lee UDECA, que es mejor que
  // un hueco parpadeando en la cabecera.
  ok('y mientras carga la del coach, UDECA', marcaDe(alumno, null) === MARCA_POR_DEFECTO);
  ok('el coach sin marca deja a su alumno en UDECA', marcaDe(alumno, { role: 'trainer' }) === MARCA_POR_DEFECTO);

  ok('tieneMarcaPropia distingue', tieneMarcaPropia(coach) && !tieneMarcaPropia({ role: 'trainer' }));
  ok('y no se cree un espacio en blanco', !tieneMarcaPropia({ role: 'trainer', brandName: '   ' }));
}

console.log('\nLos tres sitios donde se pinta la usan');
{
  for (const [que, ruta] of [
    ['la barra lateral', 'components/SidebarBrand.tsx'],
    ['el logo de las puertas', 'components/Logo.tsx'],
    ['la tarjeta que se comparte', 'components/ProgressCard.tsx'],
  ]) {
    const f = lee(ruta);
    // Se busca que la SAQUE del contexto y que no quede "UDECA" escrito a
    // fuego en un `<Text>`. El logo no vale con `{marca}` a secas porque sin
    // sesión pinta la de la casa a propósito.
    ok(`${que} la saca del contexto`, /const \{[^}]*\bmarca\b[^}]*\} = useAuth\(\)/.test(f));
    ok(`${que} no la lleva escrita a fuego`, !/>\s*UDECA\s*</.test(f), 'queda un UDECA literal');
    // El seguro del tope: si una tipografía es más ancha de lo medido, antes
    // que empujar nada, se recorta.
    ok(`${que} la recorta a una línea`, /numberOfLines=\{1\}/.test(f));
  }
  // Entrar y registrarse van SIN sesión: ahí no se sabe de quién es nadie y la
  // marca es la de la app.
  for (const ruta of ['app/(auth)/login.tsx', 'app/(auth)/register.tsx', 'app/(auth)/welcome.tsx']) {
    ok(`${ruta} enseña UDECA`, /<Logo sinSesion/.test(lee(ruta)));
  }
}

console.log('\nY se puede poner y quitar');
{
  const editor = lee('components/EditorDeMarca.tsx');
  ok('hay editor', editor.length > 500);
  ok('con el tope puesto en el campo', /maxLength=\{LARGO_DE_LA_MARCA\}/.test(editor));
  ok('y con vista previa', /Así se verá/.test(editor));
  // Vaciar tiene que BORRAR el campo, no dejarlo a ''. Misma decisión que en
  // los comentarios de la libreta y por el mismo motivo: lo vacío no se ve
  // pero se queda escrito para siempre.
  ok(
    'vaciar borra el campo de verdad',
    /brandName: limpio \? limpio : deleteField\(\)/.test(lee('lib/firestore/users.ts'))
  );

  const coach = lee('app/(trainer)/profile.tsx');
  const cliente = lee('app/(client)/profile.tsx');
  ok('el entrenador lo tiene', /<EditorDeMarca \/>/.test(coach));
  // El ALUMNO no: lo que ve es la de su coach, así que un editor ahí sería un
  // campo que se guarda y no cambia nada.
  ok('el atleta también, y solo él', /\{isAthlete \? <EditorDeMarca \/> : null\}/.test(cliente));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
