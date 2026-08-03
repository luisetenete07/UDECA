import admin from 'firebase-admin';

/**
 * Activación del alta de 1 €, en un solo sitio.
 *
 * Lo usan DOS caminos distintos: el webhook, cuando el pago trae el uid, y
 * api/claim-entry, cuando alguien se registra después de haber pagado en la
 * web. Si cada uno escribiera sus campos por su cuenta, tarde o temprano uno
 * de los dos se olvidaría de las plazas o de la prueba del atleta y habría
 * cuentas activadas a medias según por dónde entrasen.
 *
 * El guion bajo del nombre no es decorativo: Vercel no publica como función
 * los ficheros de /api que empiezan por "_", así que esto es un módulo
 * compartido y no un endpoint abierto a internet.
 */

/** Días de prueba del atleta (ver lib/subscription.ts y firestore.rules). */
export const TRIAL_DAYS = 14;

/**
 * ¿Cuántas cuentas de ENTRENADOR han pagado ya con esta tarjeta?
 *
 * El alta de 1 € da cinco plazas de alumno. Si la misma tarjeta paga un
 * segundo alta de entrenador, no compra otras cinco plazas: compra una cuenta
 * más, vacía. Así abrir cuentas deja de ser una forma de esquivar los 180 € y
 * pasa a ser solo trabajo extra para el que lo intente.
 *
 * No se bloquea ni se borra nada: cuentas legítimas comparten tarjeta (una
 * pareja, un centro que paga por dos entrenadores). Se marca y se decide,
 * nunca se castiga en automático.
 */
export async function cuentasConLaMismaTarjeta(db, fingerprint, uid) {
  const ref = db.collection('payerCards').doc(fingerprint);
  const snap = await ref.get();
  const previas = (snap.exists ? snap.data().trainerUids : []) || [];
  const otras = previas.filter((x) => x !== uid);
  return { ref, otras, yaEstaba: previas.includes(uid) };
}

/**
 * Marca la cuenta como dada de alta.
 *
 * Devuelve false si no había nada que hacer (cuenta inexistente, o que no
 * paga plataforma), para que quien llame pueda decirlo.
 */
export async function aplicarAlta(db, uid, { huella = null, customerId = null } = {}) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return false;
  const perfil = snap.data();
  if (perfil.role !== 'trainer' && perfil.role !== 'athlete') return false;

  const datos = { entryPaidAt: Date.now(), stripeCustomerId: customerId };
  if (huella) datos.payerFingerprint = huella;

  // El atleta compra con el euro sus 14 días de prueba, así que el reloj
  // empieza AQUÍ y no al registrarse: si tardó dos días en pagar, no los
  // pierde. Solo la primera vez, y sin acortar nunca un acceso mayor que ya
  // tuviera (cortesías, prórrogas dadas a mano).
  if (perfil.role === 'athlete' && !perfil.entryPaidAt) {
    const fin = Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
    datos.trialEndsAt = fin;
    datos.subscriptionUntil = Math.max(fin, perfil.subscriptionUntil || 0);
  }

  if (perfil.role === 'trainer' && huella) {
    const { ref, otras, yaEstaba } = await cuentasConLaMismaTarjeta(db, huella, uid);
    if (otras.length > 0) {
      // Esta tarjeta ya compró sus plazas. La cuenta entra igual, pero sin
      // plazas incluidas: para tener alumnos, la cuota anual.
      datos.clientSlots = 0;
      datos.sharedCardWith = otras;
    }
    if (!yaEstaba) {
      await ref.set(
        {
          trainerUids: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  }

  await db.collection('users').doc(uid).set(datos, { merge: true });
  return true;
}
