import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Envoltorio HTML para la versión web (solo afecta a web). Añade el manifiesto
 * PWA, el color de tema y los metadatos para que la app se pueda "instalar"
 * en la pantalla de inicio del móvil y se abra a pantalla completa.
 */
export default function Root({ children }: PropsWithChildren) {
  const base = process.env.EXPO_BASE_URL || '';
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="UDECA" />
        <title>UDECA — Universidad de Calistenia</title>
        <link rel="manifest" href={`${base}/manifest.json`} />
        <link rel="apple-touch-icon" href={`${base}/icon-180.png`} />

        {/* Fondo negro inmediato para evitar el destello blanco al cargar. */}
        <style dangerouslySetInnerHTML={{ __html: backgroundStyle }} />
        <ScrollViewStyleReset />

        {/* Service worker: carga instantánea y soporte offline de la PWA. */}
        <script dangerouslySetInnerHTML={{ __html: swRegistration(base) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/*
 * Registro del service worker y aviso de versión nueva.
 *
 * Lo que fallaba: el navegador solo comprueba si hay una versión nueva al
 * navegar o cada muchas horas. En una app instalada, que se abre y se cierra
 * sin navegar nunca, esa comprobación podía no ocurrir en días — y el usuario
 * se quedaba con la versión vieja sin saber por qué, aunque la nueva llevara
 * publicada desde la mañana.
 *
 * Ahora se pregunta al cargar y cada vez que la app vuelve a primer plano, que
 * es justo cuando alguien la abre esperando ver lo último. Y se mira si ya
 * había una versión esperando de la sesión anterior, porque en ese caso
 * "updatefound" no vuelve a dispararse y el aviso no salía nunca.
 *
 * ACTUALIZAR ES OBLIGATORIO
 *
 * El aviso era una barra que se podía ignorar, y la ignoraba justo quien peor
 * versión tenía: se quedaba semanas con la de hace tres despliegues, arrastrando
 * fallos ya corregidos y escribiendo al soporte por cosas que no existen desde
 * hace un mes. Con dos versiones en la calle, cada fallo se responde dos veces.
 *
 * Ahora tapa la pantalla y solo tiene un botón. En la web esto casi no cuesta:
 * recargar tarda un segundo y no hay nada que descargar.
 *
 * SIGUE SIN RECARGAR SOLA, Y ESO IMPORTA. Alguien puede estar a mitad de una
 * serie; quitarle la pantalla de debajo sin avisar es perderle el sitio. El
 * muro dice lo que va a pasar y espera a que lo pulse él, que es la diferencia
 * entre obligar y arrebatar.
 *
 * Se pinta a mano, sin React, porque esto vive en el HTML: tiene que poder
 * aparecer aunque el JavaScript de la app se haya quedado a medias, que es
 * precisamente uno de los casos en los que hay que actualizar.
 */
const swRegistration = (base: string) => `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${base}/sw.js', { updateViaCache: 'none' }).then(function (reg) {
      function showUpdateBanner() {
        if (document.getElementById('udeca-update-bar')) return;
        var fondo = document.createElement('div');
        fondo.id = 'udeca-update-bar';
        fondo.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
        var caja = document.createElement('div');
        caja.style.cssText = 'max-width:380px;width:100%;text-align:center;';
        var tit = document.createElement('div');
        tit.style.cssText = 'color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.3px;';
        tit.textContent = 'Hay una versión nueva';
        var txt = document.createElement('div');
        txt.style.cssText = 'color:#9A9A9A;font-size:15px;line-height:22px;margin-top:10px;';
        txt.textContent = 'Actualiza para seguir entrenando. Tarda un segundo y no pierdes nada de lo que tienes guardado.';
        var btn = document.createElement('button');
        btn.style.cssText = 'margin-top:24px;width:100%;border:none;border-radius:14px;padding:15px 16px;font-weight:700;font-size:16px;cursor:pointer;background:linear-gradient(135deg,#C9BDB0,#A2968B);color:#0A0A0A;';
        btn.textContent = 'Actualizar';
        btn.onclick = function () { window.location.reload(); };
        caja.appendChild(tit); caja.appendChild(txt); caja.appendChild(btn);
        fondo.appendChild(caja);
        document.body.appendChild(fondo);
        // Detrás del muro no se puede seguir tocando ni desplazando: si se
        // pudiera, no sería obligatorio.
        document.documentElement.style.overflow = 'hidden';
      }
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      // Una versión que quedó instalada en la sesión anterior: "updatefound"
      // ya no volverá a saltar, así que el aviso hay que ponerlo aquí.
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();

      /*
       * El service worker nuevo entra solo (hace skipWaiting), pero la pantalla
       * sigue siendo la vieja hasta que se recargue. Ese cambio de mando es la
       * señal más fiable de que hay algo nuevo que ver.
       *
       * SOLO SI YA HABÍA UNO MANDANDO. En la PRIMERA visita no hay ninguno, y
       * el que se acaba de instalar también dispara este aviso: sin esta
       * condición, quien abre la app por primera vez se encuentra un muro
       * diciéndole que actualice algo que acaba de cargar.
       *
       * Con la barra pequeña de antes eso era una molestia y pasó desapercibido.
       * Convertida en un muro que tapa la pantalla, es lo primero que vería un
       * usuario nuevo. Lo cazaron las pruebas: cada navegador limpio se comía el
       * muro y no podía tocar nada.
       */
      var yaHabiaControl = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (yaHabiaControl) showUpdateBanner();
      });

      // Preguntar de verdad: al cargar y cada vez que se vuelve a la app.
      var ultima = 0;
      function mirarSiHayNueva() {
        var ahora = Date.now();
        if (ahora - ultima < 60000) return; // sin machacar el servidor
        ultima = ahora;
        reg.update().catch(function () {});
      }
      mirarSiHayNueva();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') mirarSiHayNueva();
      });
    }).catch(function () {});
  });
}
`;

const backgroundStyle = `
html, body {
  background-color: #000000;
  overflow-x: hidden;
  max-width: 100%;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
#root { overflow-x: hidden; }
* { -webkit-tap-highlight-color: transparent; }
::selection { background: rgba(162,150,139,0.35); color: #fff; }
input, textarea, button, select { font-family: inherit; }
/* Enfoque accesible y premium: aro dorado suave en vez del contorno del navegador. */
:focus-visible { outline: 2px solid rgba(162,150,139,0.6); outline-offset: 2px; }
/* Barra de scroll discreta a juego con el tema oscuro. */
* { scrollbar-width: thin; scrollbar-color: #2A2A2A transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: #262626; border-radius: 8px; border: 2px solid #000;
}
::-webkit-scrollbar-thumb:hover { background: #3A3A3A; }
/* Tipografía nítida en pantallas de alta densidad. */
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
/* Las imágenes nunca se arrastran como fantasma al hacer clic. */
img { -webkit-user-drag: none; }
@media (prefers-color-scheme: light) {
  html, body { background-color: #000000; }
}
`;
