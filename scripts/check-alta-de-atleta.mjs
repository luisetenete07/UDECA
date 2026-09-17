/*
 * Con qué nace una cuenta de atleta.
 *
 * EL FALLO QUE ESTE FICHERO EXISTE PARA QUE NO VUELVA
 *
 * El 11 de septiembre el modelo cambió: se acabó la prueba de 28 días y el
 * primer año se paga al entrar. El entrenador se actualizó —nace con
 * `subscriptionUntil: 0`— y el atleta NO: siguió naciendo con 28 días por
 * delante y con `trialEndsAt` puesto.
 *
 * No saltó nada. El muro de pago seguía saliendo (`needsEntryPayment` devuelve
 * cierto cuando el estado es de prueba), así que nadie entró gratis. Lo que se
 * rompió fue lo que se LEE:
 *
 *   - El panel de administración ponía "De prueba · hasta <fecha>" en todos los
 *     atletas nuevos, en vez de "SIN ACTIVAR". La lista dejó de decir quién ha
 *     pagado, que es para lo único que se mira.
 *   - La tarea diaria mandaba avisos de "se te acaba la prueba" por una prueba
 *     que ya no existe.
 *   - Y quedaba escrita una fecha de fin que nadie había comprado.
 *
 * Un fallo que solo se ve leyendo es el que más tarda en encontrarse. Por eso
 * esto se comprueba EJECUTANDO la función, no leyendo el fichero.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-alta-de-atleta.mjs
 */
import { readFileSync } from 'node:fs';
import {
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

console.log('\nUna cuenta nueva nace caducada');
{
  const nace = suscripcionAlNacer();
  ok('con la suscripción a cero', nace.subscriptionUntil === 0, String(nace.subscriptionUntil));
  // LO IMPORTANTE. `trialEndsAt` es lo que hace que la app diga "estás de
  // prueba" y que el cron mande avisos de prueba. Si vuelve, vuelve el fallo
  // entero sin que nada falle.
  ok('y sin marcarla como "de prueba"', !('trialEndsAt' in nace), JSON.stringify(nace));
}

console.log('\nY eso es lo que se lee en el panel de administración');
{
  const nuevo = { role: 'athlete', email: 'a@b.c', createdAt: Date.now(), ...suscripcionAlNacer() };
  const s = subscriptionState(nuevo);
  ok('no sale como activa', !s.active);
  ok('ni como de prueba', !s.trial);
  // `legacy` significa "cuenta de antes de que hubiera suscripciones", y sale
  // cuando NO hay `subscriptionUntil`. Un cero sí es un valor: sin él, una
  // cuenta nueva se pintaría como "Fundador".
  ok('ni como fundadora', !s.legacy, 'sin subscriptionUntil, el panel la llamaría Fundador');
  ok('y se le pide pagar', needsEntryPayment(nuevo));
}

console.log('\nLa prueba antigua sigue siendo prueba');
{
  // Las cuentas de antes conservan lo suyo: se les vendió una prueba y la
  // tienen. Cambiar las condiciones a mitad de partida es lo que no se hace.
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

console.log('\nY el registro escribe eso, no otra cosa');
{
  const auth = sinComentar(lee('lib/auth-context.tsx'));
  // Dos caminos crean atletas: el registro general por rol y `registerAthlete`.
  // Arreglar uno y olvidar el otro es lo que pasó la primera vez.
  const veces = (auth.match(/\.\.\.suscripcionAlNacer\(\)/g) || []).length;
  ok('los dos caminos de alta la usan', veces === 2, `aparece ${veces} vez/veces`);
  ok(
    'y ninguno reparte prueba por su cuenta',
    !/subscriptionUntil:\s*trialUntil\(\)/.test(auth) && !/trialEndsAt:\s*trialUntil\(\)/.test(auth),
    'vuelve a escribirse una prueba a mano'
  );
  // El entrenador ya lo hacía bien; que siga.
  ok('y el entrenador sigue naciendo a cero', /subscriptionUntil:\s*0,/.test(auth));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
