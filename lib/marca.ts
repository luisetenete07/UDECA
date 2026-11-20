/**
 * El nombre de la app, en un solo sitio.
 *
 * La app se llama MASTERY y es de Luis Tena. Antes fue CALICO y, unos días,
 * "Mastery"; Luis la dejó en Mastery, a secas. Antes de CALICO,
 * una app para muchos entrenadores en la que cada uno podía poner su marca;
 * eso se acabó con la app de un solo coach, y con ello la marca dejó de ser un
 * dato de cada cuenta para ser una constante.
 *
 * Bajo el icono del móvil se lee `MARCA_CORTA` (lo fija app.json): el nombre
 * entero no cabe y el sistema lo cortaría con puntos suspensivos. Dentro de la
 * app, en la web y en todo lo que se comparte, el nombre completo.
 *
 * Aquí no se importa nada a propósito: lo leen las tarjetas que se pintan en un
 * lienzo, el informe en PDF y las comprobaciones, que corren en Node pelado.
 */
export const MARCA = 'Mastery';

/** Lo que se lee bajo el icono en la pantalla de inicio del móvil. */
export const MARCA_CORTA = 'MASTERY';

/**
 * Los rótulos grandes (la pantalla de entrar, las tarjetas que se comparten):
 * MASTERY arriba y, debajo y más pequeño, @luistenafit. Lo mismo que se lee
 * arriba a la izquierda dentro de la app.
 */
export const MARCA_ARRIBA = 'MASTERY';

/**
 * El usuario de Luis en redes. Va debajo de MASTERY arriba a la izquierda: la
 * app es suya, y es lo primero que se lee al abrirla.
 */
export const ARROBA = '@luistenafit';

/** Lo que va debajo de MASTERY en los rótulos grandes. */
export const MARCA_ABAJO = ARROBA;

/**
 * El color del tridente (assets/emblema.png), medido en el propio dibujo.
 * MASTERY va siempre en este color: lo pidió Luis, para que nombre y logo se
 * lean como una sola pieza y no como un dibujo y un rótulo puestos al lado.
 */
export const COLOR_DEL_TRIDENTE = '#E2DCD6';

/** Quién firma: va debajo del nombre en las pantallas de entrada. */
export const FIRMA = 'by Luis Tena';
