/*
 * Las cuentas guardadas de la pantalla de entrar (lib/rememberedAccounts.ts).
 *
 * Lo que se protege:
 *
 *  1. QUE NO SE ENSEÑE EL CORREO. Se guarda —hace falta para entrar directo a
 *     esa cuenta— pero la pantalla enseña la cara y el nombre. Un correo ahí no
 *     ayuda a nadie a reconocerse y sí se lo enseña a quien mire por encima del
 *     hombro. (Esto se comprueba en la pantalla, con Playwright.)
 *  2. QUE NO SE PIERDA EL PROVEEDOR. Al recargar el perfil se vuelve a guardar
 *     la cuenta sin saber con qué se entró; si eso pisara el proveedor, el
 *     botón dejaría de saber a quién llamar y el atajo no haría nada.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-cuentas.mjs
 */
import { NOMBRE_DEL_PROVEEDOR, proveedorDe } from '../lib/proveedores.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nCon qué se entró');
{
  comprueba('Google', proveedorDe('google.com') === 'google');
  comprueba('Apple', proveedorDe('apple.com') === 'apple');
  // Una cuenta de cuando se entraba con contraseña: su atajo no llevaría a
  // ninguna parte, así que la pantalla no lo enseña.
  comprueba('contraseña queda como "otro"', proveedorDe('password') === 'otro');
  comprueba('sin dato, "otro"', proveedorDe(undefined) === 'otro' && proveedorDe(null) === 'otro');
  comprueba('uno desconocido, "otro"', proveedorDe('facebook.com') === 'otro');
}

console.log('\nCómo se llama en el botón');
{
  comprueba('Google se llama Google', NOMBRE_DEL_PROVEEDOR.google === 'Google');
  comprueba('Apple se llama Apple', NOMBRE_DEL_PROVEEDOR.apple === 'Apple');
  comprueba('y el desconocido no dice "otro"', !/^otro$/i.test(NOMBRE_DEL_PROVEEDOR.otro),
    NOMBRE_DEL_PROVEEDOR.otro);
  for (const [k, v] of Object.entries(NOMBRE_DEL_PROVEEDOR)) {
    comprueba(`"${k}" tiene nombre`, typeof v === 'string' && v.length > 0);
  }
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
