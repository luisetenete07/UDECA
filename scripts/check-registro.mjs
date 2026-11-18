/**
 * Crear una cuenta tiene que funcionar, y solo como lo que toca.
 *
 * Maestría en Calistenia es de un solo entrenador: quien se registra nace
 * ALUMNO, y una cuenta de entrenador solo la puede crear Luis con sus correos,
 * verificados. Aquí se prueba lo que hace la app DE VERDAD contra las reglas
 * DE VERDAD.
 *
 * Y con el reloj del móvil desajustado, que es lo normal: el registro fallaba
 * hace tiempo con "missing or insufficient permissions" porque una regla
 * comparaba una fecha del móvil con la del servidor al milímetro. Un alumno con
 * la hora mal puesta tiene que poder crearse la cuenta igual.
 *
 *   firebase emulators:start --project calico-demo --only auth,firestore
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-registro.mjs
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc } from 'firebase/firestore';

const AUTH_REST = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const DIA = 24 * 60 * 60 * 1000;
const PW = 'Demo1234';

const app = initializeApp({ apiKey: 'demo', projectId: 'calico-demo' });
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
 * No es limpieza por pulcritud: estas cuentas son de verdad, y se quedaban en
 * la lista de alumnos. Las pruebas que
 * pulsan "el primero de la lista" acababan tocando una cuenta inventada por
 * este guion en vez de la del seed, y fallaban sin que nada estuviera roto.
 */
const creadas = [];

/** Una cuenta nueva de verdad, como la que crea Google o Apple al entrar. */
async function cuentaNueva(correo) {
  const email = correo ?? `reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@demo.test`;
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

console.log('\nCrear cuenta: siempre alumno');

// --- Alumno ---
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({ uid, role: 'client', name: 'Alumno Nuevo', email, createdAt: Date.now() });
  ok('un alumno puede crear su perfil', r.permitido, r.error);
}

// --- Entrenador que no es Luis ---
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({ uid, role: 'trainer', name: 'Coach Nuevo', email, createdAt: Date.now() });
  ok('nadie más puede crearse como entrenador', !r.permitido);
}

// --- Luis, con su correo verificado ---
{
  /*
   * El emulador no verifica correos solo: se marca como verificado con la
   * llamada de administración y se vuelve a entrar para que el token lo lleve.
   * Es lo que tiene la cuenta real de Luis, que entra con Google.
   */
  const correo = 'luisetenete07@gmail.com';
  const { uid, email } = await cuentaNueva(correo);
  await fetch(`${AUTH_REST}/projects/calico-demo/accounts:update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  });
  await signInWithEmailAndPassword(auth, email, PW);
  await auth.currentUser.getIdToken(true);
  const r = await intenta({ uid, role: 'trainer', name: 'Luis Tena', email, createdAt: Date.now() });
  ok('Luis, con su correo verificado, sí', r.permitido, r.error);
}

console.log('\nY con el reloj del móvil desajustado (que es lo normal)');

/**
 * Los desfases que se ven en la vida real. Un móvil con la hora automática
 * baila segundos; uno al que le han tocado la hora a mano, minutos u horas.
 * Ninguno de estos casos puede impedir que alguien se cree la cuenta.
 */
for (const [texto, desfase] of [
  ['un segundo adelantado', 1000],
  ['una hora adelantada', 60 * 60 * 1000],
  ['un día atrasado', -DIA],
]) {
  const { uid, email } = await cuentaNueva();
  const r = await intenta({ uid, role: 'client', name: 'Alumno Nuevo', email, createdAt: Date.now() + desfase });
  ok(`el alumno entra con el reloj ${texto}`, r.permitido, r.error);
}

console.log('\nLo que sigue sin poderse hacer');

// El atleta que se entrenaba solo ya no existe: no se puede crear.
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({ uid, role: 'athlete', name: 'Atleta', email, createdAt: Date.now() });
  ok('ya no se puede crear un atleta', !r.permitido);
}
// Ni nacer con entrenador: ese vínculo lo pone el entrenador al aceptar.
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({
    uid,
    role: 'client',
    name: 'Colado',
    email,
    createdAt: Date.now(),
    trainerId: 'otro-entrenador',
  });
  ok('un alumno no nace dentro de un grupo sin que le acepten', !r.permitido);
}
// Ni con tiempo de suscripción: la app ya no cobra, y ese campo no significa
// nada en una cuenta nueva.
{
  const { uid, email } = await cuentaNueva();
  const r = await intenta({
    uid,
    role: 'client',
    name: 'Listillo',
    email,
    createdAt: Date.now(),
    subscriptionUntil: Date.now() + 365 * DIA,
  });
  ok('nadie nace con suscripción', !r.permitido);
}

// --- A recoger ---
for (const { uid, idToken } of creadas) {
  await fetch(
    `http://127.0.0.1:8080/v1/projects/calico-demo/databases/(default)/documents/users/${uid}`,
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
