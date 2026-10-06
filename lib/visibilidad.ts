/**
 * Qué ve el alumno mientras entrena, decidido por su entrenador.
 *
 * VALE PARA LOS TRES TIPOS DE PLAN. Lo del plan personalizado decide qué se
 * PRESCRIBE (en qué unidades, o nada); esto decide si el alumno lo VE. Son dos
 * cosas distintas: un entrenador puede programar la intensidad de cada día
 * para organizarse él y no querer que el alumno la lea antes de entrenar
 * —"hoy toca el 90 %" condiciona cómo llega a la sesión—, o poner el RIR
 * objetivo para sus notas y que el alumno simplemente entrene.
 *
 * Lo que se ESCONDE NO SE BORRA: sigue en la rutina, el entrenador lo sigue
 * viendo en su editor y en sus informes. Solo deja de pintarse en la pantalla
 * del alumno.
 *
 * La pregunta de "¿cuántas te quedaban?" va aparte: la decide el entrenador
 * por alumno (`trackRir`) o, en el personalizado, con "Cuándo se le pregunta".
 *
 * Sin imports para que el guardián pueda ejecutarlo.
 */

export interface QueVeElAlumno {
  /** La intensidad del día: "7/10", "80 %", o la etiqueta del entrenador. */
  intensidad?: boolean;
  /** El objetivo de cada ejercicio: "RIR 2", o la variable del personalizado. */
  objetivo?: boolean;
}

/**
 * Lo que ve, con lo que falte en SÍ. Una rutina guardada antes de que esto
 * existiera lo enseñaba todo, y tiene que seguir haciéndolo.
 */
export function queVeElAlumno(
  rutina: { visibilidad?: QueVeElAlumno } | null | undefined
): Required<QueVeElAlumno> {
  return {
    intensidad: rutina?.visibilidad?.intensidad !== false,
    objetivo: rutina?.visibilidad?.objetivo !== false,
  };
}

/**
 * Lo que se guarda: SIEMPRE las dos claves, en sí o en no.
 *
 * Guardar solo los "no" parece más limpio y rompe: al volver a encender todo
 * no quedaría nada que escribir, y la actualización de Firestore dejaría el
 * "no" viejo donde estaba. El alumno seguiría sin ver lo que su entrenador
 * acaba de volver a enseñarle.
 */
export function visibilidadAGuardar(v: QueVeElAlumno | undefined): Required<QueVeElAlumno> {
  return queVeElAlumno({ visibilidad: v });
}
