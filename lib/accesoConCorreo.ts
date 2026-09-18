/**
 * Entrar con correo y contraseña. TEMPORAL, Y SOLO EN iPHONE/iPAD.
 *
 * ================== ESTO SE QUITA. NO ES UNA FUNCIÓN. ==================
 *
 * POR QUÉ EXISTE
 *
 * Apple rechazó la 1.1.2 por la norma 2.1(a) pidiendo "a user name and password"
 * para poder revisar la app. Pero UDECA entra solo con Google o con Apple: no
 * hay ninguna pantalla donde escribir una contraseña, así que la cuenta de
 * demostración que crea scripts/seed-test-accounts.mjs no se podía usar para
 * entrar. Se le estaba dando al revisor unas credenciales que no abren nada.
 *
 * De las tres salidas posibles —esta, un botón de demostración con su propio
 * servidor, y un "cargar datos de ejemplo" tras entrar con Apple— se eligió la
 * que da a Apple EXACTAMENTE lo que pide, porque cada vuelta de revisión cuesta
 * días y ya van dos.
 *
 * DÓNDE SE VE: EN TODO MENOS ANDROID
 *
 *  - iPhone y iPad: porque es lo que pide la revisión de Apple.
 *  - Web: para poder probarlo al momento, sin esperar una compilación entera
 *    de iOS cada vez que se quiera comprobar que la puerta abre.
 *  - Android NO. Es donde hay usuarios de verdad y donde nadie ha pedido nada;
 *    enseñar allí una forma de entrar que vamos a quitar sería enseñársela
 *    para retirársela después.
 *
 * Lo mira `Platform.OS !== 'android'` en app/(auth)/login.tsx.
 *
 * CÓMO SE QUITA, cuando Apple acepte la versión
 *
 *  1. Borrar este fichero y scripts/check-acceso-con-correo.mjs.
 *  2. En app/(auth)/login.tsx, quitar el bloque marcado con ACCESO TEMPORAL.
 *  3. Dejar de dar esas credenciales en App Store Connect.
 *
 * No hace falta tocar nada más: `signIn` del contexto ya existía —lo usa el
 * rescate de cuentas antiguas— y no se ha modificado.
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
