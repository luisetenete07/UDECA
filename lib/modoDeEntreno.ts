/**
 * CÓMO ENTRENA EL ALUMNO CON LA APP.
 *
 * Hasta noviembre de 2026 el alumno entrenaba EN DIRECTO: pulsaba "Empezar
 * entreno", marcaba serie a serie, el crono de descanso saltaba solo y al
 * acabar se guardaba la sesión. Y su rutina de cada día (grease the groove)
 * se marcaba casilla a casilla.
 *
 * Luis lo cambió: el alumno ya pone mucho esfuerzo entrenando y mandándole
 * los vídeos por WhatsApp, y la app no tiene que pedirle además que lo apunte
 * todo. Lo que tiene ahora es:
 *
 *  - Su PROGRAMA a la vista: los días, los ejercicios con sus series, sus
 *    repeticiones y sus descansos, las notas y la técnica en vídeo.
 *  - Los TIEMPOS que puso el entrenador, de un toque: el descanso de cada
 *    ejercicio lanza su cuenta atrás, y un día EMOM trae su contador por
 *    rondas (lib/emom.ts). Es lo único que se usa con el móvil en la mano.
 *  - Apuntar una MARCA cuando él quiera, para ver su progreso. Opcional: no
 *    hay "Hecho" ni nada que cerrar al acabar.
 *  - La rutina de cada día, solo para ver, con un aviso fijo a las 18:00.
 *
 * Todo lo que dependía de que se apuntara cada entreno se apaga con esto: el
 * aviso de "se te ha olvidado registrar el entreno", la racha y el anillo de
 * sesiones de la semana del alumno, y en el panel del entrenador el aviso de
 * alumnos sin entrenar y el pulso de entrenos de la semana. Sin apuntar, esos
 * números dirían que nadie entrena, y no sería verdad.
 *
 * El historial, los récords y la pestaña Progreso siguen: se llenan con las
 * marcas que el alumno apunte, y lo que ya tenía apuntado sigue ahí.
 *
 * Volver al entreno en directo no es solo poner esto a `true`: esto enciende lo
 * de alrededor, pero la pantalla de entreno en directo se quitó. Está en el
 * historial de git, en app/(client)/workout.tsx antes del commit "Entreno sin
 * directo".
 */
export const SE_APUNTA_EL_ENTRENO = false;
