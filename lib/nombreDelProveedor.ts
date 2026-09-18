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
