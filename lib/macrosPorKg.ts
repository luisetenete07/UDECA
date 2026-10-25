/**
 * Los macros por kilo de peso que decide el entrenador.
 *
 * Es como trabajan los entrenadores de verdad: no "150 g de proteína", sino
 * "1,6 a 2,2 g por kilo". El número en gramos sale de multiplicar por el peso
 * del alumno, y así un mismo criterio vale para un alumno de 60 kg y para uno
 * de 90 sin hacer cuentas a mano.
 *
 *  - Proteína, grasas y creatina: un valor ("1,8") o un rango ("1,6-2,2").
 *  - Carbohidratos: dependen del objetivo. Al elegir el objetivo se proponen
 *    los suyos, y el entrenador los puede cambiar igual que los demás.
 *
 * Las calorías no se escriben: salen de los macros (4 kcal por gramo de
 * proteína o de carbohidrato, 9 por gramo de grasa). Con un rango, el objetivo
 * del día es el punto medio, y el rango se enseña al lado.
 *
 * Sin React Native dentro: scripts/check-macros-por-kg.mjs lo prueba en Node.
 */

export type ObjetivoNutricional = 'definicion' | 'mantenimiento' | 'volumen';

/** Gramos por kilo: un valor (`min`) o un rango (`min`–`max`). */
export interface Rango {
  min: number;
  max?: number;
}

export interface MacrosPorKg {
  /** El peso con el que se calculó (kg). */
  pesoKg: number;
  objetivo: ObjetivoNutricional;
  proteina: Rango;
  grasas: Rango;
  carbos: Rango;
  /** Opcional: sin creatina, la clave no existe. */
  creatina?: Rango;
}

export const OBJETIVOS: { valor: ObjetivoNutricional; texto: string }[] = [
  { valor: 'definicion', texto: 'Definición' },
  { valor: 'mantenimiento', texto: 'Mantenimiento' },
  { valor: 'volumen', texto: 'Volumen' },
];

/** Los carbohidratos que se proponen para cada objetivo (g/kg). */
export const CARBOS_POR_OBJETIVO: Record<ObjetivoNutricional, Rango> = {
  definicion: { min: 2, max: 3 },
  mantenimiento: { min: 3, max: 4 },
  volumen: { min: 4, max: 6 },
};

/** Lo que se propone de entrada, antes de que el entrenador toque nada. */
export const POR_DEFECTO: Omit<MacrosPorKg, 'pesoKg'> = {
  objetivo: 'mantenimiento',
  proteina: { min: 1.6, max: 2.2 },
  grasas: { min: 0.8, max: 1 },
  carbos: CARBOS_POR_OBJETIVO.mantenimiento,
  creatina: { min: 0.1 },
};

const KCAL = { proteina: 4, carbos: 4, grasas: 9 } as const;

/** Lo que se considera un valor razonable en g/kg (para no guardar un 180 por un 1,8). */
const TOPE_G_KG = 15;

const num = (s: string): number => Number(s.trim().replace(',', '.'));

/**
 * Lee lo que escribe el entrenador: "1,8", "1.8", "1,6-2,2", "1,6 – 2,2".
 * Un rango al revés ("2,2-1,6") se da la vuelta. Vacío o raro: null.
 */
export function leerRango(texto: string): Rango | null {
  const partes = texto.split(/\s*[-–—a]\s*/).filter((p) => p.trim() !== '');
  if (partes.length === 0 || partes.length > 2) return null;
  const nums = partes.map(num);
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > TOPE_G_KG)) return null;
  if (nums.length === 1 || nums[0] === nums[1]) return { min: nums[0] };
  const [a, b] = nums[0] < nums[1] ? [nums[0], nums[1]] : [nums[1], nums[0]];
  return { min: a, max: b };
}

/** Cómo se escribe un rango para editarlo o enseñarlo: "1,6-2,2" o "1,8". */
export function textoDeRango(r: Rango | undefined | null, separador = '-'): string {
  if (!r) return '';
  const f = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
  return r.max !== undefined && r.max !== r.min ? `${f(r.min)}${separador}${f(r.max)}` : f(r.min);
}

/** El punto medio de un rango (o el valor, si es uno solo). */
export const medio = (r: Rango): number => (r.max !== undefined ? (r.min + r.max) / 2 : r.min);

/** Gramos de un rango para un peso: { min, max } redondeados. */
export function gramos(r: Rango, pesoKg: number): { min: number; max?: number } {
  const min = Math.round(r.min * pesoKg);
  if (r.max === undefined) return { min };
  const max = Math.round(r.max * pesoKg);
  return max === min ? { min } : { min, max };
}

export interface ResultadoPorKg {
  /** El objetivo del día, en gramos (punto medio). */
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Creatina al día en gramos (con un decimal), si la hay. */
  creatinaG?: number;
  /** Calorías del objetivo del día (de los macros, no escritas a mano). */
  dailyCalories: number;
  /** Las calorías entre el mínimo y el máximo de todos los rangos. */
  kcalMin: number;
  kcalMax: number;
}

export function calcularPorKg(m: MacrosPorKg): ResultadoPorKg {
  const p = m.pesoKg;
  const proteinG = Math.round(medio(m.proteina) * p);
  const carbsG = Math.round(medio(m.carbos) * p);
  const fatG = Math.round(medio(m.grasas) * p);
  const kcal = (pr: number, ca: number, gr: number) =>
    Math.round(pr * KCAL.proteina + ca * KCAL.carbos + gr * KCAL.grasas);
  const tope = (r: Rango) => r.max ?? r.min;
  return {
    proteinG,
    carbsG,
    fatG,
    ...(m.creatina ? { creatinaG: Math.round(medio(m.creatina) * p * 10) / 10 } : {}),
    dailyCalories: kcal(proteinG, carbsG, fatG),
    kcalMin: kcal(m.proteina.min * p, m.carbos.min * p, m.grasas.min * p),
    kcalMax: kcal(tope(m.proteina) * p, tope(m.carbos) * p, tope(m.grasas) * p),
  };
}

/** "115-158 g" o "130 g". */
export function textoDeGramos(r: Rango, pesoKg: number, unidad = 'g'): string {
  const g = gramos(r, pesoKg);
  return g.max !== undefined ? `${g.min}-${g.max} ${unidad}` : `${g.min} ${unidad}`;
}

/** Un peso razonable para calcular (kg). */
export const pesoValido = (kg: number): boolean => Number.isFinite(kg) && kg >= 30 && kg <= 250;
