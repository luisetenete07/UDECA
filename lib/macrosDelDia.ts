/**
 * De quién son los macros que manda hoy.
 *
 * MANDA EL ALUMNO. Esto ha cambiado, y a propósito.
 *
 * Antes ganaba siempre el plan del entrenador: mientras tuviera uno activo, lo
 * que el alumno calculara se guardaba en su ficha y no cambiaba ni una cifra de
 * su día. La idea era razonable —el que sabe es el entrenador— y en la práctica
 * salía mal por dos motivos:
 *
 *  1. Desde fuera era indistinguible de un fallo. El alumno rehacía su ficha,
 *     la app decía "guardado", y la pantalla seguía con los números de antes.
 *     Nadie concluye "manda mi entrenador"; se concluye "esto no funciona".
 *  2. El cuerpo es del alumno. Si ha engordado diez kilos o ha cambiado de
 *     trabajo, sus números de hoy valen más que un plan de hace cuatro meses, y
 *     no tiene sentido que necesite que alguien se lo apruebe.
 *
 * LA REGLA: EL MÁS RECIENTE
 *
 * No "el alumno siempre", aunque sea lo que suena. Casi todos los alumnos
 * calculan sus macros en la bienvenida, el primer día; si eso ganara para
 * siempre, el plan que le mande su entrenador la semana que viene no se
 * aplicaría nunca y la función del entrenador estaría muerta sin que nadie se
 * diera cuenta.
 *
 * Así que gana el último que habló. El alumno recalcula y manda lo suyo, al
 * momento y sin que nadie lo verifique. El entrenador le manda un plan nuevo y
 * manda ese. Y el alumno puede volver a recalcular y recuperarlo, que es justo
 * lo que hace que esto no sea una pelea: siempre hay una salida, de los dos
 * lados, y es la misma.
 *
 * En un empate gana el alumno. Es su cuerpo.
 *
 * Sin React Native dentro: scripts/check-ficha-nutricional.mjs lo recorre de
 * verdad, con sus fechas y sus casos raros.
 */

export interface MacrosDelDia {
  /** Cómo se llama lo que manda hoy, para enseñarlo. */
  name: string;
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Si lo que manda es el plan del entrenador. */
  fromCoach: boolean;
}

/** El plan que ha puesto el entrenador. */
export interface PlanDelCoach {
  name: string;
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  updatedAt?: number;
}

/** Lo que ha calculado el alumno en su ficha. */
export interface MacrosDelAlumno {
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  updatedAt?: number;
}

/**
 * Una fecha que se pueda comparar.
 *
 * Un `updatedAt` que falte cuenta como el principio de los tiempos, no como
 * ahora: los datos viejos son justo los que no lo llevan, y tratarlos como
 * recientes haría ganar siempre al que menos información tiene.
 */
const cuando = (v?: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function objetivosDelDia(
  plan?: PlanDelCoach | null,
  mios?: MacrosDelAlumno | null
): MacrosDelDia | null {
  const delAlumno = mios
    ? {
        name: 'Mis macros',
        dailyCalories: mios.dailyCalories,
        proteinG: mios.proteinG,
        carbsG: mios.carbsG,
        fatG: mios.fatG,
        fromCoach: false,
      }
    : null;
  const delCoach = plan
    ? {
        name: plan.name,
        dailyCalories: plan.dailyCalories,
        proteinG: plan.proteinG,
        carbsG: plan.carbsG,
        fatG: plan.fatG,
        fromCoach: true,
      }
    : null;

  if (!delAlumno) return delCoach;
  if (!delCoach) return delAlumno;
  // Empate incluido: gana el alumno.
  return cuando(mios?.updatedAt) >= cuando(plan?.updatedAt) ? delAlumno : delCoach;
}
