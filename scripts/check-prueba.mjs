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
  DIAS_DE_PRUEBA_ATLETA,
  DIAS_DE_PRUEBA_ENTRENADOR,
  PRIMER_ANO_DIAS,
  TRIAL_DAYS,
  needsEntryPayment,
  subscriptionState,
  suscripcionAlNacer,
  tocaElAvisoDelAtleta,
  trialUntil,
} from '../lib/planBase.ts';

const AHORA = Date.UTC(2026, 7, 15, 12, 0, 0);
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

/** Un atleta que empezó su prueba hace `dias` días. */
const atleta = (dias, extra = {}) => {
  const fin = trialUntil(AHORA - dias * DAY_MS);
  return {
    uid: 'at1',
    role: 'athlete',
    name: 'Sara',
    email: 'sara@demo.test',
    createdAt: AHORA - dias * DAY_MS,
    entryPaidAt: AHORA - dias * DAY_MS,
    subscriptionUntil: fin,
    trialEndsAt: fin,
    ...extra,
  };
};

console.log('\nSe entra pagando el primer año entero');
ok(`PRIMER_ANO_DIAS = ${PRIMER_ANO_DIAS}`, PRIMER_ANO_DIAS === 365, String(PRIMER_ANO_DIAS));

console.log('\nY el servidor escribe ese mismo año, para los dos roles');
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

console.log('\nLa prueba gratuita dura lo que toca a cada uno');
{
  ok(`el entrenador tiene ${DIAS_DE_PRUEBA_ENTRENADOR} días`, DIAS_DE_PRUEBA_ENTRENADOR === 14);
  ok(`el atleta tiene ${DIAS_DE_PRUEBA_ATLETA} días`, DIAS_DE_PRUEBA_ATLETA === 7);
  // El doble para el entrenador no es generosidad: su "ajá" es ver a un alumno
  // suyo completar una sesión, y para eso tiene que invitarlo, montarle la
  // rutina y esperar a que entrene.
  ok('y el entrenador tiene más que el atleta', DIAS_DE_PRUEBA_ENTRENADOR > DIAS_DE_PRUEBA_ATLETA);

  const nace = suscripcionAlNacer('trainer', AHORA);
  ok('nace con fecha de fin', nace.subscriptionUntil === AHORA + 14 * DAY_MS);
  /*
   * LAS DOS FECHAS IGUALES. Es lo que marca que es una prueba y no un año
   * pagado: `subscriptionState` mira si `subscriptionUntil <= trialEndsAt`. Si
   * se separaran al nacer, la cuenta saldría como pagada desde el primer día —
   * en el panel de administración y en los avisos— sin que nadie hubiera
   * pagado nada.
   */
  ok('y las dos fechas iguales', nace.subscriptionUntil === nace.trialEndsAt);
  ok('el atleta, siete', suscripcionAlNacer('athlete', AHORA).subscriptionUntil === AHORA + 7 * DAY_MS);
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
      ...suscripcionAlNacer(role, nacimiento),
    };
  };
  const muro = (p) => needsEntryPayment(p, HOY) || !subscriptionState(p, HOY).active;

  ok('entrenador el primer día', !muro(dePrueba('trainer', 0)));
  ok('entrenador a mitad de la prueba', !muro(dePrueba('trainer', 7)));
  ok('entrenador el último día', !muro(dePrueba('trainer', 13)));
  ok('atleta el primer día', !muro(dePrueba('athlete', 0)));
  ok('atleta el último día', !muro(dePrueba('athlete', 6)));

  // Y cuando se acaba, sale. Una prueba que no termina no es una prueba.
  ok('al entrenador se le acaba a los 14', muro(dePrueba('trainer', 15)));
  ok('al atleta a los 7', muro(dePrueba('athlete', 8)));
}

console.log('\nLas reglas de Firestore dejan nacer las dos pruebas');
{
  const reglas = lee('firestore.rules');
  /*
   * ESTO HABRÍA ROTO EL REGISTRO ENTERO. La regla solo admitía prueba al
   * ATLETA, así que un entrenador naciendo con sus 14 días se encontraba un
   * "missing or insufficient permissions" al crear la cuenta. No se ve
   * probando la app: se ve probándola contra ESTAS reglas.
   */
  ok(
    `topa al atleta en (${DIAS_DE_PRUEBA_ATLETA} + 2) días`,
    reglas.includes(`(${DIAS_DE_PRUEBA_ATLETA} + 2) * 24 * 60 * 60 * 1000`),
    'el margen de 2 días absorbe el desfase de reloj del móvil'
  );
  ok(
    `y al entrenador en (${DIAS_DE_PRUEBA_ENTRENADOR} + 2) días`,
    reglas.includes(`(${DIAS_DE_PRUEBA_ENTRENADOR} + 2) * 24 * 60 * 60 * 1000`),
    'sin esto el entrenador no puede ni crearse la cuenta'
  );
  ok('y nombra al entrenador', /role == 'trainer'[\s\S]{0,120}subscriptionUntil/.test(reglas));
}

console.log('\nY los DOS roles ven su contador');
{
  /*
   * El atleta era el único que no se enteraba: el entrenador tenía el contador
   * en su panel desde siempre y en el del atleta no lo pintaba nadie. Con
   * siete días de prueba eso es usar la app una semana y encontrarse el muro
   * una mañana, sin aviso. `TrialBanner` ya servía para los dos —lee el perfil
   * y el estado, no el rol—: solo faltaba ponerlo.
   */
  for (const panel of ['app/(trainer)/dashboard.tsx', 'app/(client)/dashboard.tsx']) {
    ok(`${panel} lo pinta`, /<TrialBanner profile=\{profile\} \/>/.test(lee(panel)));
  }
}

console.log('\nLa prueba vieja sigue durando lo mismo donde queda escrita');
// Quedan cuentas con una prueba de 28 días en marcha: hay que saber leerlas.
ok(`TRIAL_DAYS = ${TRIAL_DAYS}`, TRIAL_DAYS === 28, String(TRIAL_DAYS));

console.log('\nEl aviso a pantalla completa NO sale al crear la cuenta');
ok('recién dado de alta', !tocaElAvisoDelAtleta(atleta(0), AHORA));
ok('a los tres días', !tocaElAvisoDelAtleta(atleta(3), AHORA));
ok('a mitad de la prueba', !tocaElAvisoDelAtleta(atleta(Math.floor(TRIAL_DAYS / 2)), AHORA));
ok('faltando una semana', !tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 7), AHORA));
ok('faltando tres días', !tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 3), AHORA));
ok('faltando dos días', !tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 2), AHORA));

console.log('\nSale el último día, que es cuando hay algo que decidir');
ok('faltando un día', tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 1), AHORA));
ok('faltando unas horas', tocaElAvisoDelAtleta(atleta(TRIAL_DAYS - 0.2), AHORA));

console.log('\nY a quien no le toca, no le sale nunca');
ok(
  'al atleta que ya paga',
  !tocaElAvisoDelAtleta(
    atleta(TRIAL_DAYS - 1, { subscriptionUntil: AHORA + 300 * DAY_MS }),
    AHORA
  )
);
ok(
  'al entrenador (su tope son plazas, no días)',
  !tocaElAvisoDelAtleta({ ...atleta(TRIAL_DAYS - 1), role: 'trainer' }, AHORA)
);
ok(
  'al alumno de un coach (no paga plataforma)',
  !tocaElAvisoDelAtleta({ ...atleta(TRIAL_DAYS - 1), role: 'client' }, AHORA)
);
ok('sin perfil', !tocaElAvisoDelAtleta(null, AHORA));

console.log('\nY la pantalla usa esta misma regla, no una copia suya');
{
  const tarjeta = lee('components/UpgradeCard.tsx');
  ok(
    'UpgradePopup llama a tocaElAvisoDelAtleta',
    /esAtleta\s*&&\s*!tocaElAvisoDelAtleta\(profile\)/.test(tarjeta),
    'si esto se quita, el aviso vuelve a saltar el primer día'
  );
  // El cuerpo de UpgradeCard, sin el de UpgradePopup ni los comentarios que
  // los separan: entre las dos funciones está la constante del descanso.
  const cuerpoTarjeta = tarjeta.slice(
    tarjeta.indexOf('export function UpgradeCard('),
    tarjeta.indexOf('const CADA_CUANTO_MS')
  );
  ok(
    'la tarjeta del perfil no lleva esa condición',
    cuerpoTarjeta.length > 0 && !cuerpoTarjeta.includes('tocaElAvisoDelAtleta'),
    'en el perfil tiene que estar disponible todo el plazo'
  );
}

console.log(fallos === 0 ? '\n✔ El plazo dura lo que dice y el aviso llega cuando toca' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
