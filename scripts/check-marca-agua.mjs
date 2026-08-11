/*
 * Protección de los vídeos de los cursos (lib/marcaDeAgua.ts).
 *
 * Lo que hay que proteger aquí es la honradez del mensaje y la utilidad de la
 * marca: no prometer en web una protección que en web no existe, y que la
 * marca lleve el nombre de quien está viendo el vídeo y se mueva, porque una
 * marca fija en una esquina se recorta en diez segundos.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-marca-agua.mjs
 */
import {
  avisoDeProteccion,
  PASO_MS,
  POSICIONES,
  posicionDeMarca,
  textoDeMarca,
} from '../lib/marcaDeAgua.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nQué dice la marca');
{
  const p = { name: 'Marcos Ruiz', uid: 'abc4aPJH3bIRNHExZBaU' };
  const t = textoDeMarca(p);
  comprueba('lleva el nombre', t.includes('Marcos Ruiz'), t);
  // El nombre es lo que hace que nadie lo reenvíe; el código es lo que permite
  // saber de qué cuenta salió cuando dos alumnos se llaman igual.
  comprueba('y un código de la cuenta', /· [A-Z0-9]{5}$/.test(t), t);
  comprueba('el código sale del final del uid', t.endsWith('ZBAU'.slice(-4)) || t.endsWith('BAU'), t);
  // Una captura de una clase no tiene por qué publicar la dirección de nadie.
  comprueba('nunca lleva el correo', !t.includes('@'));

  comprueba('sin nombre, al menos la marca', textoDeMarca({ uid: 'xxxxxyyyyy' }).startsWith('UDECA'));
  comprueba('sin perfil no revienta', textoDeMarca(null) === 'UDECA');
  comprueba('un nombre con espacios de sobra se limpia', textoDeMarca({ name: '  Ana  ', uid: 'q1w2e3' }).startsWith('Ana'));
}

console.log('\nLa marca se mueve');
{
  comprueba('hay varias posiciones', POSICIONES.length >= 4);
  comprueba('todas dentro de la pantalla', POSICIONES.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
  // Ninguna en el centro exacto: tiene que molestar al que la quiera quitar, no
  // al que está viendo la clase.
  comprueba(
    'ninguna justo en el centro',
    POSICIONES.every((p) => Math.abs(p.x - 0.5) > 0.1 || Math.abs(p.y - 0.5) > 0.1)
  );
  comprueba('las esquinas están repartidas', new Set(POSICIONES.map((p) => `${p.x > 0.5}-${p.y > 0.5}`)).size >= 3);

  comprueba('va cambiando con los pasos', posicionDeMarca(0) !== posicionDeMarca(1));
  comprueba('da la vuelta', posicionDeMarca(POSICIONES.length) === posicionDeMarca(0));
  comprueba('un paso negativo no rompe', !!posicionDeMarca(-3));
  comprueba('salta cada pocos segundos', PASO_MS >= 3000 && PASO_MS <= 15000, String(PASO_MS));
}

console.log('\nLo que se le promete al usuario');
{
  // En web no hay forma de impedir una grabación de pantalla. Prometerlo sería
  // mentir, y una promesa falsa es peor que no prometer nada.
  const web = avisoDeProteccion('web');
  comprueba('en web NO se promete bloquear la grabación', !/no se puede grabar/i.test(web), web);
  comprueba('en web sí se avisa de la marca', /nombre/i.test(web));

  // En móvil sí se puede, y decirlo es justo lo que hace que se lo piensen.
  for (const p of ['ios', 'android']) {
    const t = avisoDeProteccion(p);
    comprueba(`en ${p} se dice que no se puede grabar`, /no se puede grabar/i.test(t), t);
    comprueba(`en ${p} también se avisa de la marca`, /nombre/i.test(t));
  }
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
