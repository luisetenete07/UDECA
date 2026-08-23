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
   * Enlaces de pago del alta.
   *
   * AHORA MISMO NO SE COBRA: los dos llevan a /proximamente, que explica que
   * los pagos no están abiertos todavía y manda a la app, que sí funciona.
   *
   * Antes había aquí dos enlaces de PRUEBA de Stripe (`buy.stripe.com/test_…`).
   * Esos no cobran de verdad: quien hubiera pulsado habría metido su tarjeta en
   * una pantalla de mentira. Por eso están fuera y no solo vacíos.
   *
   * CUANDO SE VUELVA A COBRAR
   *
   * Se crean dos Payment Links de 1 € en Stripe (Payments → Payment Links), uno
   * por rol para saber quién se da de alta, y se pegan aquí los de PRODUCCIÓN
   * (`buy.stripe.com/…`, sin `test_`). Son los MISMOS dos que van en
   * lib/subscription.ts; si cambias uno, cambia el otro. Y hay que encender
   * PAGOS_ACTIVOS en lib/planBase.ts, que es quien manda de verdad.
   *
   * Lo que viene después (los 180 €/año del entrenador con más de 5 alumnos,
   * los 10 €/mes del atleta pasados 28 días) se cobra DESDE LA APP, cuando
   * toca, no aquí: nadie paga una suscripción antes de haber usado el producto.
   */
  pagos: {
    altaAtleta: '/proximamente',
    altaCoach: '/proximamente',
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

  /**
   * Comunidad privada y redes.
   *
   * `comunidad` es la PUERTA (acceso.udeca.app): pide nombre y correo antes de
   * dar el enlace, y es la que se enseña a quien todavía no es cliente.
   * `discord` es el enlace directo al servidor, y solo se usa donde ya no hace
   * falta filtrar a nadie: en la página de gracias, con el pago hecho.
   */
  comunidad: 'https://acceso.udeca.app',
  discord: 'https://discord.gg/Mhnx5DNdY7',
  instagram: 'https://www.instagram.com/udeca.app/',
  contacto: 'luistenaf@gmail.com',
};
