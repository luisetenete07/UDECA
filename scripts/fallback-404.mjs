/**
 * La página que se sirve cuando la dirección no tiene fichero propio.
 *
 * EL PROBLEMA
 *
 * `expo export` deja un fichero por ruta, pero las rutas con un dato dentro
 * —`clients/[id]`, `courses/[id]`— se quedan en el disco con el corchete
 * puesto. Para el alumno de verdad no hay fichero, así que GitHub Pages
 * responde con su 404. La solución de siempre es servir la app entera desde
 * `404.html`, y eso ya se hacía copiando `index.html` tal cual.
 *
 * POR QUÉ LA COPIA TAL CUAL ESTABA MAL
 *
 * `index.html` no es una plantilla vacía: trae DIBUJADA la pantalla de inicio,
 * y le dice a React que la HIDRATE (`__EXPO_ROUTER_HYDRATE__=true`), o sea,
 * que dé por bueno ese HTML y solo le enganche el comportamiento.
 *
 * Al servirlo para `/clients/<alumno>`, React se encuentra que lo pintado (el
 * inicio) no es lo que toca pintar (la ficha del alumno). Eso es un error de
 * hidratación —el 418 de React—: tira lo que había y lo vuelve a dibujar
 * entero. Se recupera, sí, pero por el camino deja un error en la consola de
 * cada una de esas pantallas y un parpadeo con la pantalla equivocada.
 *
 * LO QUE SE HACE AQUÍ
 *
 * Para ESTE fichero, y solo para este, se apaga la hidratación. Sin ella React
 * dibuja de cero lo que toca, que es justo lo correcto cuando de antemano no
 * se sabe qué pantalla van a pedir. `index.html` se queda intacto: ahí sí se
 * sabe qué se pintó, y ahí hidratar es lo que hace que la web arranque rápida.
 *
 *   node scripts/fallback-404.mjs dist
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const origen = join(dir, 'index.html');
const destino = join(dir, '404.html');

const html = readFileSync(origen, 'utf8');
const BANDERA = '__EXPO_ROUTER_HYDRATE__=true;';

// Si Expo cambia el nombre de la bandera, esto tiene que reventar aquí y no
// pasar en silencio: un fallo de hidratación no rompe la web, solo la
// empeora, y esa es justo la clase de cosa que se queda meses sin ver.
if (!html.includes(BANDERA)) {
  console.error(
    `No aparece "${BANDERA}" en ${origen}. Expo ha cambiado cómo arranca la web:\n` +
      'busca la bandera nueva en el HTML exportado y cámbiala aquí.'
  );
  process.exit(1);
}

writeFileSync(destino, html.replace(BANDERA, '__EXPO_ROUTER_HYDRATE__=false;'));
console.log(`${destino} listo (sin hidratar, para las direcciones con identificador)`);
