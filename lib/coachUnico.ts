import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isAdmin } from './planBase';
import { sendJoinRequest } from './firestore/joinRequests';
import type { UserProfile } from './types';

/**
 * Mastery tiene UN entrenador: Luis Tena.
 *
 * Antes la app era de muchos entrenadores y cada alumno llegaba con el código
 * del suyo. Ahora no hay a quién elegir, así que el código sobra: quien se
 * registra le manda la solicitud directamente a Luis, y Luis decide si entra.
 * Sigue siendo privada —nadie entra sin que le acepten—, pero sin el paso de
 * pedir un código que solo servía para saber a quién iba la solicitud.
 *
 * DÓNDE SE APUNTA QUIÉN ES EL COACH: en `config/coach`, que cualquiera con
 * sesión puede leer. El uid no se escribe en el código a propósito: el
 * repositorio es público y, además, así no hay que tocar la app si un día
 * cambia la cuenta. Lo escribe la propia cuenta de Luis al abrir la app
 * (`fijarCoach`), y las reglas de Firestore solo se lo permiten a una cuenta
 * de entrenador con uno de los correos de administración, verificado.
 *
 * Si todavía no está apuntado —Luis no ha abierto la versión nueva—, el alumno
 * sigue teniendo el código como antes (ver LinkTrainerScreen). Nadie se queda
 * fuera por eso.
 */

/** Cómo se llama el coach en los textos de entrada. */
export const NOMBRE_DEL_COACH = 'Luis Tena';

const REF = () => doc(db, 'config', 'coach');

/** El uid del coach, o null si todavía no está apuntado (o no hay red). */
export async function idDelCoach(): Promise<string | null> {
  try {
    const snap = await getDoc(REF());
    const id = snap.exists() ? snap.data().trainerId : null;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

/**
 * La cuenta de Luis se apunta como el coach, si no lo está ya.
 *
 * Solo escribe cuando falta: abrir la app no puede ser una escritura cada vez,
 * y si hubiera dos cuentas de administración de entrenador no se pisarían la
 * una a la otra en cada arranque. Si falla (sin red, sin correo verificado) no
 * pasa nada visible: los alumnos siguen pudiendo entrar con el código.
 */
export async function fijarCoach(profile: UserProfile | null): Promise<void> {
  if (!profile || profile.role !== 'trainer' || !isAdmin(profile)) return;
  try {
    const snap = await getDoc(REF());
    if (snap.exists() && snap.data().trainerId) return;
    await setDoc(REF(), { trainerId: profile.uid, updatedAt: Date.now() });
  } catch {
    // Se reintenta la próxima vez que abra la app.
  }
}

/**
 * Manda la solicitud del alumno al coach. Devuelve false si todavía no se sabe
 * quién es el coach: entonces la pantalla de entrada le pide el código.
 */
export async function pedirEntrada(alumno: UserProfile): Promise<boolean> {
  const coach = await idDelCoach();
  if (!coach) return false;
  await sendJoinRequest(coach, alumno);
  return true;
}
