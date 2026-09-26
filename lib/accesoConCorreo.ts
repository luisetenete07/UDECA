/**
 * Entrar con correo y contraseña. PUERTA DE SERVICIO: SE QUEDA.
 *
 * POR QUÉ EXISTE
 *
 * Apple rechazó la 1.1.2 por la norma 2.1(a) pidiendo "a user name and password"
 * para poder revisar la app. Pero UDECA entra solo con Google o con Apple: no
 * había ninguna pantalla donde escribir una contraseña, así que la cuenta de
 * demostración que crea scripts/seed-test-accounts.mjs no servía para entrar.
 *
 * POR QUÉ SE QUEDA (y no se quitó al aprobarse la 1.1.4, como se planeó)
 *
 * Apple revisa CADA actualización, y cada vez entra con las credenciales de
 * App Review Information. Sin esta puerta no hay credenciales que darle, y la
 * versión siguiente se rechazaría por lo mismo que la primera. Quitarla es
 * elegir un rechazo por actualización.
 *
 * DÓNDE SE VE: EN TODO MENOS ANDROID
 *
 *  - iPhone y iPad: es lo que usa la revisión de Apple.
 *  - Web: para poder probar la app con las cuentas de prueba.
 *  - Android NO: es donde están los usuarios y donde nadie la ha pedido.
 *
 * Plegada, al final y en gris (app/(auth)/login.tsx): no es una forma de
 * entrar que queramos enseñar, es una puerta para quien sabe que existe.
 *
 * Aquí no se importa nada para que el guardián pueda ejecutarlo.
 */

/**
 * ¿Vale este correo? Comprobación deliberadamente simple.
 *
 * Solo se mira que tenga algo, una arroba y un punto detrás. Validar correos a
 * fondo con una expresión regular es un clásico que acaba rechazando
 * direcciones legítimas, y aquí el que manda es Firebase: si el correo no
 * existe, lo dirá él. Esto solo evita mandar una petición por un dedazo obvio.
 */
export function correoValido(correo: string): boolean {
  const limpio = correo.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio);
}

/** ¿Se puede pulsar "Entrar"? Sin esto el botón manda peticiones vacías. */
export function puedeEntrarConCorreo(correo: string, contrasena: string): boolean {
  return correoValido(correo) && contrasena.length > 0;
}
