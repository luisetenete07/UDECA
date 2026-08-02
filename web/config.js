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

  /**
   * Enlaces de pago de Stripe (Payments → Payment Links).
   *
   * El ALTA es de 1 €, pago único, e igual para entrenador y atleta: es lo que
   * abre la cuenta. Lo que viene después (los 180 €/año del entrenador con más
   * de 5 alumnos, los 10 €/mes del atleta pasados 14 días) se cobra DESDE LA
   * APP, cuando toca, no aquí: nadie paga una suscripción antes de haber usado
   * el producto.
   *
   * Hay que crear dos Payment Links nuevos de 1 € en Stripe —uno por rol, para
   * saber quién se da de alta— y pegarlos aquí.
   */
  pagos: {
    altaAtleta: '',
    altaCoach: '',
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
  comunidad: 'https://acceso.udeca.app',
  instagram: 'https://www.instagram.com/udeca.app/',
  contacto: 'luistenaf@gmail.com',
};
