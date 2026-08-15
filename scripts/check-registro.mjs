/**
 * Crear una cuenta tiene que funcionar. Las tres, siempre.
 *
 * POR QUÉ ESTA COMPROBACIÓN EXISTE
 *
 * El registro de atleta fallaba con "missing or insufficient permissions" de
 * forma intermitente, y el motivo es de los que no se ven leyendo el código:
 *
 *   - La app calcula el fin de la prueba con el reloj DEL MÓVIL:
 *     `Date.now() + 14 días`.
 *   - La regla lo comprueba con el reloj DEL SERVIDOR:
 *     `<= request.time + 14 días`.
 *
 * Si el móvil va un segundo adelantado —y los relojes de los móviles van
 * adelantados o atrasados constantemente— el valor que llega es MAYOR que el
 * tope, y Firestore rechaza la escritura. El usuario ve un error incomprensible
 * al crear su cuenta, y no puede entrar. Que dependa del reloj del móvil hace
 * además que falle a unos sí y a otros no, que es lo que lo hacía tan difícil
 * de reproducir.
 *
 * Aquí se prueba lo que hace la app DE VERDAD contra las reglas DE VERDAD, con
 * los tres roles, y además con un reloj adelantado a propósito: si alguien
 * vuelve a ajustar el margen de la regla al milímetro, esto lo caza.
 *
 * Da igual si se entró con Google o con Apple: a partir del `signIn`, las dos
 * escriben exactamente el mismo perfil por el mismo camino
 * (`completarPerfilDeGoogle` en lib/auth-context). Lo que se prueba aquí es ese
 * camino, que es donde estaba el fallo.
 *
 *   firebase emulators:start --project udeca-demo --only auth,firestore
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-registro.mjs
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';
// De planBase y no de subscription: ese lee Platform.OS y arrastra React
// Native entera, que en Node pelado no arranca.
import { TRIAL_DAYS, trialUntil } from '../lib/planBase.ts';

const AUTH_REST = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const DIA = 24 * 60 * 60 * 1000;
const PW = 'Demo1234';

const app = initializeApp({ apiKey: 'demo', projectId: 'udeca-demo' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

/**
 * Lo que esta comprobación va creando, para poder borrarlo al terminar.
 *
 * No es limpieza por pulcritud: estas cuentas son atletas y entrenadores de
 * verdad, y se quedaban en el panel de administración del CEO. Las pruebas que
 * pulsan "el primero de la lista" acababan tocando una cuenta inventada por
 * este guion en vez de la del seed, y fallaban sin que nada estuviera roto.
 */
const creadas = [];

/** Una cuenta nueva de verdad, como la que crea Google o Apple al entrar. */
async function cuentaNueva() {
  const email = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@demo.test`;
  await fetch(`${AUTH_REST}/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW, returnSecureToken: true }),
  });
  const cred = await signInWithEmailAndPassword(auth, email, PW);
  creadas.push({ uid: cred.user.uid, idToken: await cred.user.getIdToken() });
  return { uid: cred.user.uid, email };
}

/** Intenta escribir el perfil y dice si las reglas lo dejaron. */
async function intenta(perfil) {
  try {
    await setDoc(doc(db, 'users', perfil.uid), perfil);
    return { permitido: true };
  } catch (e) {
    if (e.code !== 'permission-denied') throw e;
    return { permitido: false, error: e.message };
  }
}

console.log('\nCrear cuenta: los tres roles');

// --- Alumno ---
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({ uid, role: 'client', name: 'Alumno Nuevo', email, createdAt: Date.now() });
  ok('un alumno puede crear su perfil', r.permitido, r.error);
}

// --- Entrenador ---
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({
    uid,
    role: 'trainer',
    name: 'Coach Nuevo',
    email,
    createdAt: Date.now(),
    inviteCode: 'ABC123',
    subscriptionUntil: 0,
  });
  ok('un entrenador puede crear su perfil', r.permitido, r.error);
}

// --- Atleta, con el reloj en hora ---
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({
    uid,
    role: 'athlete',
    name: 'Atleta Nuevo',
    email,
    createdAt: Date.now(),
    trainerId: uid,
    subscriptionUntil: trialUntil(),
    trialEndsAt: trialUntil(),
  });
  ok('un atleta puede crear su perfil con su prueba', r.permitido, r.error);
}

console.log('\nY con el reloj del móvil desajustado (que es lo normal)');

/**
 * Los desfases que se ven en la vida real. Un móvil con la hora automática
 * baila segundos; uno al que le han tocado la hora a mano, minutos u horas.
 * Ninguno de estos casos puede impedir que alguien se cree la cuenta.
 */
for (const [texto, desfase] of [
  ['un segundo adelantado', 1000],
  ['un minuto adelantado', 60 * 1000],
  ['una hora adelantada', 60 * 60 * 1000],
  ['medio día adelantado', 12 * 60 * 60 * 1000],
  ['un día atrasado', -DIA],
]) {
  const { uid, email } = await cuentaNueva();
  const r = await intenta({
    uid,
    role: 'athlete',
    name: 'Atleta Nuevo',
    email,
    createdAt: Date.now() + desfase,
    trainerId: uid,
    subscriptionUntil: trialUntil(Date.now() + desfase),
    trialEndsAt: trialUntil(Date.now() + desfase),
  });
  ok(`el atleta entra con el reloj ${texto}`, r.permitido, r.error);
}

console.log('\nLo que sigue sin poderse hacer');

// El margen es para el reloj, no para regalarse meses de prueba.
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({
    uid,
    role: 'athlete',
    name: 'Listillo',
    email,
    createdAt: Date.now(),
    trainerId: uid,
    subscriptionUntil: Date.now() + 365 * DIA,
  });
  ok('un atleta NO se regala un año de prueba', !r.permitido);
}
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({
    uid,
    role: 'athlete',
    name: 'Listillo',
    email,
    createdAt: Date.now(),
    trainerId: uid,
    subscriptionUntil: Date.now() + (TRIAL_DAYS + 7) * DIA,
  });
  ok('ni una semana de más', !r.permitido);
}
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({
    uid,
    role: 'trainer',
    name: 'Listillo',
    email,
    createdAt: Date.now(),
    inviteCode: 'ABC123',
    subscriptionUntil: Date.now() + 365 * DIA,
  });
  ok('un entrenador NO se regala la suscripción anual', !r.permitido);
}

// --- A recoger ---
for (const { uid, idToken } of creadas) {
  await fetch(
    `http://127.0.0.1:8080/v1/projects/udeca-demo/databases/(default)/documents/users/${uid}`,
    { method: 'DELETE', headers: { Authorization: 'Bearer owner' } }
  ).catch(() => {});
  await fetch(`${AUTH_REST}/accounts:delete?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  }).catch(() => {});
}

console.log(fallos === 0 ? '\n✔ Crear cuenta funciona' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
