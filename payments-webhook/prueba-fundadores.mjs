/*
 * Prueba del reparto de números de fundador, contra el emulador de Firestore.
 * Vercel no la despliega (solo publica lo que hay en api/).
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node payments-webhook/prueba-fundadores.mjs
 *
 * Contra el emulador no hacen falta credenciales; si se le pasa un
 * FIREBASE_SERVICE_ACCOUNT, se usa.
 */
import admin from 'firebase-admin';
import { aplicarAlta } from './api/_alta.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Falta FIRESTORE_EMULATOR_HOST. Esto NO se ejecuta contra la base de verdad.');
  process.exit(1);
}

admin.initializeApp(
  process.env.FIREBASE_SERVICE_ACCOUNT
    ? { credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) }
    : { projectId: process.env.GCLOUD_PROJECT || 'udeca-demo' }
);
const db = admin.firestore();

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

/** Los dos mostradores: uno por tipo de cuenta. */
const DOCS = ['fundadores', 'fundadoresAtletas'];

/**
 * Deja los dos mostradores como al principio y crea tres cuentas de prueba.
 *
 * `campana` es para la serie de ATLETAS, que es el rol de las cuentas de
 * prueba; `campanaCoach` para la de entrenadores, cuando el caso la necesita.
 */
async function preparar(campana, campanaCoach) {
  for (const d of DOCS) await db.collection('config').doc(d).delete().catch(() => {});
  if (campana) await db.collection('config').doc('fundadoresAtletas').set(campana);
  if (campanaCoach) await db.collection('config').doc('fundadores').set(campanaCoach);
  for (const id of ['f1', 'f2', 'f3']) {
    await db.collection('users').doc(id).set({
      uid: id,
      role: 'athlete',
      name: id.toUpperCase(),
      email: `${id}@demo.test`,
      createdAt: Date.now(),
    });
  }
}

async function numeroDe(id) {
  const s = await db.collection('users').doc(id).get();
  return s.data()?.founderNumber ?? null;
}

async function altaDe(id) {
  await aplicarAlta(db, id, { huella: null, customerId: null });
  return numeroDe(id);
}

console.log('\n1) Campaña sin crear (aún no la ha abierto nadie)');
await preparar(null);
ok('no se reparte número', (await altaDe('f1')) === null);

console.log('\n2) Campaña creada pero cerrada');
await preparar({ abierta: false });
ok('sigue sin repartirse', (await altaDe('f1')) === null);

console.log('\n3) Campaña abierta: números correlativos');
await preparar({ abierta: true });
ok('el primero es el 1', (await altaDe('f1')) === 1);
ok('el segundo, el 2', (await altaDe('f2')) === 2);
ok('el tercero, el 3', (await altaDe('f3')) === 3);

console.log('\n4) El mismo vuelve a pagar: conserva su número');
await aplicarAlta(db, 'f1', { huella: null, customerId: null });
ok('sigue siendo el 1', (await numeroDe('f1')) === 1);

console.log('\n5) Con tope de 2');
await preparar({ abierta: true, limite: 2 });
ok('el 1 entra', (await altaDe('f1')) === 1);
ok('el 2 entra', (await altaDe('f2')) === 2);
ok('el tercero se queda fuera', (await altaDe('f3')) === null);

/*
 * 6) Las dos series van por separado.
 *
 * Es la razón de que haya dos mostradores. Con uno solo, el primer atleta que
 * llegaba se encontraba con un #0043 porque antes se habían dado de alta
 * cuarenta y dos entrenadores: el número dejaba de decir "fuiste de los
 * primeros" para decir "llegaste tarde".
 */
console.log('\n6) Entrenadores y atletas, cada uno con su serie');
await preparar({ abierta: true }, { abierta: true });
await db.collection('users').doc('c1').set({
  uid: 'c1', role: 'trainer', name: 'C1', email: 'c1@demo.test', createdAt: Date.now(),
});
ok('el primer entrenador es el 1', (await altaDe('c1')) === 1);
ok('y el primer atleta TAMBIÉN es el 1', (await altaDe('f1')) === 1);
ok('el segundo atleta es el 2, no el 3', (await altaDe('f2')) === 2);

console.log('\n7) Cada campaña se abre por su cuenta');
// La de atletas cerrada, la de entrenadores abierta.
await preparar({ abierta: false }, { abierta: true });
await db.collection('users').doc('c1').set({
  uid: 'c1', role: 'trainer', name: 'C1', email: 'c1@demo.test', createdAt: Date.now(),
});
ok('el entrenador recibe su número', (await altaDe('c1')) === 1);
ok('y el atleta no, porque la suya está cerrada', (await altaDe('f1')) === null);

console.log('\n8) Diez altas a la vez: ningún número repetido');
await preparar({ abierta: true });
const muchos = Array.from({ length: 10 }, (_, i) => `p${i}`);
for (const id of muchos) {
  await db.collection('users').doc(id).set({
    uid: id, role: 'athlete', name: id, email: `${id}@demo.test`, createdAt: Date.now(),
  });
}
await Promise.all(muchos.map((id) => aplicarAlta(db, id, {})));
const nums = [];
for (const id of muchos) nums.push(await numeroDe(id));
nums.sort((a, b) => a - b);
ok('ninguno repetido', new Set(nums).size === nums.length, nums.join(', '));
ok('y del 1 al 10, sin saltos', nums.join(',') === '1,2,3,4,5,6,7,8,9,10', nums.join(', '));

// Limpieza: esto escribe en la misma base que se usa para revisar la app.
for (const id of ['f1', 'f2', 'f3', 'c1', ...muchos]) {
  await db.collection('users').doc(id).delete().catch(() => {});
}
for (const d of DOCS) await db.collection('config').doc(d).delete().catch(() => {});

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
