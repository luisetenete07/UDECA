/*
 * Con qué nace una cuenta nueva, y que los CUATRO caminos digan lo mismo.
 *
 * EL FALLO QUE ESTE FICHERO EXISTE PARA QUE NO VUELVA
 *
 * El 11 de septiembre el modelo cambió y el atleta no se enteró: el entrenador
 * pasó a nacer con `subscriptionUntil: 0` y el atleta siguió naciendo con 28
 * días de prueba de un modelo que ya no se vendía.
 *
 * No saltó nada. El muro de pago seguía saliendo, así que nadie entró gratis.
 * Lo que se rompió fue lo que se LEE: el panel de administración ponía "De
 * prueba · hasta <fecha>" en vez de "SIN ACTIVAR", la tarea diaria mandaba
 * avisos de una prueba inexistente, y quedaba escrita una fecha de fin que
 * nadie había comprado. Una semana así, sin un solo error.
 *
 * AHORA HAY PRUEBA DE VERDAD, y el riesgo se ha dado la vuelta: lo que no
 * puede pasar es que una cuenta nazca SIN ella. Se vería igual de bien —una
 * cuenta caducada es una pantalla de pago perfectamente pintada— y el usuario
 * simplemente no podría usar nada.
 *
 * SON CUATRO CAMINOS, no dos: entrenador y atleta, cada uno por proveedor
 * (Google/Apple) y por correo. Antes dos usaban la función y los otros dos
 * escribían el cero a mano. Arreglar unos y olvidar los otros es exactamente
 * lo que pasó la primera vez.
 *
 * Se comprueba EJECUTANDO la función, no leyendo el fichero: un fallo que solo
 * se ve leyendo es el que más tarda en encontrarse.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-alta-de-cuenta.mjs
 */
import { readFileSync } from 'node:fs';
import {
  DAY_MS,
  DIAS_DE_PRUEBA_ATLETA,
  DIAS_DE_PRUEBA_ENTRENADOR,
  PRIMER_ANO_DESDE,
  TRIAL_DAYS,
  conModeloDePrimerAno,
  needsEntryPayment,
  subscriptionState,
  suscripcionAlNacer,
  trialUntil,
} from '../lib/planBase.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');
const sinComentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const HOY = Date.now();

console.log('\nUna cuenta nueva nace con su prueba');
{
  for (const [rol, dias] of [
    ['trainer', DIAS_DE_PRUEBA_ENTRENADOR],
    ['athlete', DIAS_DE_PRUEBA_ATLETA],
  ]) {
    const nace = suscripcionAlNacer(rol, HOY);
    ok(`${rol}: ${dias} días`, nace.subscriptionUntil === HOY + dias * DAY_MS);
    /*
     * LAS DOS FECHAS IGUALES. Es lo único que distingue una prueba de un año
     * pagado: `subscriptionState` mira si `subscriptionUntil <= trialEndsAt`.
     * Separadas al nacer, la cuenta saldría como PAGADA desde el primer día en
     * el panel de administración, sin que nadie hubiera pagado.
     */
    ok(`${rol}: las dos fechas iguales`, nace.subscriptionUntil === nace.trialEndsAt);
  }
}

console.log('\nY eso es lo que se lee en el panel de administración');
{
  for (const rol of ['trainer', 'athlete']) {
    const nuevo = { role: rol, email: 'a@b.c', createdAt: HOY, ...suscripcionAlNacer(rol, HOY) };
    const s = subscriptionState(nuevo, HOY);
    ok(`${rol}: sale como activa`, s.active);
    ok(`${rol}: y como de prueba`, s.trial, 'el panel tiene que poder distinguir prueba de pagado');
    // `legacy` significa "cuenta anterior a las suscripciones". Una cuenta de
    // hoy pintada como "Fundador" sería una cuenta que no se le cobra nunca.
    ok(`${rol}: y no como fundadora`, !s.legacy);
    /*
     * LA LÍNEA QUE HACE QUE LA PRUEBA EXISTA. `needsEntryPayment` decía
     * `!estado.active || estado.trial`, de cuando la prueba iba detrás de un
     * alta de 1 €. Con ese `|| estado.trial`, la cuenta nacería con sus días y
     * el muro seguiría delante desde el primer segundo: la prueba no serviría
     * de nada, y no daría ningún error.
     */
    ok(`${rol}: y NO se le pide pagar todavía`, !needsEntryPayment(nuevo, HOY));
  }
}

console.log('\nPero la prueba se acaba');
{
  for (const [rol, dias] of [
    ['trainer', DIAS_DE_PRUEBA_ENTRENADOR],
    ['athlete', DIAS_DE_PRUEBA_ATLETA],
  ]) {
    const nacimiento = HOY - (dias + 1) * DAY_MS;
    const caducado = {
      role: rol,
      email: 'a@b.c',
      createdAt: nacimiento,
      ...suscripcionAlNacer(rol, nacimiento),
    };
    ok(`${rol}: al día siguiente se le pide pagar`, needsEntryPayment(caducado, HOY));
    ok(`${rol}: y deja de estar activa`, !subscriptionState(caducado, HOY).active);
  }
}

console.log('\nLa prueba antigua sigue siendo prueba');
{
  // Las cuentas de antes conservan lo suyo: se les vendió una prueba de 28
  // días y la tienen. Cambiar las condiciones a mitad de partida no se hace.
  const viejo = {
    role: 'athlete',
    email: 'v@b.c',
    createdAt: PRIMER_ANO_DESDE - 1,
    subscriptionUntil: trialUntil(),
    trialEndsAt: trialUntil(),
  };
  ok('sigue contando como prueba', subscriptionState(viejo).trial);
  ok('y con acceso', subscriptionState(viejo).active);
  ok('y no se rige por el modelo nuevo', !conModeloDePrimerAno(viejo));
  ok(`los ${TRIAL_DAYS} días siguen definidos para ellas`, TRIAL_DAYS === 28);
}

console.log('\nY los cuatro caminos de alta escriben eso, no otra cosa');
{
  const auth = sinComentar(lee('lib/auth-context.tsx'));
  /*
   * CUATRO: entrenador y atleta, cada uno por proveedor y por correo. La
   * primera vez, dos usaban la función y dos escribían el valor a mano; se
   * arreglaron los que se miraron.
   */
  const conRol = (rol) => (auth.match(new RegExp(`\\.\\.\\.suscripcionAlNacer\\('${rol}'\\)`, 'g')) || []).length;
  ok('dos caminos crean entrenadores', conRol('trainer') === 2, `aparece ${conRol('trainer')} vez/veces`);
  ok('dos caminos crean atletas', conRol('athlete') === 2, `aparece ${conRol('athlete')} vez/veces`);
  // Ni a mano, ni a cero. Un `subscriptionUntil: 0` suelto es una cuenta que
  // nace caducada: se ve perfecta y no deja usar nada.
  ok(
    'y ninguno reparte plazo por su cuenta',
    !/subscriptionUntil:\s*(0|trialUntil\()/.test(auth) && !/trialEndsAt:\s*trialUntil\(/.test(auth),
    'vuelve a escribirse un plazo a mano'
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
