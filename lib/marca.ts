/**
 * El nombre de la app, en un solo sitio.
 *
 * La app se llama MAESTRÍA EN CALISTENIA y es de Luis Tena. Antes fue CALICO,
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
export const MARCA = 'Maestría en Calistenia';

/** Lo que se lee bajo el icono en la pantalla de inicio del móvil. */
export const MARCA_CORTA = 'MASTERY';

/**
 * El nombre partido en dos líneas para los rótulos grandes: "MAESTRÍA" manda y
 * "EN CALISTENIA" va debajo, más pequeño. En una sola línea, veintidós letras
 * espaciadas no caben en la barra lateral ni en la cabecera de un móvil
 * estrecho sin bajar tanto el tamaño que deja de leerse como un nombre.
 */
export const MARCA_ARRIBA = 'MAESTRÍA';
export const MARCA_ABAJO = 'EN CALISTENIA';

/** Quién firma: va debajo del nombre en las pantallas de entrada. */
export const FIRMA = 'by Luis Tena';
