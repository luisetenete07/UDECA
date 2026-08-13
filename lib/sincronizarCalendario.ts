import { Platform } from 'react-native';
import { ficheroIcs, nombreDelFichero, type EventoDeAgenda } from './calendario';

/**
 * Llevar la agenda al calendario del móvil (o descargarla en el ordenador).
 *
 * DOS CAMINOS, y no por capricho:
 *
 *  - EN EL MÓVIL se escribe DIRECTAMENTE en el calendario del sistema, que en
 *    un iPhone es Apple Calendar y en un Android es el de la cuenta de Google.
 *    Es lo que pidió: "conectar" y no "exportar". Los eventos se crean con un
 *    identificador estable, así que volver a sincronizar ACTUALIZA los mismos
 *    en vez de duplicarlos.
 *  - EN EL ORDENADOR no hay API de calendario que valga: se descarga un .ics,
 *    que es el formato que entienden Google Calendar y Apple Calendar. Se abre
 *    con doble clic o se sube desde "Importar".
 *
 * Lo que NO se hace, y conviene dejarlo escrito: pedirle su cuenta de Google
 * con OAuth para escribir en su calendario desde nuestro servidor. Funcionaría,
 * pero significa guardar un permiso permanente sobre el calendario personal de
 * cada entrenador en una base de datos nuestra, y la ganancia sobre esto es
 * que no tenga que darle a un botón de vez en cuando.
 */

export type ResultadoDeSincronizacion =
  | { ok: true; creados: number; actualizados: number; calendario: string }
  | { ok: false; motivo: string };

/** Dónde se guarda, en el dispositivo, qué evento nuestro es cuál del sistema. */
export const CLAVE_ENLACES = 'calendario-eventos';

/**
 * Escribe los eventos en el calendario del teléfono.
 *
 * El mapa `enlaces` viene de fuera (lo guarda quien llama, en el dispositivo):
 * es lo que permite que la segunda sincronización actualice en vez de duplicar.
 * Se devuelve actualizado.
 */
export async function sincronizarEnElMovil(
  eventos: EventoDeAgenda[],
  enlaces: Record<string, string>
): Promise<{ resultado: ResultadoDeSincronizacion; enlaces: Record<string, string> }> {
  if (Platform.OS === 'web') {
    return {
      resultado: { ok: false, motivo: 'En el ordenador se descarga el fichero.' },
      enlaces,
    };
  }

  try {
    const Calendar = require('expo-calendar');
    const permiso = await Calendar.requestCalendarPermissionsAsync();
    if (permiso.status !== 'granted') {
      return {
        resultado: {
          ok: false,
          motivo: 'Sin permiso de calendario no se puede escribir nada. Actívalo en los ajustes del móvil.',
        },
        enlaces,
      };
    }

    const destino = await calendarioDeDestino(Calendar);
    if (!destino) {
      return {
        resultado: {
          ok: false,
          motivo: 'No hay ningún calendario en el que se pueda escribir en este móvil.',
        },
        enlaces,
      };
    }

    const nuevos = { ...enlaces };
    let creados = 0;
    let actualizados = 0;

    for (const e of eventos) {
      const detalles = {
        title: e.titulo,
        startDate: new Date(e.inicio),
        endDate: new Date(e.fin),
        allDay: e.todoElDia,
        notes: e.notas,
        timeZone: undefined as string | undefined,
      };
      const idPrevio = nuevos[e.uid];
      if (idPrevio) {
        try {
          await Calendar.updateEventAsync(idPrevio, detalles);
          actualizados += 1;
          continue;
        } catch {
          // El entrenador lo borró a mano en su calendario. Se vuelve a crear
          // en vez de dar error: lo que él quiere es tenerlo, no un aviso.
          delete nuevos[e.uid];
        }
      }
      const id = await Calendar.createEventAsync(destino.id, detalles);
      nuevos[e.uid] = id;
      creados += 1;
    }

    return {
      resultado: { ok: true, creados, actualizados, calendario: destino.title ?? 'tu calendario' },
      enlaces: nuevos,
    };
  } catch (e) {
    return {
      resultado: { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo sincronizar.' },
      enlaces,
    };
  }
}

/**
 * En qué calendario se escribe.
 *
 * Se busca el que el sistema tiene por defecto para eventos nuevos —el mismo
 * en el que aparecería una cita creada desde la app de calendario— porque es
 * el que el entrenador mira. Crear un calendario "UDECA" aparte parece más
 * limpio y es peor: nace apagado en la mitad de los móviles y el entrenador no
 * ve nada, sin saber por qué.
 */
async function calendarioDeDestino(
  Calendar: {
    getCalendarsAsync: (tipo: string) => Promise<
      { id: string; title?: string; allowsModifications?: boolean; source?: { name?: string } }[]
    >;
    getDefaultCalendarAsync?: () => Promise<{ id: string; title?: string } | null>;
    EntityTypes: { EVENT: string };
  }
) {
  if (Platform.OS === 'ios' && Calendar.getDefaultCalendarAsync) {
    const porDefecto = await Calendar.getDefaultCalendarAsync().catch(() => null);
    if (porDefecto) return porDefecto;
  }
  const todos = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return todos.find((c) => c.allowsModifications) ?? todos[0] ?? null;
}

/**
 * Descarga el .ics en el navegador.
 *
 * Se hace con un enlace temporal y no con una pestaña nueva: una pestaña con
 * un `blob:` la bloquean la mitad de los navegadores y el entrenador ve que no
 * pasa nada.
 */
export function descargarIcs(eventos: EventoDeAgenda[], nombreDelCoach?: string): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  try {
    const texto = ficheroIcs(eventos);
    const blob = new Blob([texto], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreDelFichero(nombreDelCoach);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Se libera después: revocarlo en el acto cancela la descarga en Safari.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}
