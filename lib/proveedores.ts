/**
 * Con qué se entra: Google o Apple.
 *
 * Vive aparte de `lib/rememberedAccounts` porque aquel importa AsyncStorage y
 * eso no se puede cargar desde Node pelado, así que sus comprobaciones no
 * podrían ejecutarse. Aquí no hay dependencias: es traducir un identificador
 * de Firebase a algo que se pueda pintar en un botón.
 */
export type ProveedorDeEntrada = 'google' | 'apple' | 'otro';

/**
 * El proveedor de Firebase, traducido a lo nuestro.
 *
 * Lo que no es Google ni Apple cae en 'otro', y eso incluye las cuentas de
 * cuando se entraba con contraseña. La pantalla de acceso no les enseña atajo:
 * no habría a quién llamar al pulsarlo, y un botón que no hace nada es peor que
 * un botón que no está.
 */
export function proveedorDe(providerId: string | undefined | null): ProveedorDeEntrada {
  if (providerId === 'google.com') return 'google';
  if (providerId === 'apple.com') return 'apple';
  return 'otro';
}

/** Cómo se llama, para el botón. */
export const NOMBRE_DEL_PROVEEDOR: Record<ProveedorDeEntrada, string> = {
  google: 'Google',
  apple: 'Apple',
  otro: 'tu cuenta',
};
