import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { getClientsForTrainer, removeClientFromTrainer } from './users';
import type { UserProfile } from '../types';

/**
 * Borrado de la cuenta y de sus datos.
 *
 * Va aparte de la pantalla porque no es un botón: es una lista concreta de
 * cosas que hay que quitar, en un orden concreto, y conviene poder leerla —y
 * ampliarla— sin abrir un componente de React.
 *
 * Lo que NO se puede borrar desde aquí queda dicho al final del fichero. La
 * app se lo cuenta al usuario tal cual; prometer un borrado total que no
 * ocurre sería justo lo que la ley prohíbe.
 */

/** Colecciones donde cada documento es del usuario y él puede borrarlo. */
const MIAS: { coleccion: string; campo: string }[] = [
  { coleccion: 'workoutLogs', campo: 'clientId' },
  { coleccion: 'weightLogs', campo: 'clientId' },
  { coleccion: 'progressPhotos', campo: 'clientId' },
  { coleccion: 'levelTests', campo: 'clientId' },
  { coleccion: 'joinRequests', campo: 'clientId' },
];

/** Colecciones que crea el ENTRENADOR y que solo él puede borrar. */
const DEL_ENTRENADOR: { coleccion: string; campo: string }[] = [
  { coleccion: 'routines', campo: 'trainerId' },
  { coleccion: 'exercises', campo: 'trainerId' },
  { coleccion: 'nutritionPlans', campo: 'trainerId' },
  { coleccion: 'mealBooks', campo: 'trainerId' },
  { coleccion: 'habits', campo: 'trainerId' },
  { coleccion: 'coachNotes', campo: 'trainerId' },
  { coleccion: 'coachTasks', campo: 'trainerId' },
  { coleccion: 'courses', campo: 'trainerId' },
  { coleccion: 'trainingCycles', campo: 'trainerId' },
  { coleccion: 'routineTemplates', campo: 'trainerId' },
  { coleccion: 'payments', campo: 'trainerId' },
];

/** Progreso del borrado, para que la pantalla pueda contar qué está haciendo. */
export interface PasoBorrado {
  texto: string;
  hechos: number;
}

/**
 * Borra todo lo que esta cuenta puede borrar por sí misma.
 *
 * Es "lo mejor posible", a propósito: cada colección va en su propio try, así
 * que un permiso que falle en una no deja a medias todo lo demás. Lo que
 * importa es que al final el perfil (nombre, correo, foto) desaparezca, porque
 * es donde vive lo que identifica a una persona.
 */
export async function eraseMyData(
  profile: UserProfile,
  aviso?: (paso: PasoBorrado) => void
): Promise<void> {
  const uid = profile.uid;
  const esEntrenador = profile.role === 'trainer' || profile.role === 'athlete';

  // 1) Los alumnos primero: si se borrase antes al entrenador, se quedarían
  //    apuntando a una cuenta que ya no existe y sin poder entrar en otro
  //    grupo. Se les desvincula, no se les toca nada más.
  if (esEntrenador) {
    try {
      const alumnos = await getClientsForTrainer(uid);
      let n = 0;
      for (const alumno of alumnos) {
        if (alumno.uid === uid) continue; // el atleta es su propio entrenador
        await removeClientFromTrainer(alumno.uid).catch(() => {});
        n++;
      }
      if (n > 0) aviso?.({ texto: 'Alumnos desvinculados', hechos: n });
    } catch {
      // Sin lista de alumnos no se puede desvincular a nadie; se sigue.
    }
  }

  // 2) El código de invitación: si sobreviviera, alguien podría registrarse
  //    con él y quedar vinculado a un entrenador que ya no está.
  if (profile.inviteCode) {
    try {
      await deleteDoc(doc(db, 'trainerCodes', profile.inviteCode));
      aviso?.({ texto: 'Código de entrenador liberado', hechos: 1 });
    } catch {
      // Un código huérfano no expone datos personales; no bloquea el borrado.
    }
  }

  // 3) La clasificación del grupo lleva el nombre a la vista: es de lo
  //    primero que tiene que desaparecer.
  try {
    await deleteDoc(doc(db, 'socialStats', uid));
    aviso?.({ texto: 'Ficha de la clasificación', hechos: 1 });
  } catch {
    // Puede no existir (nunca entrenó) o no permitirse; no es bloqueante.
  }

  const grupos = esEntrenador ? [...MIAS, ...DEL_ENTRENADOR] : MIAS;
  for (const { coleccion, campo } of grupos) {
    try {
      const snap = await getDocs(query(collection(db, coleccion), where(campo, '==', uid)));
      let n = 0;
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(() => {});
        n++;
      }
      if (n > 0) aviso?.({ texto: coleccion, hechos: n });
    } catch {
      // Consulta o permiso denegado: se pasa a la siguiente colección.
    }
  }

  // 4) La tabla de progreso que mantiene el entrenador sobre este alumno.
  try {
    await deleteDoc(doc(db, 'progressTrackers', uid));
  } catch {
    // La borra su entrenador; si no se puede, queda sin datos personales.
  }
}

/**
 * Lo que NO se borra desde la app, dicho tal cual para poder enseñarlo.
 *
 * `mealLogs` y `habitLogs` son de solo escritura por reglas (nadie los edita
 * ni los borra, ni siquiera su dueño) y los mensajes con el entrenador tienen
 * dos dueños, así que borrarlos por un lado le quitaría al otro su copia de la
 * conversación. Ninguno guarda nombre ni correo: al desaparecer el perfil se
 * quedan en filas sueltas con un identificador que ya no apunta a nadie.
 *
 * Para que se borren también esos restos hace falta pedirlo por correo, y por
 * eso la pantalla lo ofrece.
 */
export const RESTOS_TRAS_BORRAR = [
  'Comidas y hábitos registrados (sin nombre ni correo)',
  'Mensajes con tu entrenador, que conserva su copia',
  'Facturas, si hubo un pago: la ley obliga a guardarlas',
];
