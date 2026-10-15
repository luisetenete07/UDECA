import type { ExportedExercise } from './exerciseTemplateIO';

/*
 * El código con el que se comparte una biblioteca (lib/firestore/bibliotecas.ts),
 * sin Firestore: así se prueba solo (scripts/check-biblioteca-codigo.mjs).
 */

/** Sin 0/O ni 1/I/L: se dicta y se copia a mano sin dudas. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LARGO_DEL_CODIGO = 6;

export function nuevoCodigo(azar: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < LARGO_DEL_CODIGO; i++) c += ALFABETO[Math.floor(azar() * ALFABETO.length)];
  return c;
}

/** Lo escrito, como código: mayúsculas, sin espacios ni guiones. */
export function normalizarCodigo(escrito: string): string {
  return escrito.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Los que aún no tiene (por nombre): lo que añade "Añadir los que faltan". */
export function queLeFaltan(
  suyos: { name: string }[],
  ajenos: ExportedExercise[]
): ExportedExercise[] {
  const ya = new Set(suyos.map((e) => e.name.trim().toLowerCase()));
  return ajenos.filter((e) => !ya.has(e.name.trim().toLowerCase()));
}
