/*
 * Prueba del reparto de números de fundador, contra el emulador de Firestore.
 * Se ejecuta a mano; Vercel no la despliega (solo publica lo que hay en api/).
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_SERVICE_ACCOUNT="$(cat cuenta-de-prueba.json)" \
 *   node prueba-fundadores.mjs
 */
import admin from 'firebase-admin';
import { aplicarAlta } from './api/_alta.js';

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

/** Deja el mostrador como al principio y crea tres cuentas de prueba. */
async function preparar(campana) {
  await db.collection('config').doc('fundadores').delete().catch(() => {});
  if (campana) await db.collection('config').doc('fundadores').set(campana);
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
console.log('   f1 →', await altaDe('f1'), '(se espera null)');

console.log('\n2) Campaña creada pero cerrada');
await preparar({ abierta: false });
console.log('   f1 →', await altaDe('f1'), '(se espera null)');

console.log('\n3) Campaña abierta: números correlativos');
await preparar({ abierta: true });
console.log('   f1 →', await altaDe('f1'), '(se espera 1)');
console.log('   f2 →', await altaDe('f2'), '(se espera 2)');
console.log('   f3 →', await altaDe('f3'), '(se espera 3)');

console.log('\n4) El mismo vuelve a pagar: conserva su número');
await aplicarAlta(db, 'f1', { huella: null, customerId: null });
console.log('   f1 →', await numeroDe('f1'), '(se espera 1)');

console.log('\n5) Con tope de 2');
await preparar({ abierta: true, limite: 2 });
console.log('   f1 →', await altaDe('f1'), '(se espera 1)');
console.log('   f2 →', await altaDe('f2'), '(se espera 2)');
console.log('   f3 →', await altaDe('f3'), '(se espera null: pasado el tope)');

console.log('\n6) Diez altas a la vez: ningún número repetido');
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
console.log('   números:', nums.join(', '));
console.log('   ¿repetidos?', new Set(nums).size === nums.length ? 'no ✔' : 'SÍ ✖');

// Limpieza: esto escribe en la misma base que se usa para revisar la app.
for (const id of ['f1', 'f2', 'f3', ...muchos]) {
  await db.collection('users').doc(id).delete().catch(() => {});
}
await db.collection('config').doc('fundadores').delete().catch(() => {});
console.log('\n(cuentas de prueba y contador borrados)');
process.exit(0);
