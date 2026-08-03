/*
 * Resolución de imports para las comprobaciones que corren TypeScript directo
 * con `--experimental-strip-types`.
 *
 * Node exige la extensión en los imports relativos; el código de la app no la
 * lleva (ni debe: Metro y TypeScript resuelven solos). En vez de ensuciar
 * lib/ con extensiones que solo harían falta aquí, se resuelve en este gancho.
 */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
      return next(`${specifier}.ts`, context);
    }
    throw err;
  }
}
