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
  addDoc,
  deleteDoc,
  getDoc,
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
// El alta de 1 € da 5 plazas UNA vez; si el coach pudiera escribir este campo,
// se regalaría plazas y el control de multicuentas no valdría nada.
await comprobar('regalarse plazas de alumno', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { clientSlots: 999 }, { merge: true })
);
await comprobar('falsear la huella de su tarjeta', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { payerFingerprint: 'otra' }, { merge: true })
);
// Todo el muro de alta se sostiene sobre este campo: si la propia cuenta
// pudiera escribirlo, el euro sería voluntario y la tarjeta no se conocería.
await comprobar('darse el alta a sí mismo', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { entryPaidAt: Date.now() }, { merge: true })
);
// La tarjeta de fundador vale porque el número lo reparte el servidor: si se
// pudiera escribir, cualquiera sería el número 1.
await comprobar('nombrarse fundador', false, () =>
  setDoc(doc(db, 'users', coach.user.uid), { founderNumber: 1 }, { merge: true })
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

// El enlace del grupo privado puede vivir en `config/comunidad`. Si se pudiera
// leer desde la app, el formulario de la comunidad dejaría de ser una puerta.
await comprobar('leer los ajustes del servidor (config)', false, () =>
  getDoc(doc(db, 'config', 'comunidad'))
);

// Un alta pagada en la web queda apuntada a un correo. Si se pudiera leer o
// escribir desde la app, cualquiera se regalaría el euro o se llevaría la
// lista de correos de quien ha pagado.
await comprobar('leer las altas pagadas en la web', false, () =>
  getDoc(doc(db, 'entryPayments', 'loquesea'))
);
await comprobar('inventarse un alta pagada', false, () =>
  setDoc(doc(db, 'entryPayments', 'loquesea'), { email: 'yo@ejemplo.com', paidAt: Date.now() })
);

// Borrarse la cuenta exige poder llevarse el nombre de la clasificación.
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('borrar su propia ficha de la clasificación', true, () =>
  setDoc(doc(db, 'socialStats', otro.user.uid), {
    uid: otro.user.uid,
    trainerId: coach.user.uid,
    name: 'Prueba',
    updatedAt: Date.now(),
  }).then(() => deleteDoc(doc(db, 'socialStats', otro.user.uid)))
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);

console.log('\nEsfuerzo (RIR) y programación de la semana');
// El RIR se lo activa el ENTRENADOR a su alumno: si se lo pudiera activar (o
// quitar) el propio alumno, el dato dejaría de significar lo que el entrenador
// cree que significa.
await signInWithEmailAndPassword(auth, otroEmail, PW);
// Se prueba QUITÁRSELO, que es el caso que hace daño: si el alumno pudiera
// apagarlo, el entrenador seguiría creyendo que ese dato existe. (Ponerlo al
// valor que ya tiene no cambia nada, así que no probaría nada.)
await comprobar('el alumno NO se apaga el RIR que le puso su entrenador', false, () =>
  setDoc(doc(db, 'users', otro.user.uid), { trackRir: false }, { merge: true })
);
await comprobar('ni se lo borra del perfil', false, () =>
  setDoc(doc(db, 'users', otro.user.uid), { trackRir: deleteField() }, { merge: true })
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador SÍ se lo activa a su alumno', true, () =>
  setDoc(doc(db, 'users', alumno.id), { trackRir: true }, { merge: true })
);
await comprobar('pero no puede colar otra cosa de paso', false, () =>
  setDoc(
    doc(db, 'users', alumno.id),
    { trackRir: true, subscriptionUntil: Date.now() + 999999999 },
    { merge: true }
  )
);
await comprobar('programa la semana de SU alumno', true, () =>
  addDoc(collection(db, 'trainingCycles'), {
    trainerId: coach.user.uid,
    clientId: alumno.id,
    level: 'micro',
    name: 'Semana de prueba',
    weekPlan: [{ exerciseId: 'x', sets: 4, reps: '8' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
);
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('el alumno NO se programa su propia semana', false, () =>
  addDoc(collection(db, 'trainingCycles'), {
    trainerId: coach.user.uid,
    clientId: otro.user.uid,
    level: 'micro',
    name: 'La mía',
    weekPlan: [{ exerciseId: 'x', sets: 99 }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);

console.log('\nPlantillas de plan (planTemplates)');
// La plantilla es el método del entrenador. Ni sus alumnos ni otro entrenador
// tienen por qué verla: lo que el alumno necesita es SU plan, no el molde.
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
const plantilla = await addDoc(collection(db, 'planTemplates'), {
  trainerId: coach.user.uid,
  name: 'Mi método',
  blocks: [{ name: 'Bloque', weeks: [{ name: 'Semana 1', targetSessions: 4 }] }],
  createdAt: Date.now(),
});
await comprobar('el entrenador crea la suya', true, () => getDoc(plantilla));
await comprobar('no puede crearla a nombre de otro', false, () =>
  addDoc(collection(db, 'planTemplates'), {
    trainerId: 'otro-entrenador',
    name: 'Robada',
    blocks: [],
    createdAt: Date.now(),
  })
);
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('un alumno NO lee la plantilla de su entrenador', false, () =>
  getDoc(plantilla)
);
await comprobar('ni la borra', false, () => deleteDoc(plantilla));
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await deleteDoc(plantilla).catch(() => {});

console.log('\nTabla de progreso (progressTrackers)');
// Se limpia al final: esta prueba escribe en la misma base que usa la app para
// revisarla a mano, y dejar ejercicios inventados ahí ensucia la pantalla.
await comprobar('el alumno LEE su propia tabla', true, () =>
  getDoc(doc(db, 'progressTrackers', otro.user.uid))
);
await comprobar('el alumno NO puede escribir su tabla', false, () =>
  setDoc(
    doc(db, 'progressTrackers', otro.user.uid),
    { trainerId: otro.user.uid, clientId: otro.user.uid, exerciseIds: ['x'], updatedAt: Date.now() },
    { merge: true }
  )
);

await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);
await comprobar('el entrenador SÍ escribe la tabla de su alumno', true, () =>
  setDoc(
    doc(db, 'progressTrackers', alumno.id),
    {
      trainerId: coach.user.uid,
      clientId: alumno.id,
      exerciseIds: ['a', 'b'],
      updatedAt: Date.now(),
    },
    { merge: true }
  )
);

// Esta comprobación va AQUÍ y no antes: leer un documento que no existe está
// permitido a propósito (para que la pantalla cargue sin selección), así que
// solo prueba algo una vez el documento existe de verdad.
await signInWithEmailAndPassword(auth, otroEmail, PW);
await comprobar('un alumno NO lee la tabla de otro alumno', false, () =>
  getDoc(doc(db, 'progressTrackers', alumno.id))
);
await signInWithEmailAndPassword(auth, 'coach@demo.test', PW);

// Un documento con el dueño equivocado (de un fallo antiguo o de un cambio de
// entrenador) no puede quedar bloqueado: el entrenador actual lo recupera.
await comprobar('el entrenador recupera una tabla con dueño equivocado', true, () =>
  setDoc(
    doc(db, 'progressTrackers', alumno.id),
    { trainerId: coach.user.uid, exerciseIds: ['c'], updatedAt: Date.now() },
    { merge: true }
  )
);

// Deja la tabla como estaba: sin selección, que es el comportamiento por
// defecto (se muestran todos los ejercicios).
await deleteDoc(doc(db, 'progressTrackers', alumno.id)).catch(() => {});

console.log(
  fallos === 0
    ? '\n✔ Todas las comprobaciones de reglas pasan.\n'
    : `\n✖ ${fallos} comprobación(es) de reglas han fallado.\n`
);
process.exit(fallos === 0 ? 0 : 1);
