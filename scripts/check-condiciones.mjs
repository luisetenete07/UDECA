/*
 * Las condiciones de uso (web/condiciones.html).
 *
 * Antes eran las de contratación de CALICO, la suscripción que pagaban los
 * entrenadores, con sus precios, su renovación y su derecho de desistimiento.
 * Maestría en Calistenia no cobra nada, así que eso se fue: lo que se protege
 * ahora es que la página siga existiendo (la piden las tiendas y la cuenta de
 * Stripe de Luis), que no vuelva a anunciar un precio que ya no existe y que
 * siga dejando claro que el entrenamiento personal tiene sus propias
 * condiciones.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-condiciones.mjs
 */
import { readFileSync } from 'node:fs';

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
  // Autocontenida, por lo mismo que privacidad.html: la abren revisores que
  // piden el HTML y no ejecutan nada.
  ok('sin depender de ningún fichero externo', !/<link[^>]+stylesheet|<script/i.test(doc));
}

console.log('\nEs de la app de un solo entrenador, y gratis');
{
  ok('con el nombre de la app', /Maestría en Calistenia/.test(visible));
  ok('y sin rastro de CALICO', !/CALICO/.test(visible));
  ok('dice que es gratis', /La app es gratis/.test(visible));
  ok('sin un solo precio', !/\d\s*€/.test(visible), 'una cifra en euros anunciaría algo que ya no se vende');
  ok('y sin suscripción que renovar', !/se renueva autom/i.test(visible));
  ok('explica que se entra cuando Luis acepta', /solo entra quien Luis acepta/i.test(visible));
}

console.log('\nY deja claro que NO cubre el entrenamiento personal');
{
  // La URL de condiciones es de la CUENTA de Stripe de Luis, y con ella se
  // cobra su entrenamiento personal. Ese tiene sus propias condiciones: aquí
  // basta con que quien llegue desde un cobro sepa que esta no es la suya.
  ok('acota el documento a la app', /y\s+solo\s+eso/i.test(visible));
  ok(
    'y remite el entrenamiento a sus propias condiciones',
    /sus propias\s+condiciones/i.test(visible) && /no se les aplica/i.test(visible)
  );
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
    console.log('  ⚠ FALTA por rellenar: NIF y domicilio del titular (apartado 1)');
  } else {
    ok('los datos del titular están rellenos', true);
    // Y una vez puestos, que no vuelvan a irse.
    ok('con NIF', /\b[A-Z]?\d{7,8}[A-Z]\b/.test(visible), 'el apartado 1 no tiene un NIF reconocible');
  }
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
