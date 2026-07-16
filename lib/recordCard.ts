/**
 * Tarjeta de récord personal como IMAGEN (1080×1350, ideal para stories y
 * WhatsApp): fondo oscuro UDECA, halo dorado, récords en grande y marca.
 * Se dibuja en un canvas al vuelo (solo web/PWA; sin librerías externas).
 */

export interface RecordCardData {
  prs: { exerciseName: string; label: string }[];
  streak?: number;
  clientName?: string;
}

const W = 1080;
const H = 1350;

export async function buildRecordImage(data: RecordCardData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fondo oscuro de marca.
  ctx.fillStyle = '#0B0C10';
  ctx.fillRect(0, 0, W, H);

  // Halo dorado superior, muy sutil.
  const glow = ctx.createRadialGradient(W / 2, 220, 0, W / 2, 220, 760);
  glow.addColorStop(0, 'rgba(201, 144, 43, 0.22)');
  glow.addColorStop(1, 'rgba(201, 144, 43, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Marco redondeado dorado.
  ctx.strokeStyle = 'rgba(201, 144, 43, 0.55)';
  ctx.lineWidth = 5;
  roundRect(ctx, 40, 40, W - 80, H - 80, 44);
  ctx.stroke();

  ctx.textAlign = 'center';

  // Marca.
  ctx.fillStyle = '#C9902B';
  ctx.font = '800 52px sans-serif';
  ctx.fillText('U D E C A', W / 2, 190);
  ctx.fillStyle = '#9AA0A8';
  ctx.font = '600 26px sans-serif';
  ctx.fillText('U N I V E R S I D A D   D E   C A L I S T E N I A', W / 2, 240);
  ctx.fillStyle = '#C9902B';
  ctx.fillRect(W / 2 - 44, 272, 88, 4);

  // Insignia PR (anilla dorada con monograma) y titular. Dibujada a mano en
  // vez de un emoji: se ve idéntica y profesional en cualquier dispositivo.
  ctx.strokeStyle = '#C9902B';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(W / 2, 420, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, 420, 92, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(201, 144, 43, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#E3B15C';
  ctx.font = '900 64px sans-serif';
  ctx.fillText('PR', W / 2, 443);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 64px sans-serif';
  ctx.fillText('NUEVO RÉCORD PERSONAL', W / 2, 590);

  // Récords (máximo 3 para que respire).
  const prs = data.prs.slice(0, 3);
  const compact = prs.length > 1;
  let y = prs.length === 1 ? 790 : 730;
  for (const pr of prs) {
    ctx.fillStyle = '#E3B15C';
    ctx.font = `700 ${compact ? 40 : 46}px sans-serif`;
    ctx.fillText(fit(ctx, pr.exerciseName.toUpperCase(), W - 200), W / 2, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${compact ? 76 : 104}px sans-serif`;
    ctx.fillText(fit(ctx, pr.label, W - 200), W / 2, y + (compact ? 84 : 112));
    y += compact ? 190 : 240;
  }

  // Racha.
  if (data.streak && data.streak > 1) {
    ctx.fillStyle = '#ECEDEF';
    ctx.font = '600 40px sans-serif';
    ctx.fillText(`Racha de ${data.streak} días`, W / 2, 1170);
  }

  // Pie con la web.
  ctx.fillStyle = '#6B7078';
  ctx.font = '600 30px sans-serif';
  ctx.fillText('u d e c a . l u i s t e n a f i t . c o m', W / 2, 1265);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Comparte la imagen con el share nativo del móvil; si no, la descarga. */
export async function shareRecordImage(data: RecordCardData): Promise<'shared' | 'downloaded' | null> {
  const blob = await buildRecordImage(data);
  if (!blob) return null;
  const file = new File([blob], 'record-udeca.png', { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'Récord UDECA' });
      return 'shared';
    } catch {
      // Cancelado por el usuario o no soportado: caemos a descarga.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'record-udeca.png';
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
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

/** Recorta el texto con … si excede el ancho disponible (mantiene la fuente). */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 2 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}
