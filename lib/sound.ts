import { Platform } from 'react-native';

/**
 * Pequeño chime de aviso (fin de descanso) usando Web Audio en web/PWA. En
 * nativo se usa la vibración háptica (ver RestTimer), así que aquí no hace nada.
 *
 * El AudioContext debe crearse durante un gesto del usuario (política de
 * autoplay de los navegadores); por eso `primeAudio()` se llama al marcar una
 * serie y `playBeep()` al terminar la cuenta atrás reutiliza ese contexto.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  try {
    const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Prepara el audio dentro de un gesto del usuario (para que suene luego). */
export function primeAudio() {
  getCtx();
}

/** Chime de dos notas al terminar el descanso. */
export function playBeep() {
  const c = getCtx();
  if (!c) return;
  try {
    const now = c.currentTime;
    const note = (start: number, freq: number) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    };
    note(now, 880); // La5
    note(now + 0.2, 1175); // Re6
  } catch {
    // Silencio si el navegador bloquea el audio.
  }
}
