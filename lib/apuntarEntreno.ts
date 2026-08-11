import { auth } from './firebase';
import { DICTADO_URL, limpiaDictado } from './dictado';
import type { Dictado, DictadoBruto, EjercicioDelCatalogo } from './dictado';

/**
 * Mandar lo dictado al servidor y traerse el entreno entendido.
 *
 * El servidor (payments-webhook/api/apuntar-entreno.js) es quien habla con la
 * IA, porque la clave es un secreto y esta app es pública. Aquí solo se pide, y
 * se manda el token de sesión: cada llamada cuesta dinero y no se atiende a
 * quien no ha entrado.
 *
 * Lo que vuelve pasa por `limpiaDictado` SIEMPRE, aunque venga de nuestro
 * propio servidor. Lo que hay al otro lado es un modelo de lenguaje, no una
 * base de datos: puede devolver un ejercicio que no existe o cien series de
 * nada, y eso no puede llegar a la pantalla tal cual.
 */

export interface ResultadoDictado {
  dictado?: Dictado;
  error?: string;
}

export async function apuntarEntrenoDictado(
  texto: string,
  catalogo: EjercicioDelCatalogo[]
): Promise<ResultadoDictado> {
  const user = auth.currentUser;
  if (!user) return { error: 'Sin sesión' };
  try {
    const idToken = await user.getIdToken();
    const res = await fetch(DICTADO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ texto, catalogo }),
    });
    const datos = (await res.json()) as DictadoBruto & { error?: string };
    if (datos?.error) return { error: datos.error };
    if (!res.ok) return { error: 'No se pudo apuntar el dictado' };
    return { dictado: limpiaDictado(datos, catalogo) };
  } catch {
    // Sin conexión, el entreno se apunta a mano: la pantalla sigue detrás.
    return { error: 'Sin conexión con el servidor' };
  }
}
