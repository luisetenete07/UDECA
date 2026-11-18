/*
 * Todo lo que hay que rellenar de la web pública está AQUÍ, en un solo sitio.
 * Cambiar un enlace no debería obligar a tocar el HTML ni a saber programar.
 *
 * Cuando algo esté vacío, la web se comporta sola: los botones de descarga
 * salen como "Próximamente" y no llevan a ninguna parte rota.
 */
window.CALICO = {
  /** Dónde vive la app mientras no está en las tiendas. */
  appUrl: 'https://app.udeca.app',

  /**
   * Adónde lleva "Crear mi cuenta": en iPhone a la App Store, en Android a
   * Google Play y en el ordenador a la app web. Apagado (false) manda a todos
   * a la app web.
   *
   * La web ya no cobra nada: Maestría en Calistenia es de un solo entrenador
   * y se entra cuando él acepta la solicitud.
   */
  pruebaEnTiendas: true,

  /**
   * Descargas. Deja el valor vacío mientras la ficha no esté publicada: el
   * botón se queda en "Próximamente" en vez de llevar a un 404.
   *
   * NO hay descarga directa de APK, y no es un olvido: un APK repartido fuera
   * de la tienda tendría que traer su propio actualizador —Google prohíbe que
   * una app publicada en Play se actualice por su cuenta—, y eso es mantener
   * dos versiones distintas de Android para siempre. Con Play cubriendo el
   * móvil y la app web instalable en el ordenador, no compensa.
   */
  descargas: {
    appStore: 'https://apps.apple.com/app/id6794591283',
    playStore: 'https://play.google.com/store/apps/details?id=entrenadores.app',
  },

  instagram: 'https://www.instagram.com/udeca.app/',
  contacto: 'luistenaf@gmail.com',
};
