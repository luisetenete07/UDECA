/**
 * El error de Firebase, dicho como se lo diría una persona.
 *
 * Los códigos crudos ("auth/wrong-password") no ayudan a nadie, y el mensaje en
 * inglés que trae dentro, tampoco.
 *
 * ESTE FICHERO NO IMPORTA NADA, Y ESO ES DELIBERADO. Vivía dentro de
 * enlazarCuenta.ts, que arrastra Firebase y con él React Native, así que ningún
 * guardián podía ejecutarlo: se comprobaba leyendo el texto del fichero, que es
 * como no comprobar nada. Y justo aquí estaba el fallo que costó el rechazo de
 * Apple del 15 de septiembre. Suelto y sin dependencias, check-login-directo.mjs
 * lo llama de verdad, con errores de mentira, y comprueba lo que sale.
 */

/**
 * De dónde viene el intento de entrada.
 *
 * `contrasena` es el rescate de una cuenta que ya existía con correo y clave.
 * `proveedor` es Google o Apple, que es por donde entra todo el mundo.
 */
export type OrigenDeEntrada = 'contrasena' | 'proveedor';

/**
 * El código de Firebase, pequeño y detrás del mensaje.
 *
 * NO es para el usuario: es para que quien esté al otro lado del correo de
 * soporte —o un revisor de Apple mandando una captura— pueda decir QUÉ ha
 * fallado en vez de "salió un error". Cuando esto se rompa otra vez, la
 * diferencia entre arreglarlo en diez minutos o gastar tres compilaciones
 * adivinando es exactamente esta línea.
 *
 * Va sin el prefijo `auth/`, que no aporta nada, y solo si Firebase ha dado un
 * código: un paréntesis vacío es peor que nada.
 */
function conCodigo(mensaje: string, codigo: string): string {
  const limpio = codigo.replace(/^auth\//, '').trim();
  return limpio ? `${mensaje} (${limpio})` : mensaje;
}

export function mensajeDeEntrada(e: unknown, origen: OrigenDeEntrada = 'contrasena'): string {
  const codigo = (e as { code?: string })?.code ?? '';

  /*
   * `invalid-credential` SIGNIFICA DOS COSAS MUY DISTINTAS, Y ESTO LAS SEPARA.
   *
   * Con correo y contraseña quiere decir "la contraseña no es". Pero Firebase
   * devuelve EL MISMO CÓDIGO cuando rechaza una credencial de Google o de
   * Apple, y ahí no hay ninguna contraseña de por medio.
   *
   * Eso es lo que le pasó al revisor de Apple el 15 de septiembre: pulsó
   * "Entrar con Apple", falló, y la app le contestó "Esa contraseña no es, pide
   * restablecerla desde abajo" — en una pantalla donde no hay ningún campo de
   * contraseña, en una app que no tiene contraseñas. La respuesta fue un
   * rechazo por la norma 2.1(a), y con razón: ese mensaje no ayuda a nadie a
   * salir del sitio.
   *
   * Con un proveedor, el mensaje dice lo que de verdad ha pasado y ofrece la
   * salida que existe: entrar con el otro.
   */
  if (origen === 'proveedor') {
    if (/invalid-credential|invalid-login|account-exists/.test(codigo)) {
      return conCodigo(
        'No hemos podido validar esa cuenta. Prueba con el otro botón de entrada, o escríbenos.',
        codigo
      );
    }
    if (codigo.includes('operation-not-allowed')) {
      return conCodigo('Esa forma de entrar no está disponible ahora mismo. Prueba con la otra.', codigo);
    }
    if (codigo.includes('network-request-failed')) return 'Sin conexión. Inténtalo de nuevo.';
    if (codigo.includes('too-many-requests')) {
      return 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.';
    }
    if (codigo.includes('popup-blocked')) {
      return 'Tu navegador ha bloqueado la ventana de acceso. Permítela y vuelve a probar.';
    }
    if (codigo.includes('unauthorized-domain')) {
      return conCodigo('Este sitio no está autorizado para entrar. Avisa a UDECA.', codigo);
    }
    return conCodigo('No se ha podido entrar. Inténtalo otra vez en un momento.', codigo);
  }

  if (/wrong-password|invalid-credential|invalid-login/.test(codigo)) {
    return 'Esa contraseña no es. Si no te acuerdas, pide restablecerla desde abajo.';
  }
  if (codigo.includes('user-not-found')) return 'No hay ninguna cuenta con ese correo.';
  if (codigo.includes('too-many-requests')) {
    return 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.';
  }
  if (codigo.includes('network-request-failed')) return 'Sin conexión. Inténtalo de nuevo.';
  if (codigo.includes('email-already-in-use')) return 'Ese correo ya está en otra cuenta.';
  if (codigo.includes('weak-password')) return 'La contraseña necesita al menos 6 caracteres.';
  if (codigo.includes('invalid-email')) return 'Ese correo no parece válido.';
  if (codigo.includes('popup-blocked')) {
    return 'Tu navegador ha bloqueado la ventana de acceso. Permítela y vuelve a probar.';
  }
  if (codigo.includes('unauthorized-domain')) {
    return 'Este sitio no está autorizado para entrar. Avisa a UDECA.';
  }
  if (codigo.includes('operation-not-allowed')) {
    return 'Esa forma de entrar no está disponible ahora mismo. Prueba con la otra.';
  }
  // Cualquier otra cosa se dice en cristiano. El texto que trae Firebase
  // ("Firebase: Error (auth/internal-error).") no le sirve a nadie que esté
  // intentando entrar en una app de entrenamiento, y encima da mala espina.
  return 'No se ha podido entrar. Inténtalo otra vez en un momento.';
}
