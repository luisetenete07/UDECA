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
 *   SEED_EMAIL_BASE=tucorreo@gmail.com   (por defecto usa el de contacto)
 *   SEED_PASSWORD=otracosa               (por defecto "udeca-test-1234")
 *
 * Los correos se generan con "+etiqueta" sobre tu dirección real
 * (tucorreo+udeca-coach@gmail.com…): Gmail los entrega todos a tu bandeja y
 * Firebase los trata como cuentas distintas. Cero cuentas de Google nuevas.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 7;
const PASSWORD = process.env.SEED_PASSWORD || 'udeca-test-1234';
const EMAIL_BASE = process.env.SEED_EMAIL_BASE || 'luistenaf@gmail.com';
const INVITE_CODE = 'TEST01';

/** tucorreo@gmail.com + "coach" -> tucorreo+udeca-coach@gmail.com */
function taggedEmail(tag) {
  const [user, domain] = EMAIL_BASE.split('@');
  if (!domain) throw new Error(`SEED_EMAIL_BASE no es un correo válido: ${EMAIL_BASE}`);
  return `${user}+udeca-${tag}@${domain}`;
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
let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error(`
✖ Falta el paquete firebase-admin. Instálalo con:

  npm i --no-save firebase-admin
`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const auth = admin.auth();
const db = admin.firestore();

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

async function main() {
  const now = Date.now();

  const coachEmail = taggedEmail('coach');
  const athleteEmail = taggedEmail('atleta');
  const clientEmail = taggedEmail('alumno');

  const coachUid = await ensureUser(coachEmail, 'Coach de prueba');
  const athleteUid = await ensureUser(athleteEmail, 'Atleta de prueba');
  const clientUid = await ensureUser(clientEmail, 'Alumno de prueba');

  // COACH: nace sin suscripción (0 = caducada). Entra igual porque el plan
  // gratuito cubre hasta FREE_CLIENT_LIMIT alumnos.
  await db.collection('users').doc(coachUid).set({
    uid: coachUid,
    role: 'trainer',
    name: 'Coach de prueba',
    email: coachEmail,
    createdAt: now,
    inviteCode: INVITE_CODE,
    emailVerificationRequired: false,
    subscriptionUntil: 0,
    clientCount: 1,
  });
  await db.collection('trainerCodes').doc(INVITE_CODE).set({
    trainerId: coachUid,
    full: false,
  });

  // ATLETA: es su propio entrenador y entra con la prueba en marcha.
  await db.collection('users').doc(athleteUid).set({
    uid: athleteUid,
    role: 'athlete',
    name: 'Atleta de prueba',
    email: athleteEmail,
    createdAt: now,
    trainerId: athleteUid,
    emailVerificationRequired: false,
    subscriptionUntil: now + TRIAL_DAYS * DAY_MS,
    trialEndsAt: now + TRIAL_DAYS * DAY_MS,
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

  console.log(`
✔ Cuentas de prueba listas (contraseña para las tres: ${PASSWORD})

  Coach    ${coachEmail}
  Atleta   ${athleteEmail}
  Alumno   ${clientEmail}   (ya en el grupo del coach)

  Código de invitación del coach: ${INVITE_CODE}

Vuelve a ejecutar este script cuando quieras dejarlas como estaban.
`);
}

main().catch((e) => {
  console.error('✖ Error:', e.message);
  process.exit(1);
});
