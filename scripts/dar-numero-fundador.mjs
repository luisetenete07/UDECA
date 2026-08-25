/*
 * Asigna un número de fundador a una cuenta, a mano.
 *
 * Por qué hace falta: el número lo reparte el servidor al procesar el alta de
 * 1 €, y solo si la campaña estaba abierta en ese momento. Las cuentas
 * anteriores a la campaña —la del propio fundador, entre ellas— no lo reciben
 * nunca, porque ese código solo corre durante un pago. Y las reglas de
 * Firestore prohíben escribirlo desde la app a propósito: un distintivo que
 * cualquiera pudiera ponerse no valdría nada.
 *
 * Así que la única vía honesta es esta: el SDK de administrador, desde fuera de
 * la app, lanzado a mano por quien tiene las llaves.
 *
 * Se ejecuta desde Actions → "Número de fundador" → Run workflow. No hace falta
 * descargar nada ni manejar la clave privada en el ordenador.
 *
 *   CORREO=luis@ejemplo.com NUMERO=1 node scripts/dar-numero-fundador.mjs
 */
const correo = (process.env.CORREO || '').trim();
const numero = parseInt(process.env.NUMERO || '', 10);
const siguiente = process.env.SIGUIENTE ? parseInt(process.env.SIGUIENTE, 10) : null;

if (!correo) {
  console.error('Falta CORREO: el correo de la cuenta a la que dar el número.');
  process.exit(1);
}
if (!Number.isInteger(numero) || numero < 1) {
  console.error('Falta NUMERO: un entero mayor que cero.');
  process.exit(1);
}

// El SDK se carga DESPUÉS de validar: si no, un correo vacío moría con un
// "ERR_MODULE_NOT_FOUND" de firebase-admin en vez de decir qué falta.
//
// Se usan los SUBMÓDULOS (firebase-admin/app, /auth, /firestore) y no el
// import por defecto. En las versiones nuevas del paquete ese objeto ya no
// trae `firestore()` ni `auth()`, y el script moría con "admin.firestore is
// not a function". Es la misma trampa que ya estaba documentada en
// seed-test-accounts.mjs; esta forma funciona en todas las versiones recientes.
let initializeApp, applicationDefault, getAuth, getFirestore;
try {
  ({ initializeApp, applicationDefault } = await import('firebase-admin/app'));
  ({ getAuth } = await import('firebase-admin/auth'));
  ({ getFirestore } = await import('firebase-admin/firestore'));
} catch {
  console.error('Falta el paquete firebase-admin. Instálalo con: npm i --no-save firebase-admin');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// Un correo que no existe salía como una traza de error del SDK, ilegible
// desde la pestaña de Actions. Lo que hace falta saber es una línea.
let usuario;
try {
  usuario = await getAuth().getUserByEmail(correo);
} catch {
  console.error(`No hay ninguna cuenta con el correo ${correo}. Revisa que esté bien escrito.`);
  process.exit(1);
}
const ref = db.collection('users').doc(usuario.uid);
const perfil = await ref.get();

if (!perfil.exists) {
  console.error(`La cuenta ${correo} existe en Auth pero no tiene perfil todavía.`);
  process.exit(1);
}

const datos = perfil.data();
const yaTiene = datos.founderNumber;
if (yaTiene) {
  // No se pisa un número ya repartido: es correlativo y es su valor. Si de
  // verdad hay que cambiarlo, se quita antes a mano y se sabe lo que se hace.
  console.error(`Esa cuenta ya es fundadora (#${String(yaTiene).padStart(4, '0')}). No se toca.`);
  process.exit(1);
}

/*
 * CADA ROL TIENE SU SERIE
 *
 * Entrenadores y atletas llevan campañas separadas, con su contador y su
 * interruptor (ver payments-webhook/api/_alta.js). Así que hay un entrenador
 * fundador #1 y un atleta fundador #1, y las dos cosas son correctas.
 *
 * Esto importa aquí por dos motivos, y los dos harían daño en silencio: el
 * número repetido hay que buscarlo SOLO dentro de su serie —si no, dar el #1 al
 * primer atleta sería imposible porque ya lo tiene un entrenador—, y el
 * contador que se mueve tiene que ser el de esa misma serie.
 */
const MOSTRADOR = { trainer: 'fundadores', athlete: 'fundadoresAtletas' };
const rol = datos.role;
const mostrador = MOSTRADOR[rol];
if (!mostrador) {
  // Un alumno no paga alta: si alguna vez hay que darle un número, primero hay
  // que decidir de qué serie sale, y eso no se improvisa aquí.
  console.error(`La cuenta ${correo} es de tipo "${rol}", que no tiene campaña de fundadores.`);
  process.exit(1);
}

// Que nadie más de SU SERIE tenga ya ese número: dos "atleta fundador nº 1" no
// es un fallo cosmético, es la campaña entera perdiendo el sentido.
const repes = await db
  .collection('users')
  .where('role', '==', rol)
  .where('founderNumber', '==', numero)
  .limit(1)
  .get();
if (!repes.empty) {
  console.error(`El número ${numero} ya lo tiene otra cuenta de tipo "${rol}". Elige otro.`);
  process.exit(1);
}

await ref.set(
  { founderNumber: numero, founderSince: Date.now() },
  { merge: true }
);
const comoQue = rol === 'trainer' ? 'entrenador' : 'atleta';
console.log(`Hecho: ${correo} es el ${comoQue} fundador #${String(numero).padStart(4, '0')}.`);

// El contador de SU campaña, para que la siguiente alta no repita número.
if (siguiente !== null) {
  if (!Number.isInteger(siguiente) || siguiente < 1) {
    console.error('SIGUIENTE tiene que ser un entero mayor que cero.');
    process.exit(1);
  }
  await db
    .collection('config')
    .doc(mostrador)
    .set({ siguiente, updatedAt: Date.now() }, { merge: true });
  console.log(
    `El próximo ${comoQue} fundador será el #${String(siguiente).padStart(4, '0')}.`
  );
} else {
  console.log('Contador sin tocar. Pasa SIGUIENTE si quieres moverlo.');
}

process.exit(0);
