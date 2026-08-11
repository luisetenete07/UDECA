/**
 * Pasar la voz a texto, con lo que ya trae el aparato.
 *
 * La IA no oye: lee. Alguien tiene que convertir el mensaje de voz en texto
 * antes, y hay dos formas de hacerlo: mandar el audio a un servicio de
 * transcripción (otra cuenta, otra factura, otro sitio por el que pasa la voz
 * de la gente) o usar el dictado que el móvil y el navegador ya llevan dentro
 * y que la gente ya sabe usar. Se usa el segundo.
 *
 * En el móvil, el dictado es el micrófono del propio teclado: se toca el campo,
 * se toca el micro y se habla. No hace falta ni un módulo nativo más ni un
 * permiso nuevo, y funciona en la app que ya está instalada.
 *
 * En el ordenador, el navegador tiene su propio reconocimiento de voz
 * (SpeechRecognition). Está en Chrome, en Edge y en Safari; en Firefox no.
 * Cuando no está, queda el teclado, que en un ordenador es más rápido que
 * hablar de todas formas.
 *
 * Este módulo no importa nada de React Native a propósito: así puede
 * comprobarse desde un script sin arrastrar media app detrás.
 */

/** Lo que devuelve una escucha en marcha: solo se puede parar. */
export interface Escucha {
  parar(): void;
}

export interface OpcionesDeEscucha {
  /** Texto reconocido hasta ahora, incluido lo que aún puede cambiar. */
  onTexto(texto: string): void;
  /** Se acabó: por silencio, por error o porque se paró a mano. */
  onFin(motivo?: string): void;
  idioma?: string;
}

type Constructor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};

function constructor(): Constructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as Constructor) ?? (w.webkitSpeechRecognition as Constructor) ?? null;
}

/** ¿Este navegador sabe escuchar? Si no, se dicta con el teclado. */
export function hayEscuchaEnNavegador(): boolean {
  return constructor() !== null;
}

/**
 * Junta los trozos que va soltando el navegador en una sola frase.
 *
 * Llegan por tandas y algunas todavía pueden cambiar (las "provisionales"):
 * se pintan igual, porque ver aparecer las palabras mientras hablas es lo que
 * hace entender que te está oyendo.
 */
export function textoDeResultados(e: unknown): string {
  const lista = (e as { results?: ArrayLike<ArrayLike<{ transcript?: string }>> })?.results;
  if (!lista) return '';
  let salida = '';
  for (let i = 0; i < lista.length; i++) {
    salida += lista[i]?.[0]?.transcript ?? '';
  }
  return salida.trim();
}

/**
 * Empieza a escuchar. Devuelve null si el navegador no sabe.
 *
 * `continuous` va activado porque contar un entreno lleva sus buenos segundos
 * y con pausas: sin él, el navegador corta a la primera coma y se pierde la
 * mitad de las series.
 */
export function escuchar(opciones: OpcionesDeEscucha): Escucha | null {
  const Reconocimiento = constructor();
  if (!Reconocimiento) return null;
  const r = new Reconocimiento();
  r.lang = opciones.idioma ?? 'es-ES';
  r.continuous = true;
  r.interimResults = true;
  r.onresult = (e) => opciones.onTexto(textoDeResultados(e));
  r.onerror = (e) => {
    const codigo = (e as { error?: string })?.error;
    // "no-speech" y "aborted" no son fallos: es que nadie dijo nada o que se
    // paró a mano. Avisar de ellos como error solo asusta.
    opciones.onFin(codigo === 'no-speech' || codigo === 'aborted' ? undefined : codigo);
  };
  r.onend = () => opciones.onFin();
  try {
    r.start();
  } catch {
    return null;
  }
  return {
    parar() {
      try {
        r.stop();
      } catch {
        /* ya estaba parado */
      }
    },
  };
}
