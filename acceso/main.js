/*
 * Puerta de la comunidad: nombre + correo → el servidor lo guarda y devuelve el
 * enlace del grupo.
 *
 * El enlace nunca viaja con la página: llega en la respuesta. Así el formulario
 * es una puerta de verdad y no un adorno delante de una URL que está en el
 * código fuente.
 */
(function () {
  var C = window.UDECA_COMUNIDAD || {};
  var form = document.getElementById('form');
  var nombre = document.getElementById('nombre');
  var email = document.getElementById('email');
  var boton = document.getElementById('enviar');
  var error = document.getElementById('error');
  var pasoForm = document.getElementById('paso-form');
  var pasoOk = document.getElementById('paso-ok');
  var enlace = document.getElementById('enlace');
  var enlaceTexto = document.getElementById('enlace-texto');
  var saludo = document.getElementById('saludo');
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  var mostrarError = function (texto) {
    error.textContent = texto;
    error.hidden = false;
  };
  var limpiarError = function () {
    error.hidden = true;
    nombre.classList.remove('invalid');
    email.classList.remove('invalid');
  };
  [nombre, email].forEach(function (campo) {
    campo.addEventListener('input', limpiarError);
  });

  // Validación mínima y honesta: que haya nombre y que el correo tenga forma de
  // correo. Lo demás lo comprueba el servidor.
  var correoValido = function (v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limpiarError();

    var n = nombre.value.trim();
    var m = email.value.trim();
    if (n.length < 2) {
      nombre.classList.add('invalid');
      nombre.focus();
      return mostrarError('Dinos cómo te llamas.');
    }
    if (!correoValido(m)) {
      email.classList.add('invalid');
      email.focus();
      return mostrarError('Ese correo no parece válido. Revísalo y volvemos a intentarlo.');
    }

    boton.disabled = true;
    boton.textContent = 'Abriendo la puerta…';

    fetch(C.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: n,
        email: m,
        source: C.origen || 'web',
        // De qué enlace concreto viene, si la campaña lo trae (?utm_source=...).
        campaign: new URLSearchParams(location.search).get('utm_source') || '',
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        if (!r.ok || !r.data || !r.data.url) {
          // El servidor sabe POR QUÉ no puede (aún no está abierta, correo mal
          // escrito…). Tragarse ese motivo y soltar un "inténtalo más tarde"
          // deja a la persona sin saber qué hacer y a nosotros sin saber qué
          // arreglar, así que se enseña tal cual viene.
          var e = new Error((r.data && r.data.error) || 'No se pudo completar');
          e.delServidor = true;
          throw e;
        }
        enlace.href = r.data.url;
        enlaceTexto.textContent = r.data.url;
        saludo.textContent = n + ', tu sitio en la comunidad está listo.';
        pasoForm.hidden = true;
        pasoOk.hidden = false;
        // Abrir el grupo solo cuando lo pulse: abrirlo solo lo bloquea el navegador.
        enlace.focus();
      })
      .catch(function (e) {
        boton.disabled = false;
        boton.textContent = 'Desbloquear acceso';
        mostrarError(
          e && e.delServidor
            ? e.message
            : // Aquí no hubo respuesta: sin red, o el servidor no contesta.
              'No hemos podido conectar. Comprueba tu conexión e inténtalo otra vez.'
        );
      });
  });
})();
