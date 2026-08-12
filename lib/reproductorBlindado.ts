import { parseVimeoUrl, parseYouTubeId } from './video';

/**
 * El reproductor blindado de los cursos.
 *
 * El problema: un vídeo de curso puesto en YouTube o en Vimeo se reproduce con
 * el reproductor de ELLOS, y el reproductor de ellos viene con sus cosas
 * puestas —el título, el canal, "Compartir", "Ver en YouTube", el menú del
 * clic derecho, el logo que es un enlace—. Cada una de esas es una puerta para
 * sacar el vídeo de UDECA, y no se quitan con un parámetro: YouTube no deja.
 *
 * La solución: taparlo entero. El reproductor de ellos se carga sin controles
 * (controls=0) y encima se pone un cristal que se come TODOS los toques, así
 * que nada de lo suyo se puede pulsar aunque se dibuje. Los controles los
 * ponemos nosotros —play, atrás, adelante, la barra y el tiempo— y hablan con
 * el vídeo por la API oficial de cada plataforma. Lo que queda en pantalla es
 * un vídeo y nada más: ni logo, ni título, ni compartir, ni menú.
 *
 * No hay botón de pantalla completa, y es a propósito. La pantalla completa es
 * justo donde dejan de aplicarse las protecciones: el vídeo pasa a pintarlo el
 * sistema, por encima de la marca de agua y por encima de este cristal. En una
 * clase de pago eso es exactamente lo que no queremos.
 *
 * Y si la API de la plataforma no responde (la cambian, la bloquean, no hay
 * red), la página se DESBLINDA sola a los ocho segundos y recarga el vídeo con
 * los controles normales. Un curso que no se ve es peor problema que un curso
 * que se puede compartir: prefiero perder el blindaje antes que la clase.
 */

export type Dialecto = 'youtube' | 'vimeo';

export interface FuenteBlindada {
  dialecto: Dialecto;
  /** El reproductor sin controles propios, el que va bajo el cristal. */
  src: string;
  /** El mismo vídeo con sus controles: el paracaídas si la API no responde. */
  srcNormal: string;
}

/** El tiempo en mm:ss (o h:mm:ss), que es como se lee un vídeo. */
export function tiempoCorto(segundos: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dos = (n: number) => (n < 10 ? '0' + n : String(n));
  return h > 0 ? `${h}:${dos(m)}:${dos(r)}` : `${m}:${dos(r)}`;
}

/**
 * ¿Este enlace se puede blindar?
 *
 * Solo YouTube y Vimeo: son los únicos cuyos reproductores obedecen desde
 * fuera, y por tanto los únicos a los que se les pueden quitar los controles
 * sin dejar el vídeo inservible. Un enlace de Drive o de otro sitio se queda
 * como estaba —dentro de la app, sin menú y sin navegar fuera—, porque taparle
 * los controles sería dejar una clase que no se puede ni arrancar.
 */
export function fuenteBlindada(url: string | undefined): FuenteBlindada | null {
  if (!url) return null;

  const vimeo = parseVimeoUrl(url);
  if (vimeo) {
    const comun = new URLSearchParams({
      dnt: '1',
      pip: '0',
      byline: '0',
      title: '0',
      portrait: '0',
      // Sin la barra de Vimeo no hay logo, ni "ver en Vimeo", ni compartir.
      controls: '0',
    });
    if (vimeo.hash) comun.set('h', vimeo.hash);
    const normal = new URLSearchParams(comun);
    normal.set('controls', '1');
    return {
      dialecto: 'vimeo',
      src: `https://player.vimeo.com/video/${vimeo.id}?${comun.toString()}`,
      srcNormal: `https://player.vimeo.com/video/${vimeo.id}?${normal.toString()}`,
    };
  }

  const yt = parseYouTubeId(url);
  if (yt) {
    const comun = {
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      // Sin sugerencias, sin anotaciones y sin subtítulos automáticos encima:
      // todo eso son enlaces a otros vídeos dentro del reproductor.
      iv_load_policy: '3',
      cc_load_policy: '0',
      // Sin pantalla completa: es donde el vídeo se sale de la marca de agua.
      fs: '0',
      // Sin teclado: la barra espaciadora y las flechas son de nuestros
      // controles, y las teclas de YouTube abren cosas suyas.
      disablekb: '1',
      enablejsapi: '1',
    };
    const conControles = new URLSearchParams({ ...comun, controls: '1' });
    const sinControles = new URLSearchParams({ ...comun, controls: '0' });
    return {
      dialecto: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${yt}?${sinControles.toString()}`,
      srcNormal: `https://www.youtube-nocookie.com/embed/${yt}?${conControles.toString()}`,
    };
  }

  return null;
}

/** Segundos que saltan los botones de atrás y adelante. */
export const SALTO = 10;
/** Si la API no ha contestado en este tiempo, se desblinda y se ve igual. */
export const ESPERA_MS = 8000;

/**
 * El trozo que habla con el reproductor de YouTube.
 *
 * Va por la API oficial (la del iframe) y no por mensajes a mano: es la que
 * ellos mantienen, y la que menos posibilidades tiene de dejar de funcionar un
 * martes cualquiera con doscientos alumnos mirando.
 *
 * El estado se pregunta cuatro veces por segundo porque YouTube no avisa del
 * paso del tiempo: solo de los cambios de estado. Sin esto la barra no se
 * movería.
 */
const MANDO_YOUTUBE = `
  window.onYouTubeIframeAPIReady = function(){
    var yt = new YT.Player('v', {
      events: {
        onReady: function(){
          mando = {
            suena: function(){ yt.playVideo(); },
            pausa: function(){ yt.pauseVideo(); },
            ve: function(s){ yt.seekTo(s, true); estado.t = s; pinta(); }
          };
          estado.dur = yt.getDuration() || 0;
          arranca();
          setInterval(function(){
            try {
              estado.t = yt.getCurrentTime() || 0;
              estado.dur = yt.getDuration() || estado.dur;
              estado.sonando = yt.getPlayerState() === 1;
              pinta();
            } catch (e) {}
          }, 250);
        },
        onError: function(){ desblinda(); }
      }
    });
  };
  cargaScript('https://www.youtube.com/iframe_api');`;

/** El mismo trozo para Vimeo, que sí avisa del paso del tiempo por su cuenta. */
const MANDO_VIMEO = `
  cargaScript('https://player.vimeo.com/api/player.js', function(){
    try {
      var vp = new Vimeo.Player(marco);
      mando = {
        suena: function(){ vp.play(); },
        pausa: function(){ vp.pause(); },
        ve: function(s){ vp.setCurrentTime(s); estado.t = s; pinta(); }
      };
      vp.on('timeupdate', function(d){
        estado.t = d.seconds || 0;
        estado.dur = d.duration || estado.dur;
        pinta();
      });
      vp.on('play', function(){ estado.sonando = true; pinta(); });
      vp.on('pause', function(){ estado.sonando = false; pinta(); });
      vp.on('ended', function(){ estado.sonando = false; pinta(); });
      vp.ready().then(function(){
        vp.getDuration().then(function(d){ estado.dur = d || 0; arranca(); }, arranca);
      }, desblinda);
    } catch (e) { desblinda(); }
  });`;

/**
 * La página entera del reproductor blindado.
 *
 * Se genera aquí, en texto, porque tiene que ser LA MISMA en el móvil y en el
 * ordenador: en el móvil se carga dentro de un WebView y en el ordenador
 * dentro de un iframe con srcdoc. Escrita dos veces se romperían por separado.
 *
 * Ojo al tocarla: todo esto vive dentro de una plantilla de texto, así que
 * dentro NO puede haber acentos graves (rompen el archivo entero).
 */
export function paginaDelReproductor(fuente: FuenteBlindada): string {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}
  *{
    -webkit-user-select:none;user-select:none;
    -webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
  }
  #caja{position:absolute;inset:0;background:#000}
  #v{position:absolute;inset:0;width:100%;height:100%;border:0}
  /* El cristal: se come todos los toques para que nada del reproductor de
     ellos sea pulsable, ni el logo ni el titulo ni compartir. */
  #escudo{position:absolute;inset:0;background:transparent}
  #barra{
    position:absolute;left:0;right:0;bottom:0;
    display:flex;align-items:center;gap:10px;
    padding:10px 12px 12px;
    font:500 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    color:#fff;
    background:linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,0));
    transition:opacity .25s;
  }
  #barra.oculta{opacity:0;pointer-events:none}
  .btn{
    display:flex;align-items:center;justify-content:center;
    min-width:30px;height:30px;padding:0 6px;
    border:0;border-radius:8px;background:rgba(255,255,255,.14);color:#fff;
    font:600 11px/1 inherit;cursor:pointer;
  }
  .btn:active{background:rgba(255,255,255,.28)}
  #linea{flex:1;height:16px;display:flex;align-items:center;cursor:pointer}
  #riel{position:relative;width:100%;height:4px;border-radius:2px;background:rgba(255,255,255,.28)}
  #hecho{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:2px;background:#fff}
  #tiempo{font-variant-numeric:tabular-nums;opacity:.9;white-space:nowrap}
  #centro{
    position:absolute;inset:0;display:none;align-items:center;justify-content:center;
    color:#fff;font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    text-align:center;padding:24px;
  }
</style>
</head><body>
<div id="caja">
  <iframe id="v" src="${fuente.src}" allow="autoplay; encrypted-media" allowfullscreen="false" frameborder="0" scrolling="no"></iframe>
  <div id="escudo"></div>
  <div id="centro"></div>
  <div id="barra" class="oculta">
    <button class="btn" id="pp" aria-label="Reproducir">
      <svg width="11" height="12" viewBox="0 0 11 12" id="icono"><path fill="currentColor" d="M0 0l11 6-11 6z"/></svg>
    </button>
    <button class="btn" id="atras" aria-label="Diez segundos atras">-10</button>
    <button class="btn" id="alante" aria-label="Diez segundos adelante">+10</button>
    <div id="linea"><div id="riel"><div id="hecho"></div></div></div>
    <span id="tiempo">0:00 / 0:00</span>
  </div>
</div>
<script>
(function(){
  var SALTO = ${SALTO};
  var ESPERA = ${ESPERA_MS};
  var DIALECTO = ${JSON.stringify(fuente.dialecto)};
  var NORMAL = ${JSON.stringify(fuente.srcNormal)};

  var caja = document.getElementById('caja');
  var marco = document.getElementById('v');
  var escudo = document.getElementById('escudo');
  var barra = document.getElementById('barra');
  var centro = document.getElementById('centro');
  var pp = document.getElementById('pp');
  var icono = document.getElementById('icono');
  var linea = document.getElementById('linea');
  var hecho = document.getElementById('hecho');
  var reloj = document.getElementById('tiempo');

  // Nada de menus, ni de arrastrar, ni de seleccionar, ni de compartir: son
  // las cuatro formas de sacar el vídeo o su dirección sin tocar los botones.
  ['contextmenu','dragstart','selectstart','copy','cut'].forEach(function(n){
    document.addEventListener(n, function(e){ e.preventDefault(); }, true);
  });
  try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) {}

  var estado = { t: 0, dur: 0, sonando: false };
  var mando = null;
  var listo = false;

  function dos(n){ return n < 10 ? '0' + n : String(n); }
  function corto(s){
    s = Math.max(0, Math.floor(isFinite(s) ? s : 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h > 0 ? h + ':' + dos(m) + ':' + dos(r) : m + ':' + dos(r);
  }

  var CARA_PLAY = 'M0 0l11 6-11 6z';
  var CARA_PAUSA = 'M0 0h4v12H0zM7 0h4v12H7z';

  function pinta(){
    var p = estado.dur > 0 ? Math.min(1, estado.t / estado.dur) : 0;
    hecho.style.width = (p * 100) + '%';
    reloj.textContent = corto(estado.t) + ' / ' + corto(estado.dur);
    icono.firstChild.setAttribute('d', estado.sonando ? CARA_PAUSA : CARA_PLAY);
    pp.setAttribute('aria-label', estado.sonando ? 'Pausa' : 'Reproducir');
  }

  var escondeEn = null;
  function enseña(){
    barra.classList.remove('oculta');
    if (escondeEn) clearTimeout(escondeEn);
    // Se esconde sola solo si esta sonando: en pausa, molesta menos que
    // tener que adivinar donde tocar para volver a verla.
    escondeEn = setTimeout(function(){
      if (estado.sonando) barra.classList.add('oculta');
    }, 3000);
  }

  function alterna(){
    if (!mando) return;
    if (estado.sonando) mando.pausa(); else mando.suena();
    enseña();
  }

  escudo.addEventListener('click', function(){ if (listo) alterna(); else enseña(); });
  pp.addEventListener('click', function(e){ e.stopPropagation(); alterna(); });
  document.getElementById('atras').addEventListener('click', function(e){
    e.stopPropagation(); if (mando) mando.ve(Math.max(0, estado.t - SALTO)); enseña();
  });
  document.getElementById('alante').addEventListener('click', function(e){
    e.stopPropagation(); if (mando) mando.ve(estado.t + SALTO); enseña();
  });
  linea.addEventListener('click', function(e){
    e.stopPropagation();
    if (!mando || !estado.dur) return;
    var r = linea.getBoundingClientRect();
    mando.ve(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * estado.dur);
    enseña();
  });

  function arranca(){
    listo = true;
    barra.classList.remove('oculta');
    enseña();
    pinta();
    avisa('listo');
  }

  function avisa(que){
    var m = JSON.stringify({ de: 'reproductor', que: que });
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m); } catch (e) {}
    try { if (window.parent && window.parent !== window) window.parent.postMessage(m, '*'); } catch (e) {}
  }

  /*
   * El paracaídas.
   *
   * Si la API de la plataforma no ha contestado, el vídeo se recarga con sus
   * controles de siempre y se quita el cristal. Se pierde el blindaje, sí;
   * pero una clase que no se puede ni arrancar es un problema peor que una
   * clase que se puede compartir.
   */
  function desblinda(){
    if (listo) return;
    listo = true;
    marco.src = NORMAL;
    escudo.parentNode && escudo.parentNode.removeChild(escudo);
    barra.parentNode && barra.parentNode.removeChild(barra);
    avisa('sin-blindaje');
  }
  setTimeout(desblinda, ESPERA);

  function cargaScript(url, alCargar){
    var s = document.createElement('script');
    s.src = url;
    s.onload = alCargar;
    s.onerror = function(){ desblinda(); };
    document.head.appendChild(s);
  }

  ${fuente.dialecto === 'youtube' ? MANDO_YOUTUBE : MANDO_VIMEO}
})();
</script>
</body></html>`;
}
