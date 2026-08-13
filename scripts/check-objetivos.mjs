/*
 * Los tres objetivos: corto, medio y largo plazo (lib/objetivos.ts).
 *
 * Lo que se protege aquí es el rescate del campo antiguo. Antes había UN
 * objetivo; quien lo escribió no ha hecho nada mal y no puede abrir la app un
 * día y encontrárselo en blanco. Y el rescate tiene que dejar de actuar en
 * cuanto escribe los nuevos: si no, el de siempre reaparecería para siempre en
 * el de corto plazo, aunque él lo hubiera cambiado.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-objetivos.mjs
 */
import {
  hayObjetivos,
  limpiaObjetivo,
  MAX_OBJETIVO,
  objetivosDe,
  objetivosParaGuardar,
  objetivosVisibles,
  PLAZOS,
} from '../lib/objetivos.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nUna línea es una línea');
{
  comprueba('quita los saltos de línea', limpiaObjetivo('uno\ndos') === 'uno dos');
  comprueba('junta los espacios de más', limpiaObjetivo('  uno   dos  ') === 'uno dos');
  comprueba('corta lo que no cabe', limpiaObjetivo('a'.repeat(300)).length === MAX_OBJETIVO);
  comprueba('sin texto, cadena vacía', limpiaObjetivo(undefined) === '' && limpiaObjetivo(null) === '');
}

console.log('\nEl objetivo de siempre no se pierde');
{
  const viejo = objetivosDe({ goal: 'Mi primera dominada' });
  comprueba('el antiguo entra en el de corto plazo', viejo.corto === 'Mi primera dominada');
  comprueba('y no se inventa los otros dos', viejo.medio === '' && viejo.largo === '');

  // En cuanto hay algo nuevo, el viejo deja de aparecer: lo dio por sustituido.
  const mixto = objetivosDe({ goal: 'Mi primera dominada', goalMid: 'Muscle up' });
  comprueba('con algo nuevo escrito, el antiguo ya no vuelve', mixto.corto === '', mixto.corto);
  comprueba('y se respeta lo que escribió', mixto.medio === 'Muscle up');

  const nuevos = objetivosDe({ goalShort: 'A', goalMid: 'B', goalLong: 'C' });
  comprueba('los tres nuevos se leen tal cual',
    nuevos.corto === 'A' && nuevos.medio === 'B' && nuevos.largo === 'C');

  comprueba('sin perfil no falla', objetivosDe(null).corto === '' && objetivosDe(undefined).largo === '');
}

console.log('\nQué se enseña y qué no');
{
  comprueba('sin nada, no se pinta la tarjeta', !hayObjetivos({ corto: '', medio: '', largo: '' }));
  comprueba('con uno solo, sí', hayObjetivos({ corto: '', medio: '', largo: 'Plancha' }));
  const v = objetivosVisibles({ corto: 'A', medio: '', largo: 'C' });
  comprueba('solo salen los que tienen texto', v.length === 2, String(v.length));
  comprueba('y en orden de plazo', v[0].etiqueta === 'Corto plazo' && v[1].etiqueta === 'Largo plazo',
    v.map((x) => x.etiqueta).join(' | '));
  comprueba('hay tres plazos, ni más ni menos', PLAZOS.length === 3);
}

console.log('\nAl guardar');
{
  const g = objetivosParaGuardar({ corto: '  uno\ndos ', medio: '', largo: 'tres' });
  comprueba('limpia al guardar', g.goalShort === 'uno dos');
  comprueba('los vacíos se guardan vacíos', g.goalMid === '');
  // Si el campo antiguo se quedara escrito, seguiría saliendo en cualquier
  // pantalla que aún lo lea y habría dos objetivos para la misma persona.
  comprueba('vacía el campo antiguo', g.goal === '');
  comprueba('lo guardado se vuelve a leer igual',
    objetivosDe(g).corto === 'uno dos' && objetivosDe(g).largo === 'tres');
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
