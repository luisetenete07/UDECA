/**
 * Tarjetas de marca UDECA como imagen PNG (1080×1350):
 *  - Resumen de sesión (al terminar de entrenar).
 *  - Récord personal.
 *  - Informe del alumno (lo genera el coach desde su ficha).
 *
 * El dibujo está en lib/cardEngine y es común a todas las plataformas. Aquí
 * solo se resuelve CÓMO se obtiene el PNG y cómo se comparte:
 *  - Web: se pinta en un <canvas> de la página y se usa el share del navegador
 *    (o se descarga si no lo admite).
 *  - Móvil: lo pinta un WebView oculto, se guarda en la caché y se abre el
 *    menú de compartir del sistema (WhatsApp, Instagram, Telegram...).
 */

import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import {
  buildCardHtml,
  CARD_SCRIPT,
  type CardData,
  type CardKind,
  type RecordCardData,
  type ReportCardData,
  type SessionCardData,
} from './cardEngine';
import { canRenderCardNatively, renderCardBase64 } from '../components/CardRendererHost';
import { UDECA_LOGO_DATA_URI } from './udecaLogo';

export type { RecordCardData, ReportCardData, SessionCardData };

export type ShareResult = 'shared' | 'downloaded' | null;

// ---------- Web ----------

type DrawCard = (
  canvas: HTMLCanvasElement,
  kind: CardKind,
  data: CardData,
  logoUri: string
) => Promise<HTMLCanvasElement>;

let drawCard: DrawCard | null = null;

/**
 * Compila una vez el código de dibujo compartido. Es código propio y fijo
 * (no depende de nada que escriba el usuario); se evalúa así para que web y
 * móvil compartan exactamente el mismo dibujo.
 */
function getDrawCard(): DrawCard {
  if (!drawCard) {
    // eslint-disable-next-line no-new-func
    drawCard = new Function(`${CARD_SCRIPT}\nreturn udecaDrawCard;`)() as DrawCard;
  }
  return drawCard;
}

async function shareOnWeb(
  kind: CardKind,
  data: CardData,
  filename: string,
  title: string
): Promise<ShareResult> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  await getDrawCard()(canvas, kind, data, UDECA_LOGO_DATA_URI);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) return null;

  const file = new globalThis.File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: globalThis.File[] }) => boolean;
    share?: (d: { files: globalThis.File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch {
      // Cancelado o no admitido: se descarga.
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

// ---------- Móvil ----------

async function shareOnNative(
  kind: CardKind,
  data: CardData,
  filename: string,
  title: string
): Promise<ShareResult> {
  if (!canRenderCardNatively()) return null;
  if (!(await Sharing.isAvailableAsync())) return null;

  const base64 = await renderCardBase64(buildCardHtml(kind, data, UDECA_LOGO_DATA_URI));
  // La caché es el sitio correcto: es un archivo desechable que el sistema
  // puede limpiar cuando quiera, y basta con que exista mientras se comparte.
  const target = new File(Paths.cache, filename);
  if (target.exists) target.delete();
  target.create();
  target.write(base64, { encoding: 'base64' });

  await Sharing.shareAsync(target.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: title,
  });
  return 'shared';
}

/**
 * Genera y comparte una tarjeta. Devuelve null si la imagen no se ha podido
 * producir, para que quien llame pueda caer al resumen en texto.
 */
async function shareCard(
  kind: CardKind,
  data: CardData,
  filename: string,
  title: string
): Promise<ShareResult> {
  return Platform.OS === 'web'
    ? shareOnWeb(kind, data, filename, title)
    : shareOnNative(kind, data, filename, title);
}

// ---------- API pública ----------

export function shareSessionImage(data: SessionCardData): Promise<ShareResult> {
  return shareCard('session', data, 'sesion-udeca.png', 'Sesión UDECA');
}

export function shareRecordImage(data: RecordCardData): Promise<ShareResult> {
  return shareCard('record', data, 'record-udeca.png', 'Récord UDECA');
}

export function shareReportImage(data: ReportCardData): Promise<ShareResult> {
  return shareCard('report', data, 'informe-udeca.png', 'Informe UDECA');
}
