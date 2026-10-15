import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { buildExerciseTemplate, parseExerciseTemplate, type ExportedExercise } from '../exerciseTemplateIO';
import type { Exercise } from '../types';
import { LARGO_DEL_CODIGO, normalizarCodigo, nuevoCodigo } from '../codigoBiblioteca';
export { LARGO_DEL_CODIGO, normalizarCodigo, nuevoCodigo, queLeFaltan } from '../codigoBiblioteca';

/*
 * COMPARTIR LA BIBLIOTECA CON UN CÓDIGO.
 *
 * Antes se exportaba un archivo (en la web) o un texto larguísimo (en el
 * móvil) que el otro entrenador tenía que pegar entero en un campo. Ahora la
 * biblioteca se guarda bajo un código de seis letras: se dicta, se manda por
 * WhatsApp o se apunta, y el otro lo escribe y listo.
 *
 * Cada entrenador tiene UN código (en su perfil, `codigoBiblioteca`): volver a
 * compartir actualiza lo que hay detrás sin cambiarlo, así que un código que
 * ya circula sigue valiendo y trae siempre la versión de hoy.
 *
 * Las reglas dejan LEER un código a cualquiera con sesión que lo sepa, pero no
 * listar los que hay: sin el código no se encuentra nada.
 */

export interface BibliotecaCompartida {
  codigo: string;
  nombre: string;
  ejercicios: ExportedExercise[];
}

const ref = (codigo: string) => doc(collection(db, 'bibliotecas'), codigo);

/**
 * Guarda la biblioteca bajo el código del entrenador (o uno nuevo, si aún no
 * tiene) y devuelve el código.
 */
export async function compartirBiblioteca(
  trainerId: string,
  nombre: string,
  ejercicios: Exercise[],
  codigoActual?: string
): Promise<string> {
  const datos = {
    trainerId,
    nombre,
    cuantos: ejercicios.length,
    plantilla: buildExerciseTemplate(ejercicios),
    updatedAt: Date.now(),
  };
  if (codigoActual) {
    try {
      await setDoc(ref(codigoActual), datos);
      return codigoActual;
    } catch {
      // Si el suyo ya no se puede escribir (borrado, de otro), se le da otro.
    }
  }
  for (let intento = 0; intento < 5; intento++) {
    const codigo = nuevoCodigo();
    const ya = await getDoc(ref(codigo));
    if (ya.exists()) continue;
    await setDoc(ref(codigo), datos);
    return codigo;
  }
  throw new Error('No se pudo crear el código');
}

/** Lee la biblioteca de un código. null si no existe o no es válida. */
export async function leerBiblioteca(escrito: string): Promise<BibliotecaCompartida | null> {
  const codigo = normalizarCodigo(escrito);
  if (codigo.length !== LARGO_DEL_CODIGO) return null;
  const snap = await getDoc(ref(codigo));
  if (!snap.exists()) return null;
  const d = snap.data() as { nombre?: string; plantilla?: string };
  const ejercicios = typeof d.plantilla === 'string' ? parseExerciseTemplate(d.plantilla) : null;
  if (!ejercicios) return null;
  return { codigo, nombre: d.nombre ?? '', ejercicios };
}
