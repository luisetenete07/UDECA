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
    navigator.serviceWorker.register('${base}/sw.js').catch(function () {});
  });
}
`;

const backgroundStyle = `
html, body { background-color: #000000; }
@media (prefers-color-scheme: light) {
  html, body { background-color: #000000; }
}
`;
