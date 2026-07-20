/**
 * Tarjetas de marca UDECA como IMAGEN PNG (1080×1350, canvas, solo web/PWA):
 *  - Resumen de sesión (para compartir al terminar de entrenar).
 *  - Informe del alumno (lo genera el coach desde la ficha del cliente).
 * Mismo lenguaje visual que la tarjeta de récord: fondo oscuro, oro y marca.
 */

import { UDECA_LOGO_DATA_URI } from './udecaLogo';

const W = 1080;
const H = 1350;

// Paleta de marca UDECA (misma esencia que la app: negro absoluto + oro taupe).
const BG = '#000000';
const GOLD = '#A2968B'; // oro apagado de marca (colors.primary)
const GOLD_SOFT = '#C9BDB0'; // oro claro (colors.primaryBright)
const TEXT = '#FFFFFF';
const MUTED = '#ADADAD';
const FAINT = '#666666';
const GLOW = 'rgba(162, 150, 139, 0.20)';
const HAIRLINE = 'rgba(162, 150, 139, 0.45)';
const STAT_BORDER = 'rgba(162, 150, 139, 0.28)';
// Serif elegante para el logotipo/títulos (evoca la Cinzel de la marca).
const DISPLAY = 'Georgia, "Times New Roman", serif';

function newCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

// Logo UDECA (emblema) cacheado: se carga una vez desde el data URI embebido.
let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = UDECA_LOGO_DATA_URI;
  });
  return logoPromise;
}

function drawFrame(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 220, 0, W / 2, 220, 780);
  glow.addColorStop(0, GLOW);
  glow.addColorStop(1, 'rgba(162, 150, 139, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 4;
  roundRect(ctx, 40, 40, W - 80, H - 80, 44);
  ctx.stroke();
  ctx.textAlign = 'center';
  // Emblema UDECA (logo real) sobre el nombre de marca.
  if (logo) {
    const s = 104;
    ctx.drawImage(logo, W / 2 - s / 2, 44, s, s);
  }
  // Marca: logotipo en serif (esencia Cinzel) con amplio interletrado.
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `600 54px ${DISPLAY}`;
  ctx.fillText('U D E C A', W / 2, 198);
  ctx.fillStyle = MUTED;
  ctx.font = '600 23px sans-serif';
  ctx.fillText('U N I V E R S I D A D   D E   C A L I S T E N I A', W / 2, 238);
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 40, 262, 80, 3);
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = FAINT;
  ctx.font = '600 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('w w w . u d e c a . a p p', W / 2, 1265);
}

/** Casilla de estadística: caja redondeada con valor grande y etiqueta. */
function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  label: string
) {
  ctx.fillStyle = 'rgba(162, 150, 139, 0.07)';
  roundRect(ctx, x, y, w, h, 26);
  ctx.fill();
  ctx.strokeStyle = STAT_BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 26);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = TEXT;
  ctx.font = '800 64px sans-serif';
  ctx.fillText(fit(ctx, value, w - 50), x + w / 2, y + h / 2 + 4);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '600 25px sans-serif';
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h - 32);
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

async function shareOrDownload(
  blob: Blob | null,
  filename: string,
  title: string
): Promise<'shared' | 'downloaded' | null> {
  if (!blob) return null;
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch {
      // Cancelado o no soportado: descarga.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

// ---------- Resumen de sesión ----------

export interface SessionCardData {
  routineName: string;
  dayName?: string;
  durationMin: number;
  sets: number;
  reps: number;
  seconds: number;
  volumeKg: number;
  streak: number;
  prCount: number;
  /** Fecha de la sesión (timestamp); se muestra bajo las estadísticas. */
  date?: number;
}

/** "Lunes 13/07/2026" a partir de un timestamp. */
function formatSessionDate(ts: number): string {
  const wd = new Date(ts).toLocaleDateString('es-ES', { weekday: 'long' });
  const dmy = new Date(ts).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${dmy}`;
}

export async function shareSessionImage(
  data: SessionCardData
): Promise<'shared' | 'downloaded' | null> {
  const c = newCanvas();
  if (!c) return null;
  const { canvas, ctx } = c;
  drawFrame(ctx, await loadLogo());

  ctx.fillStyle = TEXT;
  ctx.font = `600 62px ${DISPLAY}`;
  ctx.fillText('SESIÓN COMPLETADA', W / 2, 362);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '700 38px sans-serif';
  ctx.fillText(fit(ctx, `${data.routineName}${data.dayName ? ` · ${data.dayName}` : ''}`, W - 200), W / 2, 424);

  // Rejilla de estadísticas 2×2. Las repeticiones se muestran SIEMPRE (aunque
  // sean 0), junto a duración, series e isométrico/volumen.
  const stats: [string, string][] = [];
  if (data.durationMin > 0) stats.push([`${data.durationMin} min`, 'Duración']);
  stats.push([String(data.sets), 'Series']);
  stats.push([String(data.reps), 'Repeticiones']);
  if (data.seconds > 0) stats.push([`${data.seconds}s`, 'Isométrico']);
  if (data.volumeKg > 0) stats.push([`${data.volumeKg.toLocaleString('es-ES')} kg`, 'Volumen']);
  const shown = stats.slice(0, 4);
  const bw = 440;
  const bh = 210;
  const gap = 40;
  const cols = shown.length === 1 ? 1 : 2;
  const rows = Math.ceil(shown.length / cols);
  const x0 = (W - (cols * bw + (cols - 1) * gap)) / 2;

  // Bloque central (rejilla + récord + racha) CENTRADO verticalmente entre la
  // cabecera y el pie, para que la tarjeta tenga márgenes homogéneos arriba y
  // abajo sea cual sea el nº de casillas.
  const gridH = rows * bh + (rows - 1) * gap;
  const extras: { text: string; color: string; font: string; gapBefore: number }[] = [];
  if (data.prCount > 0)
    extras.push({
      text: data.prCount === 1 ? 'NUEVO RÉCORD PERSONAL' : `${data.prCount} RÉCORDS PERSONALES`,
      color: GOLD_SOFT,
      font: '800 40px sans-serif',
      gapBefore: 70,
    });
  if (data.streak > 1)
    extras.push({
      text: `Racha de ${data.streak} días`,
      color: '#ECEDEF',
      font: '600 36px sans-serif',
      gapBefore: extras.length > 0 ? 56 : 70,
    });
  // Fecha de la sesión, bajo las estadísticas.
  if (data.date)
    extras.push({
      text: formatSessionDate(data.date),
      color: MUTED,
      font: '600 32px sans-serif',
      gapBefore: extras.length > 0 ? 54 : 70,
    });
  const extrasH = extras.reduce((h, e) => h + e.gapBefore, 0);
  const REGION_TOP = 470;
  const REGION_BOTTOM = 1210;
  const blockH = gridH + extrasH;
  const y0 = Math.round(REGION_TOP + Math.max(0, (REGION_BOTTOM - REGION_TOP - blockH) / 2));

  shown.forEach(([v, l], i) => {
    const cx = x0 + (i % cols) * (bw + gap);
    const cy = y0 + Math.floor(i / cols) * (bh + gap);
    drawStat(ctx, cx, cy, bw, bh, v, l);
  });

  let footY = y0 + gridH;
  for (const e of extras) {
    footY += e.gapBefore;
    ctx.fillStyle = e.color;
    ctx.font = e.font;
    ctx.fillText(e.text, W / 2, footY);
  }

  drawFooter(ctx);
  return shareOrDownload(await toBlob(canvas), 'sesion-udeca.png', 'Sesión UDECA');
}

// ---------- Informe del alumno ----------

export interface ReportCardData {
  clientName: string;
  totalWorkouts: number;
  daysTrained: number;
  totalHours: number;
  bestPushIso?: string;
  bestPullIso?: string;
  bestPushReps?: string;
  bestPullReps?: string;
  weightChangeKg?: number;
  periodLabel?: string;
}

export async function shareReportImage(
  data: ReportCardData
): Promise<'shared' | 'downloaded' | null> {
  const c = newCanvas();
  if (!c) return null;
  const { canvas, ctx } = c;
  drawFrame(ctx, await loadLogo());

  ctx.fillStyle = TEXT;
  ctx.font = `600 56px ${DISPLAY}`;
  ctx.fillText('INFORME DE PROGRESO', W / 2, 350);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '700 40px sans-serif';
  ctx.fillText(fit(ctx, data.clientName.toUpperCase(), W - 200), W / 2, 414);
  if (data.periodLabel) {
    ctx.fillStyle = MUTED;
    ctx.font = '600 28px sans-serif';
    ctx.fillText(data.periodLabel, W / 2, 458);
  }

  const bw = 440;
  const bh = 190;
  const gap = 36;
  const x0 = (W - (2 * bw + gap)) / 2;
  let y = 510;
  drawStat(ctx, x0, y, bw, bh, String(data.totalWorkouts), 'Entrenos');
  drawStat(ctx, x0 + bw + gap, y, bw, bh, String(data.daysTrained), 'Días entrenados');
  y += bh + gap;
  drawStat(ctx, x0, y, bw, bh, `${data.totalHours.toLocaleString('es-ES')} h`, 'Horas');
  drawStat(
    ctx,
    x0 + bw + gap,
    y,
    bw,
    bh,
    data.weightChangeKg !== undefined
      ? `${data.weightChangeKg >= 0 ? '+' : ''}${data.weightChangeKg.toLocaleString('es-ES')} kg`
      : '—',
    'Peso corporal'
  );
  y += bh + gap + 40;

  // Mejores marcas (líneas de texto, empuje/tirón).
  ctx.fillStyle = GOLD;
  ctx.font = '800 32px sans-serif';
  ctx.fillText('MEJORES MARCAS', W / 2, y);
  y += 56;
  const lines: string[] = [];
  if (data.bestPushIso) lines.push(`Isométrico empuje · ${data.bestPushIso}`);
  if (data.bestPullIso) lines.push(`Isométrico tirón · ${data.bestPullIso}`);
  if (data.bestPushReps) lines.push(`Empuje · ${data.bestPushReps}`);
  if (data.bestPullReps) lines.push(`Tirón · ${data.bestPullReps}`);
  if (lines.length === 0) lines.push('Aún sin marcas registradas');
  ctx.fillStyle = '#ECEDEF';
  ctx.font = '600 34px sans-serif';
  for (const line of lines.slice(0, 4)) {
    ctx.fillText(fit(ctx, line, W - 220), W / 2, y);
    y += 52;
  }

  drawFooter(ctx);
  return shareOrDownload(await toBlob(canvas), 'informe-udeca.png', 'Informe UDECA');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 2 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}
