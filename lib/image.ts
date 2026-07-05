import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const AVATAR_SIZE = 256;

/**
 * Abre la galería, deja recortar en cuadrado y devuelve la imagen como
 * data URL (base64) ya redimensionada a 256px y comprimida. Devuelve null
 * si el usuario cancela. Guardamos el avatar directamente en Firestore
 * (data URL) para no requerir configurar Firebase Storage.
 */
export async function pickAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos permiso para acceder a tus fotos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];

  try {
    const manipulated = await manipulateAsync(
      asset.uri,
      [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
      { compress: 0.6, format: SaveFormat.JPEG, base64: true }
    );
    if (manipulated.base64) {
      return `data:image/jpeg;base64,${manipulated.base64}`;
    }
  } catch {
    // Si el redimensionado falla (p. ej. en web), usamos el base64 original.
  }

  if (asset.base64) {
    return `data:image/jpeg;base64,${asset.base64}`;
  }
  return asset.uri;
}
