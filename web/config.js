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
   * Los dos enlaces de pago. 240 €/año el entrenador, 60 €/año el atleta,
   * con la primera factura a mitad de precio (el cupón vive en Stripe).
   *
   * Son PRODUCCIÓN (`buy.stripe.com/…`, sin `test_`). Un enlace de prueba abre
   * la pasarela, acepta la tarjeta, da las gracias y no cobra nada: quien
   * pulsara se quedaría convencido de haber pagado.
   *
   * Son los MISMOS dos que van en lib/enlacesDeCobro.ts: la web los usa para
   * quien llega de fuera y la app para quien se registró sin pasar por ella.
   * Si cambias uno, cambia el otro — scripts/check-stripe.mjs se queja si se
   * separan, y ese día la mitad de las altas irían a un producto y la otra
   * mitad a otro.
   *
   * Ya no hay un enlace distinto para renovar: es la misma suscripción, que se
   * renueva sola. Los nombres `altaAtleta` y `altaCoach` se quedan porque son
   * los que lee el HTML en `data-pago`.
   *
   * Si alguna vez hay que retirarlos, se dejan en '/proximamente' —nunca con
   * un enlace de otro importe—: esa página explica que el cobro no está
   * abierto en vez de cobrar un precio que no es el que anuncia la página.
   */
  pagos: {
    // Al endpoint de pago, no al Payment Link: así la pasarela abre ya con el
    // precio del primer año, sin enseñar 240 € ocho segundos antes. Son los
    // mismos que COACH_PAGAR y ATHLETE_PAGAR de lib/enlacesDeCobro.ts.
    altaAtleta: 'https://udeca.vercel.app/api/pagar?rol=athlete',
    altaCoach: 'https://udeca.vercel.app/api/pagar?rol=trainer',
  },


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
