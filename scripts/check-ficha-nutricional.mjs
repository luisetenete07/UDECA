/*
 * La ficha nutricional: que no vuelva a parpadear.
 *
 * LO QUE PASABA
 *
 * "En la sección de nutrición, al rehacer la ficha nutricional, parpadea mucho y
 * te tira de la app". Eran tres cosas distintas sumándose, y las tres solo
 * ocurren en el móvil, que es justo donde no se puede abrir una consola a mirar.
 *
 *  1. La lectura AUTOMÁTICA de pasos pedía el permiso al sistema. En Android ese
 *     diálogo manda la app al fondo y la devuelve al frente al cerrarse, y
 *     volver al frente es precisamente lo que dispara la lectura: el diálogo se
 *     daba de comer a sí mismo. Medido en un navegador con un sensor de mentira:
 *     diez idas y vueltas eran once diálogos y once lecturas.
 *  2. Cada lectura escuchaba el sensor cuatro segundos, escribía en Firestore y
 *     hacía que el padre recargara la sección entera. Sin plazo entre lecturas
 *     ni cerrojo, se solapaban.
 *  3. La carga del panel colgaba del objeto `profile` ENTERO, que es nuevo cada
 *     vez que se relee la cuenta. Guardar los macros relee la cuenta, así que
 *     guardar recargaba las seis consultas de la sección.
 *
 * Y el formulario era el único de la app montado a mano —una pantalla completa
 * dentro de un `Modal`, con su propia área segura y su propio teclado—, que en
 * Android no se comporta como una pantalla: el contenido salta al abrirse y el
 * teclado tapa los campos.
 *
 * Nada de esto da error. Se ve, y solo en un teléfono.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-ficha-nutricional.mjs
 */
import { readFileSync } from 'node:fs';
import { objetivosDelDia } from '../lib/macrosDelDia.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** Sin comentarios: lo que se comprueba es el código, no lo que se cuenta de él. */
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const panel = sinComentarios(lee('components/PanelDeNutricion.tsx'));
const progreso = sinComentarios(lee('app/(client)/progress.tsx'));

// =========================================================================
console.log('\n1 · Sin pasos');
// =========================================================================
// El conteo de pasos —la causa 1 de arriba— se quitó de la app entera.
ok('el panel ya no cuenta pasos', !/ContadorDePasos|pasos/i.test(panel));

// =========================================================================
console.log('\n2 · Guardar la ficha no recarga media app');
// =========================================================================
ok(
  'la carga de nutrición depende de QUIÉN, no del perfil entero',
  /\}, \[uid, trainerId\]\);/.test(panel),
  'el objeto del perfil es nuevo en cada relectura de la cuenta'
);
ok(
  'y la de progreso, igual',
  /\}, \[uid, trainerId, cacheKey\]\);/.test(progreso)
);
ok(
  'guardar los macros sigue releyendo la cuenta',
  /await refreshProfile\(\);/.test(panel),
  'es lo que hace que los objetivos nuevos salgan al momento'
);

// =========================================================================
console.log('\n3 · El formulario es el mismo panel que el resto de la app');
// =========================================================================
ok(
  'la calculadora vive en un Sheet',
  /<Sheet\s+visible=\{calcOpen\}/.test(panel),
  'una pantalla completa dentro de un Modal no se comporta como una pantalla en Android'
);
ok(
  'sin un ScreenContainer metido dentro',
  !/ScreenContainer/.test(panel),
  'traía otra área segura, otro teclado y otro scroll dentro de la ventana del Modal'
);
ok(
  'y el formulario de comidas sigue en su Sheet',
  /<Sheet\s+visible=\{formOpen\}/.test(panel)
);

// =========================================================================
console.log('\n4 · Manda el alumno, y se aplica al momento');
// =========================================================================
/*
 * "El plan nutricional lo decide el alumno, no el coach. Si lo actualiza se
 * hace y ya, el coach no tiene que verificar nada".
 *
 * Antes ganaba siempre el plan del entrenador, y por eso rehacer la ficha
 * parecía roto: se guardaba, el aviso decía "guardado", y en pantalla no
 * cambiaba ni una cifra. Ahora gana el último que habló, y en empate el
 * alumno.
 *
 * La regla NO es "el alumno siempre", aunque suene mejor: casi todos calculan
 * sus macros en la bienvenida, el primer día, y si eso ganara para siempre el
 * plan que mande el entrenador la semana que viene no se aplicaría nunca. Esa
 * trampa es la que prueban los casos de aquí abajo.
 */
const CIFRAS = { dailyCalories: 2000, proteinG: 150, carbsG: 200, fatG: 60 };
const plan = (updatedAt) => ({ name: 'Plan del coach', ...CIFRAS, updatedAt });
const mios = (updatedAt) => ({ ...CIFRAS, updatedAt });

ok('sin nada de nadie, no hay objetivos', objetivosDelDia(null, null) === null);
ok('solo el plan del coach: manda el suyo', objetivosDelDia(plan(100), null)?.fromCoach === true);
ok('solo lo del alumno: manda lo suyo', objetivosDelDia(null, mios(100))?.fromCoach === false);
ok(
  'el alumno recalcula después del plan: manda el alumno',
  objetivosDelDia(plan(100), mios(200))?.fromCoach === false,
  'es el caso del aviso: si esto falla, rehacer la ficha vuelve a no hacer nada'
);
ok(
  'el coach manda un plan nuevo después: manda el coach',
  objetivosDelDia(plan(300), mios(200))?.fromCoach === true,
  'sin esto, quien calculó en la bienvenida no recibiría nunca un plan de su entrenador'
);
ok('en empate gana el alumno', objetivosDelDia(plan(100), mios(100))?.fromCoach === false);
ok(
  'sin fecha, lo viejo no gana por no tenerla',
  objetivosDelDia(plan(500), mios(undefined))?.fromCoach === true,
  'un updatedAt que falta es dato antiguo, no dato de ahora'
);

ok(
  'el aviso ya no matiza nada: se aplica y punto',
  /showToast\('Macros actualizados'\)/.test(panel) &&
    !/sigue mandando el plan de Luis/.test(panel)
);
ok(
  'la pantalla usa la regla, no la escribe otra vez',
  /objetivosDelDia\(plan, nt\)/.test(panel),
  'dos copias de "quién manda" acaban discrepando'
);
ok(
  'con plan del coach se dice de quién son los números y cómo cambiarlos',
  /Los ha puesto Luis\. Si calculas los tuyos, mandan los tuyos\./.test(panel),
  'unas cifras que no reconoces y sin salida es lo que hace escribir al soporte'
);

console.log(
  fallos === 0 ? '\n✔ La ficha nutricional se está quieta' : `\n${fallos} fallo(s)`
);
process.exit(fallos === 0 ? 0 : 1);
