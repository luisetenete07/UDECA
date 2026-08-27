/*
 * Que no se vuelva a cortar un texto en un móvil estrecho.
 *
 * DE DÓNDE SALE ESTO
 *
 * Del barrido de todas las pantallas a 320 px antes del lanzamiento. Salieron
 * veintitrés textos cortados —"Actividad (12 sema…", "Planche desde…",
 * "Grease the groo…", "Marc…"— y ninguno daba error, ni salía en los tipos, ni
 * se veía en un monitor. Solo se ven en un móvil, y muchas veces solo en el
 * más estrecho.
 *
 * Cada arreglo fue distinto, pero todos se pueden deshacer sin querer con un
 * `numberOfLines={1}` puesto de vuelta o un `flexWrap` quitado al reordenar
 * estilos. Esto los sujeta uno a uno, con el porqué al lado.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-textos-en-movil.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

console.log('\nLas piezas que se repiten en toda la app');
{
  const chip = lee('components/Chip.tsx');
  // Una etiqueta encogida se corta, y lo único que lleva escrito es su nombre.
  ok('la etiqueta no se encoge', /chip: \{[\s\S]{0,600}?flexShrink: 0,/.test(chip));

  const seg = lee('components/Segmented.tsx');
  // Con cuatro opciones, a cada segmento le tocan 102 px en un móvil de 320.
  ok('el selector deja dos líneas', /styles\.texto[\s\S]{0,220}numberOfLines=\{2\}/.test(seg));

  const col = lee('components/CollapsibleCard.tsx');
  // Título y pista, uno encima del otro: al lado no caben los dos.
  ok('el panel plegable apila título y pista', /<View style=\{styles\.textos\}>[\s\S]{0,400}styles\.hint/.test(col));
  ok('y el título puede ocupar dos líneas', /styles\.titulo\}[\s\S]{0,60}numberOfLines=\{2\}/.test(col));

  const btn = lee('components/Button.tsx');
  // Se pide a mano: un botón envuelto casi siempre es un texto demasiado largo.
  ok('el botón tiene dos líneas bajo petición', /dosLineas\?: boolean;/.test(btn));
  ok('y por defecto sigue en una', /numberOfLines=\{dosLineas \? 2 : 1\}/.test(btn));
}

console.log('\nLas pantallas donde se cortaba algo');
{
  const social = lee('app/(client)/social.tsx');
  // "Marcos Ruiz" se quedaba en "Marc…" con la insignia de TÚ al lado.
  ok('el nombre del ranking, a dos líneas', /\{member\.name\}[\s\S]{0,80}/.test(social) && /styles\.name, \{ flexShrink: 1 \}\][\s\S]{0,40}numberOfLines=\{2\}/.test(social));
  ok('y la foto deja sitio al nombre', /size=\{38\}/.test(social));

  const bloque = lee('components/BlockOverview.tsx');
  ok('"Últimas 4 semanas" cabe en dos líneas', /styles\.title\}[\s\S]{0,60}numberOfLines=\{2\}/.test(bloque));

  const cursos = lee('app/(trainer)/courses/index.tsx');
  ok('el nombre del curso, a dos líneas', /styles\.courseTitle\}[\s\S]{0,40}numberOfLines=\{2\}/.test(cursos));
  ok('y el distintivo baja si no cabe', /metaFila: \{[\s\S]{0,400}?flexWrap: 'wrap',/.test(cursos));

  const inicio = lee('app/(client)/dashboard.tsx');
  // "INTENSIFICACIÓN" y "Semana 6 de 8" no caben juntas en 222 px.
  ok('la fase y la semana pueden ir en dos filas', /cycleTop: \{[\s\S]{0,500}?flexWrap: 'wrap',/.test(inicio));

  const inicioCoach = lee('app/(trainer)/dashboard.tsx');
  // El título de una tarea lo escribe el entrenador y suele ser una frase.
  ok('la tarea del día, a dos líneas', /styles\.taskTitle\}[\s\S]{0,40}numberOfLines=\{2\}/.test(inicioCoach));

  const rutina = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('el campo de series baja si no cabe', /gtgFila: \{[\s\S]{0,500}?flexWrap: 'wrap',/.test(rutina));

  // El resumen del día va DEBAJO de la fila de botones, no a su lado: al lado
  // le quedaban 81 px y se leía "Día 1 · Intensidad ...", sin los ejercicios
  // ni las series, que es lo único que se mira sin abrir el día.
  // Se comprueba por POSICIÓN, no por forma: el resumen tiene que venir
  // DESPUÉS del último botón de la fila (la flecha de desplegar). Un regex de
  // "esto pegado a aquello" se rompe en cuanto alguien escribe un comentario
  // en medio, y entonces lo que falla es el guardián, no la app.
  ok('el resumen del día va a lo ancho',
    rutina.indexOf('styles.daySummary}') > rutina.indexOf("isOpen ? 'chevron-up' : 'chevron-down'"),
    'el resumen volvió a meterse en la fila de los botones');

  const plani = lee('app/(trainer)/clients/[id]/planning.tsx');
  ok('el nombre del ciclo, a dos líneas', /styles\.cycleName\}[\s\S]{0,40}numberOfLines=\{2\}/.test(plani));

  const cursosAlumno = lee('app/(client)/courses/index.tsx');
  ok('la descripción del curso, a tres líneas', /styles\.courseDesc\}[\s\S]{0,40}numberOfLines=\{3\}/.test(cursosAlumno));

  const carne = lee('components/ProgressCard.tsx');
  // Es un carné: el nombre es lo que acredita.
  ok('el nombre del carné, a dos líneas', /styles\.nombre\}[\s\S]{0,40}numberOfLines=\{2\}/.test(carne));

  const registrar = lee('app/(client)/registrar.tsx');
  // La etiqueta lleva una fecha dentro y no se puede acortar sin perderla.
  ok('el botón de registrar admite dos líneas', /dosLineas/.test(registrar));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
