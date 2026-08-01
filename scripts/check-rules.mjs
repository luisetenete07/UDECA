#!/usr/bin/env node
/**
 * Prueba de las reglas de Firestore contra el emulador.
 *
 * Existe por un fallo concreto: al pasar los cobros a fechas exactas, la app
 * empezó a escribir `billingAnchorDay` en el alumno, pero ese campo no estaba
 * en la lista de los que el entrenador puede tocar. Resultado: TODA
 * confirmación de cobro fallaba con "permisos insuficientes", y no se detectó
 * porque el emulador de desarrollo no cargaba las reglas.
 *
 * Comprueba las dos caras: que la app puede hacer lo que necesita, y que NO
 * puede hacer lo que no debe. Un permiso de más es tan fallo como uno de menos.
 *
 * Uso (con el emulador levantado y las reglas cargadas):
 *   node scripts/seed-emulator.mjs && node scripts/check-rules.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  deleteField,
} from 'firebase/firestore';

const HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
const app = initializeApp({ apiKey: 'demo', projectId: 'udeca-demo', appId: '1:1:web:1' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
connectFirestoreEmulator(db, HOST, 8080);

const PW = 'Demo1234';
let fallos = 0;

/** Ejecuta una escritura y comprueba si el resultado es el esperado. */
async function comprobar(descripcion, esperado, accion) {
  let permitido;
  try {
    await accion();
    permitido = true;
  } catch (e) {
    if (e.code !== 'permission-denied') throw e;
    permitido = false;
  }
  const bien = permitido === esperado;
  if (!bien) fallos++;
  const signo = bien ? '✔' : '✖';
  const real = permitido ? 'permitido' : 'rechazado';
  const quiero = esperado ? 'permitido' : 'rechazado';
  console.log(`  ${signo} ${descripcion}: ${real}${bien ? '' : ` (se esperaba ${quiero})`}`);
}

const coach = await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
const alumnos = await getDocs(
  query(collection(db, 'users'), where('trainerId', '==', coach.user.uid))
);
if (alumnos.empty) {
  console.error('✖ No hay alumnos sembrados. Ejecuta antes scripts/seed-emulator.mjs');
  process.exit(1);
}
const alumno = alumnos.docs[0];
console.log(`\n(alumno de prueba: ${alumno.data().name} / ${alumno.data().email})`);

/**
 * Un valor de ancla DISTINTO del que ya tiene el alumno.
 *
 * `affectedKeys()` compara el documento antes y después: escribir el mismo
 * valor que ya había no cuenta como cambio, así que la comprobación pasaría
 * aunque el campo estuviese prohibido. Con un valor nuevo, el campo entra
 * de verdad en el diff y la regla se pone a prueba.
 */
const anclaNueva = ((alumno.data().billingAnchorDay ?? 1) % 28) + 1;

console.log('\nEl entrenador sobre un alumno suyo');
await comprobar('confirmar un cobro (con billingAnchorDay)', true, () =>
  setDoc(
    doc(db, 'users', alumno.id),
    {
      paymentStatus: 'paid',
      nextPaymentDate: Date.now() + 30 * 86400000,
      billingAnchorDay: anclaNueva,
      paymentReportedAt: deleteField(),
    },
    { merge: true }
  )
);
await comprobar('cambiar la cuota mensual', true, () =>
  setDoc(
    doc(db, 'users', alumno.id),
    { monthlyFeeEur: (alumno.data().monthlyFeeEur ?? 0) + 1 },
    { merge: true }
  )
);
await comprobar('cambiarle el nombre', false, () =>
  setDoc(doc(db, 'users', alumno.id), { name: 'No debería' }, { merge: true })
);
await comprobar('regalarle suscripción', false, () =>
  setDoc(doc(db, 'users', alumno.id), { subscriptionUntil: Date.now() + 1e10 }, { merge: true })
);

console.log('\nEl entrenador sobre sí mismo');
await comprobar('regalarse suscripción', false, () =>
  setDoc(
    doc(db, 'users', coach.user.uid),
    { subscriptionUntil: Date.now() + 1e10 },
    { merge: true }
  )
);
await comprobar('falsear su recuento de alumnos', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { clientCount: 0 }, { merge: true })
);
await comprobar('cambiar su propio nombre', true, () =>
  setDoc(doc(db, 'users', coach.user.uid), { name: 'Luis Tena' }, { merge: true })
);

// El "otro alumno" tiene que ser DISTINTO del de prueba: si coincide, estaría
// escribiendo en su propio documento y la comprobación no probaría nada.
const otroEmail =
  alumno.data().email === 'alumno2@demo.test' ? 'alumno@demo.test' : 'alumno2@demo.test';
const otro = await signInWithEmailAndPassword(auth, otroEmail, PW);
console.log(`\nUn alumno (${otroEmail}) sobre OTRO alumno`);
await comprobar('marcarle como pagado', false, () =>
  setDoc(doc(db, 'users', alumno.id), { paymentStatus: 'paid' }, { merge: true })
);
await comprobar('quitarle el entrenador', false, () =>
  setDoc(doc(db, 'users', alumno.id), { trainerId: otro.user.uid }, { merge: true })
);

console.log(
  fallos === 0
    ? '\n✔ Todas las comprobaciones de reglas pasan.\n'
    : `\n✖ ${fallos} comprobación(es) de reglas han fallado.\n`
);
process.exit(fallos === 0 ? 0 : 1);
