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

const swRegistration = (base: string) => `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${base}/sw.js').then(function (reg) {
      function showUpdateBanner() {
        if (document.getElementById('udeca-update-bar')) return;
        var bar = document.createElement('div');
        bar.id = 'udeca-update-bar';
        bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:99999;background:#0D0D0D;border:1px solid #2A2A2A;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:460px;margin:0 auto;';
        var txt = document.createElement('div');
        txt.style.cssText = 'flex:1;color:#fff;font-size:14px;font-weight:600;';
        txt.textContent = 'Nueva versión disponible';
        var btn = document.createElement('button');
        btn.style.cssText = 'border:none;border-radius:10px;padding:9px 16px;font-weight:700;font-size:14px;cursor:pointer;background:linear-gradient(135deg,#C9BDB0,#A2968B);color:#0A0A0A;';
        btn.textContent = 'Actualizar';
        btn.onclick = function () { window.location.reload(); };
        bar.appendChild(txt); bar.appendChild(btn);
        document.body.appendChild(bar);
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
