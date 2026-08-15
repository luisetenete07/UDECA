import type { UserProfile } from './types';

/**
 * Dónde vive la biblioteca de ejercicios de quien está mirando.
 *
 * Las pantallas de la biblioteca son LAS MISMAS para el entrenador y para el
 * atleta —los ejercicios se guardan igual, por `trainerId`, y el atleta es su
 * propio entrenador—, pero cada uno las tiene montadas en su grupo de rutas:
 * el entrenador en (trainer) y el atleta en (client). Un enlace fijo a
 * `/(trainer)/…` mandaría al atleta a un grupo que le rebota a su inicio, así
 * que el destino se decide por el rol de quien navega.
 *
 * El alumno no aparece aquí a propósito: sus ejercicios los pone su
 * entrenador, no tiene biblioteca propia que abrir.
 */
export function baseDeEjercicios(profile: UserProfile | null | undefined): string {
  return profile?.role === 'trainer' ? '/(trainer)/exercises' : '/(client)/exercises';
}
