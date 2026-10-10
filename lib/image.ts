import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface PickOptions {
  /** Tamaño máximo del lado mayor en px. */
  maxSize: number;
  /** Compresión 0-1 (1 = máxima calidad). */
  compress: number;
  /** Relación de aspecto para el recorte (opcional). */
  aspect?: [number, number];
  /**
   * PNG en vez de JPEG. Para el logo: un JPEG no tiene transparencia, y un
   * logo con fondo blanco sobre la app negra se ve como una pegatina.
   */
  png?: boolean;
  /** Sin el recorte del sistema (que en iPhone es siempre cuadrado). */
  sinRecorte?: boolean;
}

async function pickImage(options: PickOptions): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos permiso para acceder a tus fotos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: !options.sinRecorte,
    aspect: options.aspect,
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  try {
    const manipulated = await manipulateAsync(
      asset.uri,
      [{ resize: { width: options.maxSize } }],
      { compress: options.compress, format: options.png ? SaveFormat.PNG : SaveFormat.JPEG, base64: true }
    );
    if (manipulated.base64) {
      return `data:image/${options.png ? 'png' : 'jpeg'};base64,${manipulated.base64}`;
    }
  } catch {
    // En web el redimensionado puede fallar; usamos el base64 original.
  }

  if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
  return asset.uri;
}

/**
 * El logo del entrenador: PNG (con su transparencia), sin recortar y a 320 px de
 * ancho como mucho. Se guarda en su perfil y lo leen todos sus alumnos al
 * entrar, así que tiene que ser ligero.
 */
export function pickLogo(): Promise<string | null> {
  return pickImage({ maxSize: 320, compress: 1, png: true, sinRecorte: true });
}

/** Avatar cuadrado, pequeño y ligero (se guarda en el perfil). */
export function pickAvatar(): Promise<string | null> {
  return pickImage({ maxSize: 200, compress: 0.55, aspect: [1, 1] });
}

/**
 * Foto de ejemplo de comida: se guarda embebida en el plan, así que la
 * mantenemos ligera (varias caben en un doc de Firestore de 1 MB).
 */
export function pickMealPhoto(): Promise<string | null> {
  return pickImage({ maxSize: 500, compress: 0.5 });
}

/** Portada de curso/sección (16:9, ligera; se guarda embebida en el curso). */
export function pickCoverPhoto(): Promise<string | null> {
  return pickImage({ maxSize: 640, compress: 0.55, aspect: [16, 9] });
}
