#!/usr/bin/env node
/**
 * Llena el emulador local de Firebase con un grupo de prueba realista: un
 * coach con dos alumnos, biblioteca de ejercicios, una rutina activa, tres
 * semanas de entrenos, cobros y clasificación social.
 *
 * Sirve para abrir la app CON DATOS y revisarla pantalla por pantalla sin
 * tocar la base de datos real. Usa el SDK cliente que ya trae el proyecto, así
 * que no hace falta instalar nada.
 *
 * Uso:
 *   1) Arranca el emulador (una vez instalado firebase-tools):
 *        npx firebase-tools@13 emulators:start --project udeca-demo --only auth,firestore
 *   2) Siembra los datos:
 *        node scripts/seed-emulator.mjs
 *   3) Compila la app apuntando al emulador y sírvela:
 *        EXPO_PUBLIC_FIREBASE_EMULATOR=1 EXPO_PUBLIC_FIREBASE_API_KEY=demo \
 *        EXPO_PUBLIC_FIREBASE_PROJECT_ID=udeca-demo EXPO_PUBLIC_FIREBASE_APP_ID=1:1:web:1 \
 *        npx expo export --platform web --clear && npx serve -s dist -l 4599
 *
 * La marca EXPO_PUBLIC_FIREBASE_EMULATOR solo se pone a mano en este flujo: los
 * builds de tienda y el despliegue web nunca la llevan, así que no hay forma de
 * que una versión publicada acabe hablando con un Firebase de mentira.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, addDoc, collection } from 'firebase/firestore';

const app = initializeApp({ apiKey: 'demo', projectId: 'udeca-demo', appId: '1:1:web:1' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const DAY = 86400000;
const now = Date.now();
export const PW = 'Demo1234';

async function ensure(email, name) {
  try {
    const c = await createUserWithEmailAndPassword(auth, email, PW);
    return c.user.uid;
  } catch {
    const c = await signInWithEmailAndPassword(auth, email, PW);
    return c.user.uid;
  }
}

/**
 * Se entra con cada cuenta antes de escribir SUS datos.
 *
 * El emulador carga las reglas de verdad (firestore.rules), así que sembrar
 * "desde fuera" ya no vale: cada documento tiene que escribirlo quien tendría
 * permiso para escribirlo en producción. Es más incómodo, pero convierte la
 * siembra en una prueba de las reglas: si el guion pasa, las reglas permiten
 * lo que la app necesita hacer de verdad.
 */
async function como(email) {
  await signInWithEmailAndPassword(auth, email, PW);
}

const coach = await ensure('coach@demo.test', 'Luis Tena');
const cli = await ensure('alumno@demo.test', 'Marcos Ruiz');
const cli2 = await ensure('alumno2@demo.test', 'Ana Gil');

await como('coach@demo.test');
await setDoc(doc(db, 'users', coach), {
  uid: coach, role: 'trainer', name: 'Luis Tena', email: 'coach@demo.test',
  createdAt: now - 200 * DAY, inviteCode: 'DEMO01', emailVerificationRequired: false,
  // Caducado a propósito: las reglas impiden regalarse suscripción al crear la
  // cuenta. Con 2 alumnos entra igual por el plan gratuito, que es justo el
  // caso que interesa poder revisar.
  subscriptionUntil: 0, clientCount: 2,
});
await setDoc(doc(db, 'trainerCodes', 'DEMO01'), { trainerId: coach, full: false });

const alumnos = [
  [cli, 'Marcos Ruiz', 'alumno@demo.test', 45, 4, 'paid'],
  [cli2, 'Ana Gil', 'alumno2@demo.test', 45, -3, 'pending'],
];
for (const [uid, name, email, fee, dias, estado] of alumnos) {
  const due = now + dias * DAY;
  await como(email);
  await setDoc(doc(db, 'users', uid), {
    uid, role: 'client', name, email, createdAt: now - 120 * DAY, trainerId: coach,
    emailVerificationRequired: false, monthlyFeeEur: fee, paymentStatus: estado,
    nextPaymentDate: due, billingAnchorDay: new Date(due).getDate(),
    weightKg: 74.5, heightCm: 178, goal: 'Muscle up estricto', level: 'Intermedio',
  });
}

await como('coach@demo.test');
const EJ = [
  ['Dominadas', 'Tirón', 'reps'], ['Fondos en paralelas', 'Empuje', 'reps'],
  ['Front lever', 'Core', 'seconds'], ['Muscle up', 'Tirón', 'combo'],
  ['Flexiones arqueras', 'Empuje', 'reps'], ['Plancha', 'Core', 'seconds'],
];
const ids = [];
for (const [name, muscleGroup, measure] of EJ) {
  const r = await addDoc(collection(db, 'exercises'), {
    trainerId: coach, name, muscleGroup, measure, createdAt: now,
    muscles: ['lats', 'biceps'], description: 'Técnica estricta, sin balanceo.',
  });
  ids.push({ id: r.id, name });
}

await addDoc(collection(db, 'routines'), {
  clientId: cli, trainerId: coach, name: 'Bloque de fuerza', active: true,
  createdAt: now - 30 * DAY, schedule: 'cycle',
  days: [
    { id: 'd1', name: 'Empuje', intensity: 7, exercises: ids.slice(0, 3).map((e, i) => ({ id: 'e' + i, exerciseId: e.id, name: e.name, sets: 4, reps: '8', restSeconds: 120, rir: 2 })) },
    { id: 'd2', name: 'Tirón', intensity: 8, exercises: ids.slice(3).map((e, i) => ({ id: 'f' + i, exerciseId: e.id, name: e.name, sets: 4, reps: '6', restSeconds: 150, rir: 1 })) },
    { id: 'd3', name: 'Descanso', isRest: true, exercises: [] },
  ],
});

// Los entrenos los registra el alumno, no el coach.
await como('alumno@demo.test');
for (let d = 1; d <= 22; d++) {
  if (d % 3 === 0) continue;
  await addDoc(collection(db, 'workoutLogs'), {
    clientId: cli, trainerId: coach, date: now - d * DAY,
    dayName: d % 2 ? 'Empuje' : 'Tirón', durationMin: 52 + (d % 9),
    exercises: ids.slice(0, 3).map((e) => ({
      exerciseId: e.id, name: e.name,
      sets: [{ reps: 8, weightKg: 0 }, { reps: 7, weightKg: 0 }, { reps: 6, weightKg: 0 }],
    })),
  });
}

for (const [uid, name, email, week, streak, total] of [
  [cli, 'Marcos Ruiz', 'alumno@demo.test', 4, 12, 96],
  [cli2, 'Ana Gil', 'alumno2@demo.test', 3, 5, 61],
]) {
  await como(email);
  await setDoc(doc(db, 'socialStats', uid), {
    uid, name, trainerId: coach, weekWorkouts: week, streak, totalWorkouts: total,
    weekKey: 'demo', updatedAt: now,
  });
}
await como('coach@demo.test');
for (const dias of [10, 40, 70]) {
  await addDoc(collection(db, 'payments'), {
    trainerId: coach, clientId: cli, amountEur: 45, date: now - dias * DAY, createdAt: now - dias * DAY,
  });
}

console.log(`Emulador sembrado.
  coach@demo.test   (entrenador, 2 alumnos)
  alumno@demo.test  (alumno con rutina e historial)
  alumno2@demo.test (alumno con pago pendiente)
  contraseña: ${PW}`);
process.exit(0);
