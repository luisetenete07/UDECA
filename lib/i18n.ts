/**
 * La app en inglés.
 *
 * LA CLAVE ES EL TEXTO EN ESPAÑOL
 *
 * `t('Mi entrenamiento')` devuelve "My training" en inglés y, si esa frase
 * todavía no está traducida, devuelve la propia frase en español. Es feo de
 * mirar en el código y es lo correcto aquí por dos motivos:
 *
 *  - La app ya está escrita en español, en treinta pantallas. Con claves
 *    inventadas (`workout.title`) habría que tocar las treinta a la vez o
 *    dejar media app enseñando "workout.title" a los usuarios. Con el español
 *    como clave, una pantalla sin traducir sigue estando perfecta en español.
 *  - Una traducción que falta NUNCA deja un hueco en blanco ni un identificador
 *    a la vista. Lo peor que puede pasar es que a un inglés le salga una frase
 *    en español, que es exactamente lo que le pasaba antes con la app entera.
 *
 * De ahí que traducir sea incremental de verdad: se añade la frase al
 * diccionario y queda traducida en todos los sitios donde se use, sin tocar
 * ninguna pantalla.
 *
 * LO QUE AÚN NO CUBRE
 *
 * Las fechas se siguen escribiendo en español (lib/fechas.ts). Cambiarlas pide
 * pasarle el idioma a todas las funciones de fecha de la app, y prefiero que
 * eso vaya en su propio cambio antes que a medias.
 */

export type Idioma = 'es' | 'en';

export const IDIOMAS: { valor: Idioma; texto: string }[] = [
  { valor: 'es', texto: 'Español' },
  { valor: 'en', texto: 'English' },
];

/**
 * El diccionario. La clave es la frase en español, tal cual está en el código.
 *
 * Cuando el mismo español necesite dos ingleses distintos según el sitio (no
 * ha pasado todavía), lo que toca es cambiar el español de uno de los dos: si
 * dos frases del producto dicen lo mismo y significan cosas distintas, el
 * problema es del español, no de la traducción.
 */
export const EN: Record<string, string> = {
  // --- Entrar y crear cuenta ---
  'Iniciar sesión': 'Sign in',
  'Crear cuenta': 'Create account',
  'Correo electrónico': 'Email',
  Contraseña: 'Password',
  'Repetir contraseña': 'Repeat password',
  '¿Olvidaste tu contraseña?': 'Forgot your password?',
  'Continuar con Google': 'Continue with Google',
  'Usar otra cuenta': 'Use another account',
  'Cuentas guardadas': 'Saved accounts',
  '¿Has olvidado tu contraseña?': 'Forgot your password?',
  '¿No tienes cuenta?': "Don't have an account?",
  Regístrate: 'Sign up',
  'Entrar con otra cuenta': 'Use a different account',
  'Nombre completo': 'Full name',
  'Ya tengo cuenta': 'I already have an account',
  Alumno: 'Student',
  Atleta: 'Athlete',
  Entrenador: 'Coach',
  Formación: 'Course',
  'Código de invitación': 'Invite code',

  // --- Barra de pestañas ---
  Inicio: 'Home',
  Entreno: 'Training',
  Cursos: 'Courses',
  Nutrición: 'Nutrition',
  Progreso: 'Progress',
  Social: 'Community',
  Perfil: 'Profile',
  Clientes: 'Clients',
  Ejercicios: 'Exercises',

  // --- Entrenar ---
  'Mi entrenamiento': 'My training',
  'Terminar entreno': 'Finish workout',
  'Terminar sesión': 'Finish session',
  'Seguir entrenando': 'Keep training',
  'Estás entrenando': "You're training",
  Calentamiento: 'Warm-up',
  'Añadir serie': 'Add set',
  'Quitar serie': 'Remove set',
  'Añadir nota': 'Add note',
  Anterior: 'Previous',
  Siguiente: 'Next',
  Series: 'Sets',
  Repeticiones: 'Reps',
  Isométricos: 'Holds',
  Volumen: 'Volume',
  Duración: 'Duration',
  Descanso: 'Rest',
  'Día de descanso': 'Rest day',
  'Volver a inicio': 'Back to home',
  'Sin rutina asignada': 'No routine assigned',
  '¡Entrenamiento completado!': 'Workout complete!',
  'Registrar un entreno de otro día': 'Log a workout from another day',
  'Registrar un entreno': 'Log a workout',
  '¿Qué día fue?': 'Which day was it?',
  '¿Qué entrenaste?': 'What did you train?',
  Hoy: 'Today',
  Ayer: 'Yesterday',
  'Series de hoy': "Today's sets",
  'Apuntar serie': 'Log set',
  'Quitar la última': 'Remove the last one',
  'Añadir un ejercicio': 'Add an exercise',
  'Añadir un ejercicio a esta sesión': 'Add an exercise to this session',
  'Grease the groove': 'Grease the groove',

  // --- Nutrición ---
  'Mi nutrición': 'My nutrition',
  'Pasos de hoy': "Today's steps",
  'Traer los pasos del móvil': 'Get steps from your phone',
  'Apuntar a mano': 'Enter manually',
  'Comidas de hoy': "Today's meals",
  'Calcular mis macros': 'Calculate my macros',
  'Fotos de progreso': 'Progress photos',
  Calorías: 'Calories',
  Proteína: 'Protein',
  Carbohidratos: 'Carbs',
  Grasas: 'Fats',

  // --- Progreso ---
  'Mi progreso': 'My progress',
  Entrenos: 'Workouts',
  Peso: 'Weight',
  Logros: 'Achievements',
  'Aún no hay entrenamientos': 'No workouts yet',
  'Registrar peso': 'Log weight',

  // --- Planificación ---
  'Mi temporada': 'My season',
  'Nueva temporada': 'New season',
  'Bloque suelto': 'Standalone block',
  Planificación: 'Planning',
  'Sin planificar': 'Not planned yet',
  Semana: 'Week',
  Macrociclo: 'Macrocycle',
  Mesociclo: 'Mesocycle',
  Microciclo: 'Microcycle',

  // --- Cursos ---
  Academia: 'Academy',
  'Contenido privado · solo para miembros': 'Private content · members only',
  'Marcar como vista': 'Mark as watched',
  'Quitar de vistas': 'Mark as not watched',
  'Curso completado': 'Course completed',
  'Este curso aún no tiene lecciones': 'This course has no lessons yet',

  // --- Perfil y ajustes ---
  'Mi plan de entreno': 'My training plan',
  'Compartir mi carné': 'Share my member card',
  'Cerrar sesión': 'Sign out',
  Idioma: 'Language',
  Guardar: 'Save',
  'Guardar cambios': 'Save changes',
  Cancelar: 'Cancel',
  Volver: 'Back',
  Eliminar: 'Delete',
  Editar: 'Edit',
  Añadir: 'Add',
  Cerrar: 'Close',
  Aceptar: 'OK',

  // --- Frases de estado que se repiten ---
  'No se pudo guardar': "Couldn't save",
  'Inténtalo de nuevo': 'Try again',
  'Sin conexión': 'No connection',
  Cargando: 'Loading',
  'Sin datos todavía': 'No data yet',
};

/**
 * Traduce, o devuelve el español tal cual si esa frase aún no está.
 *
 * Con `partes` se sustituyen los huecos `{algo}` DESPUÉS de traducir, para que
 * un nombre o una cifra no dependan del idioma.
 */
export function traducir(
  texto: string,
  idioma: Idioma,
  partes?: Record<string, string | number>
): string {
  const base = idioma === 'en' ? (EN[texto] ?? texto) : texto;
  if (!partes) return base;
  return base.replace(/\{(\w+)\}/g, (todo, clave) =>
    partes[clave] === undefined ? todo : String(partes[clave])
  );
}

/**
 * El idioma que le toca a alguien: el que haya elegido y, si no ha elegido, el
 * de su teléfono.
 *
 * Cualquier idioma que no sea inglés cae en español, que es la lengua de la
 * app: un francés entiende antes el español de una app de calistenia española
 * que un inglés a medias.
 */
export function idiomaDe(elegido: string | undefined, delSistema: string | undefined): Idioma {
  if (elegido === 'en' || elegido === 'es') return elegido;
  return (delSistema ?? '').toLowerCase().startsWith('en') ? 'en' : 'es';
}

/** Cuánto del producto está ya en inglés, para saber por dónde va esto. */
export function cuantasTraducidas(): number {
  return Object.keys(EN).length;
}
