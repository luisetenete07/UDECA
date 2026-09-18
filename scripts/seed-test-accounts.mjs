#!/usr/bin/env node
/**
 * Crea las tres cuentas de prueba de UDECA (coach, atleta y alumno) listas para
 * usar: correo ya verificado, alumno ya dentro del grupo del coach y código de
 * invitación creado. Evita la ronda de registrarse tres veces, abrir tres
 * correos de verificación y aprobar la solicitud a mano cada vez que hace falta
 * un entorno limpio.
 *
 * Es idempotente: si las cuentas ya existen las reescribe al estado inicial en
 * vez de fallar. Sirve tanto para crearlas como para "resetear" el entorno.
 *
 * NO se despliega ni se llama desde la app: se ejecuta a mano desde tu equipo.
 * Crear cuentas es una operación privilegiada y no debe existir un endpoint
 * público que lo haga.
 *
 * Uso:
 *   npm i firebase-admin          (si no lo tienes ya en el equipo)
 *   GOOGLE_APPLICATION_CREDENTIALS=/ruta/al/serviceAccount.json \
 *     node scripts/seed-test-accounts.mjs
 *
 * Opcional:
 *   SEED_EMAIL_BASE=otro@gmail.com   (por defecto udeca.app@gmail.com)
 *   SEED_PASSWORD=otracosa           (si no, se genera una y se imprime)
 *
 * Los correos se generan con "+etiqueta" sobre la cuenta de UDECA
 * (udeca.app+coach@gmail.com…): Gmail los entrega todos a esa misma bandeja y
 * Firebase los trata como cuentas distintas. Cero cuentas de Google nuevas.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
// Copia de lib/planBase.ts: este script corre con `node` pelado, sin el gancho
// que sabe leer TypeScript, así que no puede importarlo. Si cambia allí, aquí
// también.
const PRIMER_ANO_DIAS = 365;
/**
 * Contraseña de las cuentas de prueba.
 *
 * NO se escribe ninguna por defecto ni se imprime la generada: este repositorio
 * es público, y tanto el código como los registros de GitHub Actions los puede
 * leer cualquiera. Una contraseña fija junto a unos correos predecibles sería
 * una invitación a entrar en las cuentas.
 *
 * Sin SEED_PASSWORD se pone una aleatoria que nadie conoce, y se entra usando
 * "¿Has olvidado tu contraseña?" desde la app: el aviso llega a la bandeja del
 * correo base y la contraseña la eliges tú, sin pasar por ningún registro.
 */
const PASSWORD = process.env.SEED_PASSWORD || randomPassword();

function randomPassword() {
  const abc = 'abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'udeca-';
  for (let i = 0; i < 12; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
}
const EMAIL_BASE = process.env.SEED_EMAIL_BASE || 'udeca.app@gmail.com';
const INVITE_CODE = 'TEST01';

/** udeca.app@gmail.com + "coach" -> udeca.app+coach@gmail.com */
function taggedEmail(tag) {
  const [user, domain] = EMAIL_BASE.split('@');
  if (!domain) throw new Error(`SEED_EMAIL_BASE no es un correo válido: ${EMAIL_BASE}`);
  return `${user}+${tag}@${domain}`;
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(`
✖ Falta GOOGLE_APPLICATION_CREDENTIALS.

Descarga la clave privada en Firebase Console → Configuración del proyecto →
Cuentas de servicio → Generar nueva clave privada, y ejecuta:

  GOOGLE_APPLICATION_CREDENTIALS=/ruta/al/fichero.json node scripts/seed-test-accounts.mjs

Ese JSON es una credencial: no lo subas al repo (ya está en .gitignore).
`);
  process.exit(1);
}

// Import diferido: así los avisos de arriba salen antes de que Node se queje
// de que falta el paquete, que es lo que confunde cuando ejecutas esto por
// primera vez.
//
// Se usan los sub-módulos (firebase-admin/app, /auth, /firestore) y no el
// import por defecto: en las versiones nuevas del paquete ese objeto ya no
// expone `credential`, y el script petaba con "Cannot read properties of
// undefined". Esta forma es la misma en todas las versiones recientes.
let initializeApp, applicationDefault, getAuth, getFirestore;
try {
  ({ initializeApp, applicationDefault } = await import('firebase-admin/app'));
  ({ getAuth } = await import('firebase-admin/auth'));
  ({ getFirestore } = await import('firebase-admin/firestore'));
} catch {
  console.error(`
✖ Falta el paquete firebase-admin. Instálalo con:

  npm i --no-save firebase-admin
`);
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

/** Crea el usuario de Auth o lo reutiliza si ya existe, siempre verificado. */
async function ensureUser(email, name) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password: PASSWORD,
      displayName: name,
      emailVerified: true,
    });
    return existing.uid;
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    const created = await auth.createUser({
      email,
      password: PASSWORD,
      displayName: name,
      // Verificado de entrada: la app bloquea hasta verificar y aquí no
      // queremos pasar por la bandeja de entrada.
      emailVerified: true,
    });
    return created.uid;
  }
}

/**
 * Borra lo que sembró una ejecución anterior, para poder repetir sin duplicar.
 *
 * Por campo y no por marca propia: así también se lleva lo que haya creado a
 * mano quien estuviera probando con estas cuentas, que es justo lo que ensucia
 * una demo.
 */
async function limpiar(coleccion, campo, valor) {
  const snap = await db.collection(coleccion).where(campo, '==', valor).get();
  for (const d of snap.docs) await d.ref.delete();
}

/**
 * CONTENIDO DE VERDAD EN LAS CUENTAS DE DEMOSTRACIÓN.
 *
 * Lo pidió Apple por escrito al rechazar la 1.1.2 (norma 2.1(a)): "make sure
 * the demo accounts you provide include pre-populated content so that we can
 * verify all the features in the app".
 *
 * Y tenían razón: hasta ahora este script creaba las tres cuentas vacías. Quien
 * entraba se encontraba una biblioteca sin ejercicios, un alumno sin rutina, un
 * historial sin entrenos y unos ingresos a cero. Con todo en blanco no hay
 * forma de comprobar ninguna función, porque no hay ninguna función que mirar:
 * solo pantallas de "aún no hay nada".
 *
 * No es contenido bonito, es contenido SUFICIENTE: lo mínimo para que cada
 * pantalla importante tenga algo que enseñar.
 */
async function sembrarContenido({ now, coachUid, clientUid, athleteUid }) {
  const DIA = DAY_MS;

  for (const uid of [coachUid, athleteUid]) {
    await limpiar('exercises', 'trainerId', uid);
    await limpiar('routines', 'trainerId', uid);
    await limpiar('mealBooks', 'trainerId', uid);
    await limpiar('payments', 'trainerId', uid);
  }
  for (const uid of [clientUid, athleteUid]) {
    await limpiar('workoutLogs', 'clientId', uid);
  }

  // La biblioteca del coach. Con vídeo: sin él no hay "Ver técnica" que probar.
  const EJERCICIOS = [
    ['Dominadas', 'Tirón', 'reps'],
    ['Fondos en paralelas', 'Empuje', 'reps'],
    ['Flexiones arqueras', 'Empuje', 'reps'],
    ['Front lever', 'Core', 'seconds'],
    ['Plancha', 'Core', 'seconds'],
    ['Muscle up', 'Tirón', 'combo'],
  ];
  const ids = [];
  for (const [name, muscleGroup, measure] of EJERCICIOS) {
    const ref = db.collection('exercises').doc();
    await ref.set({
      trainerId: coachUid,
      name,
      muscleGroup,
      measure,
      createdAt: now,
      muscles: ['lats', 'biceps'],
      description: 'Técnica estricta, sin balanceo.',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    ids.push({ id: ref.id, name });
  }

  // La rutina del alumno, con dos días de trabajo y uno de descanso.
  const dia = (id, name, intensity, trozo, reps, descanso) => ({
    id,
    name,
    intensity,
    exercises: trozo.map((e, i) => ({
      id: `${id}-${i}`,
      exerciseId: e.id,
      name: e.name,
      sets: 4,
      reps,
      restSeconds: descanso,
      rir: 2,
    })),
  });
  await db.collection('routines').add({
    clientId: clientUid,
    trainerId: coachUid,
    name: 'Bloque de fuerza',
    active: true,
    createdAt: now - 30 * DIA,
    schedule: 'cycle',
    days: [
      dia('d1', 'Empuje', 7, ids.slice(1, 3), '8', 120),
      dia('d2', 'Tirón', 8, [ids[0], ids[5]], '6', 150),
      { id: 'd3', name: 'Descanso', isRest: true, exercises: [] },
    ],
  });

  /*
   * Entrenos ya registrados, repartidos hacia atrás.
   *
   * Sin historial, el progreso, las estadísticas, los récords y el informe en
   * PDF salen todos vacíos: son media app, y son justo las pantallas por las
   * que se paga. Doce sesiones dan para que las gráficas tengan forma.
   */
  for (let i = 1; i <= 12; i++) {
    const cuando = now - i * 2 * DIA;
    const usados = i % 2 === 0 ? ids.slice(1, 3) : [ids[0], ids[5]];
    await db.collection('workoutLogs').add({
      clientId: clientUid,
      trainerId: coachUid,
      date: cuando,
      createdAt: cuando,
      dayName: i % 2 === 0 ? 'Empuje' : 'Tirón',
      durationMin: 45 + (i % 3) * 10,
      exercises: usados.map((e) => ({
        exerciseId: e.id,
        name: e.name,
        sets: [1, 2, 3].map((n) => ({ reps: String(6 + n + (i % 3)), weightKg: 0 })),
      })),
    });
  }

  // Cobros: para que la sección de ingresos del inicio tenga algo que enseñar.
  for (let i = 0; i < 3; i++) {
    await db.collection('payments').add({
      trainerId: coachUid,
      clientId: clientUid,
      amountEur: 45,
      date: now - i * 30 * DIA,
      createdAt: now - i * 30 * DIA,
    });
  }

  // Una libreta de comidas con un comentario, que es función nueva y no se
  // puede revisar si no hay ninguna.
  await db.collection('mealBooks').add({
    trainerId: coachUid,
    title: 'Desayunos',
    order: 0,
    createdAt: now,
    updatedAt: now,
    photos: [
      {
        id: 'f1',
        imageURL:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        caption: '120 g de avena con dos claras. El plátano, antes de entrenar.',
      },
    ],
  });

  // La cuota del alumno, para que salgan los cobros pendientes y el próximo.
  await db.collection('users').doc(clientUid).set(
    {
      monthlyFeeEur: 45,
      paymentStatus: 'paid',
      nextPaymentDate: now + 12 * DIA,
      billingAnchorDay: new Date(now + 12 * DIA).getDate(),
    },
    { merge: true }
  );

  // Y el atleta, con su propia biblioteca y algo de historial: su cuenta es la
  // otra mitad del producto y también se revisa.
  const suyos = [];
  for (const [name, muscleGroup, measure] of EJERCICIOS.slice(0, 3)) {
    const ref = db.collection('exercises').doc();
    await ref.set({
      trainerId: athleteUid,
      name,
      muscleGroup,
      measure,
      createdAt: now,
      description: 'Mi técnica.',
    });
    suyos.push({ id: ref.id, name });
  }
  await db.collection('routines').add({
    clientId: athleteUid,
    trainerId: athleteUid,
    name: 'Mi plan',
    active: true,
    createdAt: now - 20 * DIA,
    schedule: 'cycle',
    days: [dia('a1', 'Día 1', 7, suyos.slice(0, 2), '10', 90), { id: 'a2', name: 'Descanso', isRest: true, exercises: [] }],
  });
  for (let i = 1; i <= 6; i++) {
    const cuando = now - i * 3 * DIA;
    await db.collection('workoutLogs').add({
      clientId: athleteUid,
      trainerId: athleteUid,
      date: cuando,
      createdAt: cuando,
      dayName: 'Día 1',
      durationMin: 40,
      exercises: suyos.slice(0, 2).map((e) => ({
        exerciseId: e.id,
        name: e.name,
        sets: [1, 2, 3].map((n) => ({ reps: String(8 + n), weightKg: 0 })),
      })),
    });
  }
}

async function main() {
  const now = Date.now();

  const coachEmail = taggedEmail('coach');
  const athleteEmail = taggedEmail('atleta');
  const clientEmail = taggedEmail('alumno');

  const coachUid = await ensureUser(coachEmail, 'Coach de prueba');
  const athleteUid = await ensureUser(athleteEmail, 'Atleta de prueba');
  const clientUid = await ensureUser(clientEmail, 'Alumno de prueba');

  // COACH: con su primer año pagado, que es lo que compra quien entra.
  //
  // Antes nacía con la suscripción a 0 y entraba igual, porque el plan gratuito
  // cubría hasta cinco alumnos. Con el modelo del primer año eso ya no vale: una
  // cuenta de entrenador sin año pagado ve el muro, y esta es la cuenta que se
  // le entrega a quien revisa la app en Apple y en Google. Un revisor que se
  // encuentra un muro de pago rechaza la versión, y con razón.
  await db.collection('users').doc(coachUid).set({
    uid: coachUid,
    role: 'trainer',
    name: 'Coach de prueba',
    email: coachEmail,
    createdAt: now,
    inviteCode: INVITE_CODE,
    emailVerificationRequired: false,
    entryPaidAt: now,
    subscriptionUntil: now + PRIMER_ANO_DIAS * DAY_MS,
    // CON PLAN ANUAL, y no es un detalle. Es lo que mira `planIlimitado`: sin
    // él, la cuenta arrastra el tope de alumnos y, sobre todo, al abrir el
    // inicio le salta al revisor el aviso a pantalla completa de "pasa al plan
    // sin tope". Un revisor al que lo primero que le sale es una venta se lleva
    // otra impresión de la app, y puede no saber cerrarlo.
    subscriptionPlan: 'annual',
    clientCount: 1,
  });
  await db.collection('trainerCodes').doc(INVITE_CODE).set({
    trainerId: coachUid,
    full: false,
  });

  // ATLETA: es su propio entrenador y entra con su primer año pagado.
  await db.collection('users').doc(athleteUid).set({
    uid: athleteUid,
    role: 'athlete',
    name: 'Atleta de prueba',
    email: athleteEmail,
    createdAt: now,
    trainerId: athleteUid,
    emailVerificationRequired: false,
    entryPaidAt: now,
    subscriptionUntil: now + PRIMER_ANO_DIAS * DAY_MS,
  });

  // ALUMNO: ya vinculado al coach, sin pasar por solicitud ni aprobación.
  await db.collection('users').doc(clientUid).set({
    uid: clientUid,
    role: 'client',
    name: 'Alumno de prueba',
    email: clientEmail,
    createdAt: now,
    trainerId: coachUid,
    emailVerificationRequired: false,
  });
  // Por si quedó una solicitud de una ejecución anterior.
  await db.collection('joinRequests').doc(`${clientUid}_${coachUid}`).delete();

  await sembrarContenido({ now, coachUid, clientUid, athleteUid });

  console.log(`
✔ Cuentas de prueba listas

  Coach    ${coachEmail}
  Atleta   ${athleteEmail}
  Alumno   ${clientEmail}   (ya en el grupo del coach)

  Código de invitación del coach: ${INVITE_CODE}

  Las tres cuentas llevan CONTENIDO: biblioteca de ejercicios con vídeo,
  rutina asignada, 12 entrenos registrados, tres cobros y una libreta de
  comidas con comentario. Es lo que pidió Apple al rechazar la 1.1.2 por la
  norma 2.1(a): sin contenido no hay función que se pueda comprobar.
${
  process.env.SEED_PASSWORD
    ? '\n  Contraseña: la que has indicado.'
    : `
  CONTRASEÑA: no se muestra a propósito. Este script suele ejecutarse desde
  GitHub Actions y, en un repositorio público, esos registros los puede leer
  cualquiera. Para entrar, usa "¿Has olvidado tu contraseña?" en la pantalla de
  acceso con cada uno de los correos de arriba: los tres avisos llegan a la
  bandeja de ${EMAIL_BASE} y eliges tú la contraseña.`
}

Vuelve a ejecutar esto cuando quieras dejar las cuentas como estaban.
`);
}

main().catch((e) => {
  console.error('✖ Error:', e.message);
  process.exit(1);
});
