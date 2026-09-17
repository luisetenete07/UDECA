/*
 * Las condiciones de contratación.
 *
 * NO ES UNA PÁGINA MÁS. Es la URL que se le da a Stripe como condiciones de
 * servicio, y sin ella la casilla "exigir que los clientes acepten las
 * condiciones" sale en gris y no se puede activar. Esa casilla es la que deja
 * constancia de que alguien las aceptó al pagar.
 *
 * Y dentro está el apartado que permite empezar a prestar el servicio de
 * inmediato en vez de quedar catorce días a merced de una devolución. Para que
 * eso valga no basta con escribirlo: la ley pide que el consumidor lo pida
 * expresamente y reconozca que pierde el derecho. Si ese párrafo desaparece un
 * día en una reescritura, nadie se entera hasta la primera reclamación.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-condiciones.mjs
 */
import { readFileSync } from 'node:fs';
import {
  ANNUAL_PRICE_EUR,
  ATHLETE_ANNUAL_EUR,
  ATHLETE_FIRST_YEAR_EUR,
  COACH_FIRST_YEAR_EUR,
} from '../lib/precios.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const doc = readFileSync('web/condiciones.html', 'utf8');
const inicio = readFileSync('web/index.html', 'utf8');
/** Solo el texto visible: los comentarios del HTML no los lee ningún cliente. */
const visible = doc.replace(/<!--[\s\S]*?-->/g, '');

console.log('\nExiste y se puede llegar a ella');
{
  ok('la página está', doc.length > 1000);
  ok('se enlaza desde el pie', /href="\/condiciones"/.test(inicio));
  // Y desde donde se decide pagar, que es donde la ley la quiere y donde de
  // verdad la mira alguien.
  const tarjetas = [...inicio.matchAll(/<article class="plan[^"]*"[\s\S]*?<\/article>/g)].map((m) => m[0]);
  ok('y desde las dos tarjetas de plan', tarjetas.length === 2 && tarjetas.every((t) => t.includes('/condiciones')));
  // Autocontenida, por lo mismo que privacidad.html: la abren revisores que
  // piden el HTML y no ejecutan nada.
  ok('sin depender de ningún fichero externo', !/<link[^>]+stylesheet|<script/i.test(doc));
}

console.log('\nEl derecho de desistimiento, dicho como hay que decirlo');
{
  // Las tres piezas. Con dos no vale: la renuncia solo se sostiene si el
  // consumidor PIDE el inicio inmediato y RECONOCE que por eso lo pierde.
  ok('menciona los 14 días', /14 días naturales/.test(visible));
  ok('pide el inicio inmediato', /solicitas expresamente que el servicio comience de inmediato/i.test(visible));
  ok(
    'y dice que por eso se pierde el derecho',
    /pierdes el derecho de desistimiento/i.test(visible)
  );
  // La salida para quien NO quiera renunciar. Sin ella la renuncia deja de ser
  // una elección, y una renuncia que no se puede rechazar no es una renuncia.
  ok('deja salida a quien prefiera conservarlo', /no aceptes el inicio inmediato/i.test(visible));
  ok('y aclara que al profesional no le aplica', /profesional o empresa/i.test(visible));
}

console.log('\nLo que se cobra es lo que dice lib/precios.ts');
{
  for (const [que, n] of [
    ['la cuota del atleta', ATHLETE_ANNUAL_EUR],
    ['el primer año del atleta', ATHLETE_FIRST_YEAR_EUR],
    ['la cuota del entrenador', ANNUAL_PRICE_EUR],
    ['el primer año del entrenador', COACH_FIRST_YEAR_EUR],
  ]) {
    ok(`${que} (${n} €)`, visible.includes(`${n} €`), 'no está escrito en las condiciones');
  }
  // Lo que más reclamaciones genera si no está dicho antes de cobrar.
  ok('avisa de que se renueva sola', /se renueva autom/i.test(visible));
  ok('y de que no se devuelve lo no consumido', /no se devuelve la parte del periodo no consumido/i.test(visible));
  ok('y de que cancelar no borra nada', /cancelar no borra nada/i.test(visible));
}

console.log('\nY no sale a la calle a medio rellenar');
{
  /*
   * El titular, su NIF y su domicilio los tiene que poner una persona: son
   * datos legales y no se pueden inventar.
   *
   * ESTO AVISA, NO TUMBA, y es una decisión pensada. Todos los guardianes se
   * ejecutan en cada push (verify.yml), así que dejar uno en rojo a propósito
   * pondría el repositorio entero en rojo durante días — y un rojo permanente
   * deja de mirarse a la semana, que es justo lo contrario de lo que hace
   * falta aquí.
   *
   * En cuanto el hueco se rellene, esto pasa a ser una comprobación normal y
   * dura: volver a dejarlo a medias sí tumbará el guardián.
   */
  const aMedias = /PENDIENTE/.test(visible);
  if (aMedias) {
    console.log('  ⚠ FALTA por rellenar: titular, NIF y domicilio (apartado 1)');
    console.log('    Hasta entonces, NO le des esta URL a Stripe como condiciones');
    console.log('    de servicio: publicar unas condiciones sin identificar a quién');
    console.log('    cobra es peor que no tenerlas.');
  } else {
    ok('los datos del titular están rellenos', true);
    // Y una vez puestos, que no vuelvan a irse.
    ok('con NIF', /\b[A-Z]?\d{7,8}[A-Z]\b/.test(visible), 'el apartado 1 no tiene un NIF reconocible');
  }
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
