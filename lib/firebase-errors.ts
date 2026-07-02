const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo electrónico.',
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/invalid-credential': 'Correo electrónico o contraseña incorrectos.',
  'auth/wrong-password': 'Correo electrónico o contraseña incorrectos.',
  'auth/user-not-found': 'Correo electrónico o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Inténtalo de nuevo en unos minutos.',
  'auth/network-request-failed': 'Error de conexión. Comprueba tu internet e inténtalo de nuevo.',
};

export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (error instanceof Error && error.message) return error.message;
  return 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';
}
