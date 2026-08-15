import { auth } from './firebase';
import { logError } from './errorLog';
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
    /**
     * Un 5xx es un problema NUESTRO, y su mensaje está escrito para nosotros:
     * "Falta ANTHROPIC_API_KEY en Vercel". Enseñárselo a un alumno que solo
     * quería contar su entreno es dejarle mirando una palabra que no significa
     * nada y sin saber qué hacer. Se queda en el registro de errores, que es
     * donde sirve, y a él se le dice lo único que le importa: que ahora no
     * puede ser y que escribiéndolo sí.
     *
     * Los demás mensajes del servidor SÍ están escritos para él ("No he
     * entendido el dictado", "Has llegado al límite de dictados por hoy"), así
     * que se enseñan tal cual.
     */
    if (res.status >= 500) {
      void logError({
        message: datos?.error ?? `El dictado falló con ${res.status}`,
        where: 'apuntarEntrenoDictado',
        uid: user.uid,
        fatal: false,
      });
      return { error: 'La IA no está disponible ahora mismo. Escríbelo y lo apunto igual.' };
    }
    if (datos?.error) return { error: datos.error };
    if (!res.ok) return { error: 'No se pudo apuntar el dictado' };
    return { dictado: limpiaDictado(datos, catalogo) };
  } catch {
    // Sin conexión, el entreno se apunta a mano: la pantalla sigue detrás.
    return { error: 'Sin conexión con el servidor' };
  }
}
