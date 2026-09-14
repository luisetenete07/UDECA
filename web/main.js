/*
 * La web es HTML plano: aquí solo se enchufan los enlaces de config.js y se
 * añaden dos detalles de comportamiento. Nada de frameworks para una página
 * que tiene que abrir en menos de un segundo.
 */
(function () {
  var C = window.UDECA || {};

  /** Enlaces de pago del alta. */
  document.querySelectorAll('[data-pago]').forEach(function (el) {
    var url = (C.pagos || {})[el.getAttribute('data-pago')];
    if (url) {
      el.href = url;
      el.rel = 'noopener';
    } else {
      // Sin enlace configurado: mejor un correo que un botón que no hace nada.
      el.href = 'mailto:' + (C.contacto || '') + '?subject=Quiero%20empezar%20en%20UDECA';
    }
  });

  /**
   * Descargas.
   *
   * Sin ficha publicada, la insignia de esa tienda SE QUITA. No se deja
   * apagada ni con un "próximamente" encima: la insignia oficial es una
   * promesa concreta —"esto está en esta tienda, pulsa y lo tienes"— y una que
   * no lleva a ninguna parte hace dudar de la página entera, no solo de ese
   * botón. Si falta una, la otra se queda sola y centrada, que se lee igual de
   * bien.
   *
   * Las tarjetas que no son insignia (la del ordenador) sí se quedan, con su
   * distintivo en texto.
   */
  document.querySelectorAll('[data-descarga]').forEach(function (el) {
    var url = (C.descargas || {})[el.getAttribute('data-descarga')];
    var estado = el.querySelector('.state');
    if (url) {
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener';
      el.classList.add('ready');
      if (estado) estado.textContent = 'Disponible';
      return;
    }
    if (el.classList.contains('badge')) {
      el.remove();
      return;
    }
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var destino = document.getElementById('comunidad');
      if (destino) destino.scrollIntoView({ behavior: 'smooth' });
    });
  });

  var enlaces = [
    ['[data-app]', C.appUrl],
    ['[data-comunidad]', C.comunidad],
    ['[data-discord]', C.discord],
    ['[data-instagram]', C.instagram],
  ];
  enlaces.forEach(function (par) {
    if (!par[1]) return;
    document.querySelectorAll(par[0]).forEach(function (el) {
      el.href = par[1];
      el.rel = 'noopener';
    });
  });
  if (C.contacto) {
    document.querySelectorAll('[data-contacto]').forEach(function (el) {
      el.href = 'mailto:' + C.contacto;
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /** La cabecera se separa del fondo solo cuando hay contenido detrás. */
  var header = document.querySelector('header');
  var marcarScroll = function () {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
  };
  marcarScroll();
  window.addEventListener('scroll', marcarScroll, { passive: true });

  /**
   * En el móvil, la tarjeta del centro de la pantalla se enciende sola.
   *
   * Con ratón basta el `:hover` del CSS, pero en un móvil no hay puntero: la
   * rejilla de seis funciones se quedaba entera apagada y se pasaba de largo.
   * Encendiendo la que tienes delante, la lista se lee.
   *
   * Solo donde NO hay puntero fino: en un ordenador, dos tarjetas encendidas a
   * la vez —la del ratón y la del centro— son un parpadeo sin sentido.
   */
  var conPuntero = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var tarjetas = document.querySelectorAll('.grid .card');
  if (!conPuntero && tarjetas.length && 'IntersectionObserver' in window) {
    var viva = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (e) {
          e.target.classList.toggle('viva', e.isIntersecting);
        });
      },
      // Una banda estrecha en mitad de la pantalla: así hay una encendida cada
      // vez, y no las tres que se ven a la vez.
      { rootMargin: '-45% 0px -45% 0px' }
    );
    tarjetas.forEach(function (el) { viva.observe(el); });
  }

  /** Aparición al entrar en pantalla. Si el navegador no la soporta, se ve todo. */
  var reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var obs = new IntersectionObserver(
    function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          obs.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px' }
  );
  reveals.forEach(function (el) { obs.observe(el); });
})();
