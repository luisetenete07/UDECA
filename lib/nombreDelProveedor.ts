/**
 * El nombre que da el proveedor al entrar, compuesto.
 *
 * SUELTO Y SIN IMPORTS, igual que lib/mensajesDeEntrada.ts y por el mismo
 * motivo: vivía dentro de appleAuth.ts, que arrastra React Native, así que
 * ningún guardián podía ejecutarlo.
 *
 * Y esta función en concreto ya costó un rechazo de Apple. Estaba escrita,
 * exportada y SIN LLAMAR por nadie: el nombre que Apple da una sola vez se
 * tiraba y la app se lo pedía después por escrito. Nada fallaba, nada
 * compilaba mal, ningún guardián se quejaba — solo que Apple no publica la app
 * (norma 4, 17 de septiembre). Una función que decide lo que ve un revisor no
 * puede quedarse sin poder probarse.
 */

/**
 * Apple manda el nombre partido en dos, y cualquiera de las dos partes puede
 * faltar: se deja dar solo el nombre, solo el apellido o ninguno. Se juntan las
 * que haya, sin dejar un espacio suelto cuando falta una.
 */
export function nombreDeApple(
  full: { givenName?: string | null; familyName?: string | null } | null | undefined
): string {
  return [full?.givenName, full?.familyName]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * EL NOMBRE RECIÉN DADO, GUARDADO AQUÍ AL VUELO.
 *
 * Por qué hace falta una caja suelta y no basta con `updateProfile`: al entrar
 * con Apple hay una CARRERA, y la perdía siempre el nombre.
 *
 *   1. `signInWithCredential` resuelve.
 *   2. Firebase avisa de que hay sesión, el contexto reparte el usuario y la
 *      app salta a la pantalla de completar cuenta.
 *   3. ...y solo DESPUÉS termina el `updateProfile` que escribe el nombre.
 *
 * La pantalla ya se había pintado en el paso 2, leyendo un `displayName`
 * vacío, y su estado inicial no se vuelve a calcular: enseñaba el campo del
 * nombre aunque el nombre llegara medio segundo más tarde. Eso es lo que ve un
 * revisor de Apple, y es la norma 4.
 *
 * Aquí se guarda ANTES de llamar a Firebase, en el instante en que Apple lo
 * entrega, así que cuando la pantalla mira ya está. No sustituye a
 * `updateProfile` —eso es lo que perdura—, le gana la carrera.
 */
let recienDado = '';

export function recordarNombreDelProveedor(nombre: string): void {
  const limpio = (nombre ?? '').trim();
  if (limpio) recienDado = limpio;
}

export function nombreRecordado(): string {
  return recienDado;
}

/** Al cerrar sesión se olvida: si no, el siguiente entraría con el nombre del anterior. */
export function olvidarNombreDelProveedor(): void {
  recienDado = '';
}

/**
 * Las direcciones que Apple inventa para quien esconde su correo. De ahí no se
 * saca ningún nombre: son letras y números al azar.
 */
export function esCorreoEscondido(email: string): boolean {
  return /@privaterelay\.appleid\.com$/i.test((email ?? '').trim());
}

/**
 * Un nombre de partida sacado del correo, para cuando no hay otro.
 *
 * No pretende acertar: pretende que NO HAGA FALTA ESCRIBIR NADA. Apple manda el
 * nombre en la primera autorización y NUNCA MÁS —ni volviendo a entrar, ni tras
 * borrar la cuenta en la app—, así que quien vuelve a entrar llega sin nombre
 * por mucho que el sistema se lo enseñara en su propia ventana. Un campo
 * obligatorio ahí es exactamente lo que Apple rechaza, y no hay forma de
 * conseguir el nombre: hay que dejar de necesitarlo.
 *
 * Se parte por los puntos, guiones y barras bajas, se tira lo que va detrás del
 * `+`, y cada trozo empieza por mayúscula.
 */
export function nombreDeCorreo(email: string): string {
  const limpio = (email ?? '').trim();
  if (!limpio || esCorreoEscondido(limpio)) return '';
  const antesDeLaArroba = limpio.split('@')[0].split('+')[0];
  return antesDeLaArroba
    .split(/[._-]+/)
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' ')
    .slice(0, 40)
    .trim();
}

/**
 * Con qué nombre se llega a la pantalla de completar cuenta.
 *
 * Por orden: el que Firebase ya tiene guardado, el que el proveedor acaba de
 * dar (ver la carrera de arriba), y el que se deduce del correo. Si de los tres
 * no sale nada, vacío — y entonces la pantalla lo pide, pero SIN OBLIGAR.
 */
export function nombreParaEmpezar(
  guardado: string | null | undefined,
  recordado: string,
  email: string | null | undefined
): string {
  return (guardado ?? '').trim() || (recordado ?? '').trim() || nombreDeCorreo(email ?? '');
}
