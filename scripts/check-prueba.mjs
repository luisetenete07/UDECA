/**
 * El plazo de la cuenta: cuánto dura y cuándo se le habla de pagar.
 *
 * Son dos reglas que se rompen solas si nadie las mira, y las dos por el mismo
 * motivo: los días viven en sitios que no pueden importarse entre sí, y el
 * momento del aviso es una condición de una línea que cualquiera puede
 * "simplificar" sin saber lo que quita.
 *
 * EL PRIMER AÑO. Es lo que se compra al entrar, para los DOS roles. Lo escribe
 * `payments-webhook/api/_alta.js`, que se despliega aparte y no comparte código
 * con la app, así que el número está copiado de `lib/planBase.ts`. Si uno se
 * queda atrás no falla nada visible: simplemente la cuenta dura otra cosa
 * distinta de la que promete la web.
 *
 * LA PRUEBA VIEJA. Quedan cuentas con una prueba de 28 días en marcha y el tope
 * sigue escrito en `firestore.rules`, que rechaza el registro con "missing or
 * insufficient permissions" si la app pide más de la cuenta. Mientras quede una
 * sola, este número se comprueba igual.
 *
 * EL AVISO. El de pantalla completa sale UNA vez, el último día. No el día que
 * se crea la cuenta: ese día el atleta acaba de pagar su año y lo que ha
 * comprado es justamente doce meses sin que le pidan nada más. La tarjeta del
 * plan sigue en su perfil todo ese tiempo para quien la busque; lo que no puede
 * pasar es que le salte a la cara sin haber empezado.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-prueba.mjs
 */
import { readFileSync } from 'node:fs';
import {
  DAY_MS,
  DIAS_DE_PRUEBA_ENTRENADOR,
  PRIMER_ANO_DIAS,
  needsEntryPayment,
  subscriptionState,
  suscripcionAlNacer,
} from '../lib/planBase.ts';

const AHORA = Date.UTC(2026, 7, 15, 12, 0, 0);
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

console.log('\nSe entra pagando el primer año entero');
ok(`PRIMER_ANO_DIAS = ${PRIMER_ANO_DIAS}`, PRIMER_ANO_DIAS === 365, String(PRIMER_ANO_DIAS));

console.log('\nY el servidor escribe ese mismo año');
{
  const alta = lee('payments-webhook/api/_alta.js');
  ok(
    `_alta.js escribe ${PRIMER_ANO_DIAS} días`,
    new RegExp(`PRIMER_ANO_DIAS\\s*=\\s*${PRIMER_ANO_DIAS}\\b`).test(alta),
    'es quien fija la fecha de fin cuando entra el pago'
  );
  // El año es de los DOS. Cuando esto valía solo para el atleta, el entrenador
  // pagaba su alta y se quedaba sin `subscriptionUntil`: su cuenta entraba
  // caducada y veía el muro de pago con el año recién pagado.
  const bloque = alta.slice(alta.indexOf('const datos = {'), alta.indexOf("if (perfil.role === 'trainer'"));
  // El año contado a mano solo se usa cuando el pago NO es una suscripción
  // (las de antes). Con suscripción manda la fecha de fin que da Stripe, que
  // es la del cargo de verdad; calcularla aquí sería inventarse otro día.
  ok(
    'sin distinguir el rol',
    /if \(!suscripcion && !perfil\.entryPaidAt\) \{/.test(bloque) &&
      !bloque.includes("role === 'athlete'"),
    'el entrenador también compra su año al entrar'
  );
  // `trialEndsAt` es lo que hace que la app diga "estás de prueba" y que el
  // cron mande los avisos de prueba. Un año pagado no es una prueba.
  ok(
    'y sin marcar la cuenta como "de prueba"',
    !/datos\.trialEndsAt/.test(alta),
    'escribir trialEndsAt convertiría el año pagado en una prueba'
  );
}

console.log('\nLa prueba gratuita dura lo que toca');
{
  // Catorce: el "ajá" del entrenador es ver a un alumno suyo completar una
  // sesión, y para eso tiene que invitarlo, montarle la rutina y esperar.
  ok(`el entrenador tiene ${DIAS_DE_PRUEBA_ENTRENADOR} días`, DIAS_DE_PRUEBA_ENTRENADOR === 14);

  const nace = suscripcionAlNacer(AHORA);
  ok('nace con fecha de fin', nace.subscriptionUntil === AHORA + 14 * DAY_MS);
  /*
   * LAS DOS FECHAS IGUALES. Es lo que marca que es una prueba y no un año
   * pagado: `subscriptionState` mira si `subscriptionUntil <= trialEndsAt`. Si
   * se separaran al nacer, la cuenta saldría como pagada desde el primer día —
   * en el panel de administración y en los avisos— sin que nadie hubiera
   * pagado nada.
   */
  ok('y las dos fechas iguales', nace.subscriptionUntil === nace.trialEndsAt);
}

console.log('\nY durante la prueba NO sale el muro de pago');
{
  /*
   * ESTA ES LA LÍNEA QUE HACE QUE LA PRUEBA EXISTA.
   *
   * `needsEntryPayment` decía `!estado.active || estado.trial`, de cuando la
   * prueba venía detrás de un alta de 1 €. Con ese `|| estado.trial` puesto, la
   * cuenta nacería con sus catorce días y el muro seguiría delante desde el
   * primer segundo: la prueba no serviría de nada. Y no daría ningún error,
   * porque nacer con prueba y no poder usarla se ve igual que no tener prueba.
   */
  /*
   * Con el reloj de HOY, no con AHORA.
   *
   * `ENTRY_REQUIRED_FROM` exime a las cuentas anteriores al 3 de agosto de
   * 2026: con la fecha fija de este fichero (15 de agosto), una cuenta "de
   * hace trece días" nacía ANTES de ese corte y salía exenta por fundadora, no
   * por estar de prueba. La comprobación pasaba por el motivo equivocado, que
   * es peor que fallar.
   */
  const HOY = Date.now();
  const dePrueba = (role, diasPasados) => {
    const nacimiento = HOY - diasPasados * DAY_MS;
    return {
      uid: 'u1',
      role,
      name: 'X',
      email: 'x@demo.test',
      createdAt: nacimiento,
      ...suscripcionAlNacer(nacimiento),
    };
  };
  const muro = (p) => needsEntryPayment(p, HOY) || !subscriptionState(p, HOY).active;

  ok('entrenador el primer día', !muro(dePrueba('trainer', 0)));
  ok('entrenador a mitad de la prueba', !muro(dePrueba('trainer', 7)));
  ok('entrenador el último día', !muro(dePrueba('trainer', 13)));

  // Y cuando se acaba, sale. Una prueba que no termina no es una prueba.
  ok('al entrenador se le acaba a los 14', muro(dePrueba('trainer', 15)));
}

console.log('\nLas reglas de Firestore dejan nacer la prueba');
{
  const reglas = lee('firestore.rules');
  /*
   * ESTO HABRÍA ROTO EL REGISTRO ENTERO: un entrenador naciendo con sus 14
   * días sin la regla que lo admite se encuentra un "missing or insufficient
   * permissions" al crear la cuenta. No se ve probando la app: se ve
   * probándola contra ESTAS reglas. El margen de 2 días absorbe el desfase de
   * reloj del móvil.
   */
  ok(
    `y al entrenador en (${DIAS_DE_PRUEBA_ENTRENADOR} + 2) días`,
    reglas.includes(`(${DIAS_DE_PRUEBA_ENTRENADOR} + 2) * 24 * 60 * 60 * 1000`),
    'sin esto el entrenador no puede ni crearse la cuenta'
  );
  ok('y nombra al entrenador', /role == 'trainer'[\s\S]{0,120}subscriptionUntil/.test(reglas));
  // Y ya no hay prueba de atleta: ese papel no se puede ni crear.
  ok('no deja nacer otros roles', /role in \['trainer', 'client'\]/.test(reglas));
}

console.log('\nEl entrenador ve su contador');
ok('su panel lo pinta', /<TrialBanner profile=\{profile\} \/>/.test(lee('app/(trainer)/dashboard.tsx')));

console.log(fallos === 0 ? '\n✔ El plazo dura lo que dice y el aviso llega cuando toca' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
