/*
 * Configuración del embudo de la comunidad.
 *
 * El enlace de Telegram NO está aquí: lo devuelve el servidor después de
 * registrar el correo. Si estuviera en este archivo, cualquiera podría leerlo
 * en el código de la página y saltarse el formulario, que es justo lo que le da
 * valor a la puerta.
 */
window.UDECA_COMUNIDAD = {
  /** Endpoint que guarda el contacto y devuelve el acceso. */
  apiUrl: 'https://udeca.vercel.app/api/lead',
  /** De dónde viene la visita (para saber qué campaña trae gente). */
  origen: 'instagram',
};
