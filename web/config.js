/*
 * Todo lo que hay que rellenar de la web pública está AQUÍ, en un solo sitio.
 * Cambiar un enlace no debería obligar a tocar el HTML ni a saber programar.
 *
 * Cuando algo esté vacío, la web se comporta sola: los botones de descarga
 * salen como "Próximamente" y no llevan a ninguna parte rota.
 */
window.UDECA = {
  /** Dónde vive la app mientras no está en las tiendas. */
  appUrl: 'https://app.udeca.app',

  /** Enlaces de pago de Stripe (Payments → Payment Links). */
  pagos: {
    // Atleta: 10 €/mes.
    atleta: 'https://buy.stripe.com/test_14A7sM2zO8275Gf6iA7g400',
    // Entrenador: 180 €/año.
    coach: 'https://buy.stripe.com/test_aFa5kEcao8277On4as7g401',
  },

  /**
   * Descargas. Deja el valor vacío mientras la ficha no esté publicada: el
   * botón se queda en "Próximamente" en vez de llevar a un 404.
   */
  descargas: {
    appStore: '',
    playStore: '',
    apkPc: '',
  },

  /** Comunidad privada y redes. */
  comunidad: 'https://comunidad.udeca.app',
  instagram: 'https://www.instagram.com/udeca.app/',
  contacto: 'luistenaf@gmail.com',
};
