#!/usr/bin/env node
/**
 * Llena el emulador local de Firebase con un grupo de prueba realista: un
 * coach con tres alumnos, biblioteca de ejercicios, una rutina activa, tres
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
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

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
const atleta = await ensure('atleta@demo.test', 'Sara Vidal');

/**
 * Borra lo sembrado antes por esta cuenta.
 *
 * Sin esto cada ejecución AÑADÍA encima de la anterior: tras unas cuantas
 * había cientos de entrenos repetidos, los contadores subían solos y los
 * registros viejos (con el formato antiguo) convivían con los nuevos. Un guion
 * que dice "resetear el entorno" tiene que dejarlo como recién hecho.
 */
async function limpiar(nombreColeccion, campo, valor) {
  const snap = await getDocs(query(collection(db, nombreColeccion), where(campo, '==', valor)));
  for (const d of snap.docs) await deleteDoc(d.ref).catch(() => {});
  return snap.size;
}
const cli = await ensure('alumno@demo.test', 'Marcos Ruiz');
const cli2 = await ensure('alumno2@demo.test', 'Ana Gil');
// Tercer alumno: sin rutina ni historial, solo perfil y clasificación. Está
// para que el podio del mes pasado tenga de verdad un 1º, un 2º y un 3º.
const cli3 = await ensure('alumno3@demo.test', 'Iker Sanz');

await como('coach@demo.test');
// `subscriptionUntil` y `clientCount` SOLO se escriben al crear la cuenta: son
// campos del servidor y las reglas prohíben que el propio coach los cambie.
// Al resembrar sobre una base ya existente hay que dejarlos como están, o el
// guion muere con "permisos insuficientes" — que es la regla funcionando.
const coachExiste = (await getDoc(doc(db, 'users', coach))).exists();
await setDoc(
  doc(db, 'users', coach),
  {
    uid: coach, role: 'trainer', name: 'Luis Tena', email: 'coach@demo.test',
    createdAt: now - 200 * DAY, inviteCode: 'DEMO01', emailVerificationRequired: false,
    // Caducado a propósito: las reglas impiden regalarse suscripción al crear
    // la cuenta. Con tres alumnos entra igual por el plan gratuito (cinco
    // incluidos), que es justo el caso que interesa poder revisar.
    ...(coachExiste ? {} : { subscriptionUntil: 0, clientCount: 3, founderNumber: 7, founderSince: now - 30 * DAY }),
    // Al resembrar vuelve a salir el aviso del plan: cerrado una vez, no
    // habría forma de revisarlo hasta la semana siguiente.
    planPopupClosedAt: deleteField(),
  },
  { merge: true }
);
await setDoc(doc(db, 'trainerCodes', 'DEMO01'), { trainerId: coach, full: false });

const alumnos = [
  [cli, 'Marcos Ruiz', 'alumno@demo.test', 45, 4, 'paid'],
  [cli2, 'Ana Gil', 'alumno2@demo.test', 45, -3, 'pending'],
  [cli3, 'Iker Sanz', 'alumno3@demo.test', 40, 12, 'paid'],
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

// Limpieza previa: cada uno borra lo suyo (las reglas no dejan borrar lo
// ajeno). El orden importa: primero los entrenos de cada alumno, luego lo del
// entrenador.
await como('alumno@demo.test');
await limpiar('workoutLogs', 'clientId', cli);
await como('alumno2@demo.test');
await limpiar('workoutLogs', 'clientId', cli2);
await como('atleta@demo.test');
await limpiar('workoutLogs', 'clientId', atleta);
await limpiar('exercises', 'trainerId', atleta);
await limpiar('routines', 'trainerId', atleta);

await como('coach@demo.test');
await limpiar('exercises', 'trainerId', coach);
await limpiar('routines', 'trainerId', coach);
await limpiar('payments', 'trainerId', coach);
await limpiar('trainingCycles', 'trainerId', coach);

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

/**
 * Plan de entrenamiento del alumno: un macrociclo con dos bloques de cuatro
 * semanas (la última de cada uno, de descarga) y sus ocho microciclos.
 *
 * Arranca cinco semanas atrás para que el calendario tenga a la vez pasado,
 * semana en curso y futuro: es la única forma de ver de un vistazo si el
 * cumplimiento, la banda del bloque y la marca de "hoy" caen donde deben.
 */
{
  const lunesDe = (ts) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  const SEMANA = 7 * DAY;
  const inicio = lunesDe(now) - 5 * SEMANA;
  const bloques = [
    { nombre: 'Acumulación', semanas: 4, objetivo: 'Volumen y técnica' },
    { nombre: 'Intensificación', semanas: 4, objetivo: 'Más carga, menos series' },
  ];
  const totalSemanas = bloques.reduce((n, b) => n + b.semanas, 0);

  const macroRef = doc(collection(db, 'trainingCycles'));
  await setDoc(macroRef, {
    trainerId: coach, clientId: cli, level: 'macro', name: 'Temporada de otoño',
    startDate: inicio, endDate: inicio + totalSemanas * SEMANA - DAY,
    orderIndex: 1, goal: 'Muscle-up estricto por 3', targetSessions: 4 * totalSemanas,
    createdAt: now, updatedAt: now,
  });

  let cursor = inicio;
  for (const [bi, bloque] of bloques.entries()) {
    const mesoRef = doc(collection(db, 'trainingCycles'));
    await setDoc(mesoRef, {
      trainerId: coach, clientId: cli, level: 'meso', name: bloque.nombre,
      parentId: macroRef.id, orderIndex: bi + 1,
      startDate: cursor, endDate: cursor + bloque.semanas * SEMANA - DAY,
      goal: bloque.objetivo, targetSessions: 4 * bloque.semanas,
      createdAt: now, updatedAt: now,
    });
    for (let w = 0; w < bloque.semanas; w++) {
      const descarga = w === bloque.semanas - 1;
      await addDoc(collection(db, 'trainingCycles'), {
        trainerId: coach, clientId: cli, level: 'micro',
        name: `Semana ${w + 1}${descarga ? ' · descarga' : ''}`,
        parentId: mesoRef.id, orderIndex: w + 1,
        startDate: cursor + w * SEMANA, endDate: cursor + w * SEMANA + 6 * DAY,
        targetSessions: descarga ? 3 : 4,
        ...(descarga ? { isDeload: true } : {}),
        createdAt: now, updatedAt: now,
      });
    }
    cursor += bloque.semanas * SEMANA;
  }
}

// Los entrenos los registra el alumno, no el coach.
await como('alumno@demo.test');
for (let d = 1; d <= 22; d++) {
  if (d % 3 === 0) continue;
  await addDoc(collection(db, 'workoutLogs'), {
    clientId: cli, trainerId: coach, date: now - d * DAY,
    dayName: d % 2 ? 'Empuje' : 'Tirón', durationMin: 52 + (d % 9),
    exercises: ids.slice(0, 3).map((e) => ({
      exerciseId: e.id, name: e.name,
      // Las series van con `completed: true` y las marcas como TEXTO, que es
      // lo que escribe la app (ver LoggedSet). Sin `completed`, las tablas de
      // progreso las ignoran y la pantalla sale vacía con datos sembrados.
      sets: [
        { reps: String(6 + (d % 4)), weight: '0', completed: true },
        { reps: String(5 + (d % 3)), weight: '0', completed: true },
        { reps: '5', weight: '0', completed: true },
      ],
    })),
  });
}

/**
 * Clasificación del grupo.
 *
 * Los nombres de los campos son los que lee la app HOY (sessionsThisWeek,
 * currentStreak, streakThisMonth...). Los de la primera versión —weekWorkouts,
 * streak— ya no los mira nadie, así que sembrarlos dejaba el ranking a cero y
 * el podio del mes pasado sin salir nunca.
 *
 * `monthKey` y `weekKey` tienen que ser los de AHORA: la app da por caducadas
 * las métricas mensuales y semanales que no sean del periodo en curso.
 */
const mesActual = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();
const semanaActual = (() => {
  const d = new Date();
  const dia = d.getDay() === 0 ? 7 : d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dia + 1);
  return String(d.getTime());
})();
for (const [uid, name, email, semana, racha, mesPasado, total] of [
  [cli, 'Marcos Ruiz', 'alumno@demo.test', 4, 12, 18, 96],
  [cli2, 'Ana Gil', 'alumno2@demo.test', 3, 5, 21, 61],
  [cli3, 'Iker Sanz', 'alumno3@demo.test', 2, 3, 9, 24],
]) {
  await como(email);
  await setDoc(doc(db, 'socialStats', uid), {
    uid, name, trainerId: coach,
    sessionsThisWeek: semana, currentStreak: racha, streakThisMonth: racha,
    workoutsThisMonth: semana * 4, totalWorkouts: total,
    lastMonthStreak: mesPasado,
    monthKey: mesActual, weekKey: semanaActual, updatedAt: now,
  });
}
// ATLETA: se autoentrena (es su propio entrenador), con su plan y su
// historial. Sirve para revisar el caso en el que quien entrena manda sobre
// sus propias estadísticas.
await como('atleta@demo.test');
// La suscripción SOLO se escribe la primera vez: las reglas prohíben que uno
// se cambie la suya, así que al resembrar hay que dejarla como está o el
// guion falla con "permisos insuficientes". Es la regla haciendo su trabajo.
const yaExiste = (await getDoc(doc(db, 'users', atleta))).exists();
await setDoc(
  doc(db, 'users', atleta),
  {
    uid: atleta, role: 'athlete', name: 'Sara Vidal', email: 'atleta@demo.test',
    createdAt: now - 40 * DAY, trainerId: atleta, emailVerificationRequired: false,
    weightKg: 62.0, heightCm: 168, goal: 'Front lever', level: 'Intermedio',
    // Dentro de la prueba gratuita (las reglas no dejan pedir más de 14 días).
    ...(yaExiste ? {} : { subscriptionUntil: now + 10 * DAY, trialEndsAt: now + 10 * DAY }),
    planPopupClosedAt: deleteField(),
  },
  { merge: true }
);
const idsAtleta = [];
for (const [name, muscleGroup, measure] of [
  ['Dominadas', 'Tirón', 'reps'],
  ['Fondos', 'Empuje', 'reps'],
  ['Front lever', 'Core', 'seconds'],
]) {
  const r = await addDoc(collection(db, 'exercises'), {
    trainerId: atleta, name, muscleGroup, measure, createdAt: now,
  });
  idsAtleta.push({ id: r.id, name });
}
await addDoc(collection(db, 'routines'), {
  clientId: atleta, trainerId: atleta, name: 'Mi plan', active: true,
  createdAt: now - 30 * DAY, schedule: 'weekly',
  days: [
    { id: 'a1', name: 'Día A', weekday: 0, exercises: idsAtleta.map((e, i) => ({ id: 'x' + i, exerciseId: e.id, name: e.name, sets: 4, reps: '8', restSeconds: 120 })) },
  ],
});
for (let d = 1; d <= 12; d++) {
  if (d % 3 === 0) continue;
  await addDoc(collection(db, 'workoutLogs'), {
    clientId: atleta, trainerId: atleta, date: now - d * DAY,
    dayName: 'Día A', durationMin: 45,
    exercises: idsAtleta.slice(0, 2).map((e) => ({
      exerciseId: e.id, name: e.name,
      sets: [
        { reps: String(7 + (d % 3)), weight: '0', completed: true },
        { reps: '7', weight: '0', completed: true },
      ],
    })),
  });
}

await como('coach@demo.test');
// La selección de ejercicios de la tabla de progreso se borra al sembrar: es
// estado del entrenador, no datos de ejemplo, y arrastrarla entre siembras
// deja la pantalla enseñando ejercicios de una prueba anterior.
for (const uid of [cli, cli2]) {
  // Se comprueba antes de borrar: pedir el borrado de un documento que no
  // existe lo rechazan las reglas y el SDK lo escupe por consola, aunque el
  // error se capture. Menos ruido y misma consecuencia.
  if ((await getDoc(doc(db, 'progressTrackers', uid))).exists()) {
    await deleteDoc(doc(db, 'progressTrackers', uid)).catch(() => {});
  }
}

for (const dias of [10, 40, 70]) {
  await addDoc(collection(db, 'payments'), {
    trainerId: coach, clientId: cli, amountEur: 45, date: now - dias * DAY, createdAt: now - dias * DAY,
  });
}

console.log(`Emulador sembrado.
  coach@demo.test   (entrenador, 3 alumnos)
  alumno@demo.test  (alumno con rutina e historial)
  alumno2@demo.test (alumno con pago pendiente)
  alumno3@demo.test (alumno solo para la clasificación)
  atleta@demo.test  (atleta autoentrenado, en prueba gratuita)
  contraseña: ${PW}`);
process.exit(0);
