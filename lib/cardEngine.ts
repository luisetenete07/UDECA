/**
 * Motor de las tarjetas de marca UDECA (1080×1350 PNG).
 *
 * El dibujo vive UNA sola vez, en CARD_SCRIPT, porque tiene que ejecutarse en
 * dos sitios distintos:
 *  - En web se ejecuta directamente sobre un <canvas> de la página.
 *  - En móvil no existe <canvas>, así que el mismo código corre dentro de un
 *    WebView oculto que devuelve el PNG ya renderizado.
 * De este modo la imagen es idéntica en los dos entornos y no hay dos diseños
 * que mantener en paralelo.
 *
 * El script está escrito sin plantillas de cadena (usa concatenación) para
 * poder incrustarlo tal cual, sin escapes, en el HTML del WebView.
 */

export type CardKind = 'session' | 'record' | 'report' | 'member';

export interface SessionCardData {
  routineName: string;
  dayName?: string;
  durationMin: number;
  sets: number;
  reps: number;
  seconds: number;
  volumeKg: number;
  streak: number;
  prCount: number;
  date?: number;
}

export interface RecordCardData {
  prs: { exerciseName: string; label: string }[];
  streak?: number;
  clientName?: string;
}

export interface ReportCardData {
  clientName: string;
  totalWorkouts: number;
  daysTrained: number;
  totalHours: number;
  bestPushIso?: string;
  bestPullIso?: string;
  bestPushReps?: string;
  bestPullReps?: string;
  weightChangeKg?: number;
  periodLabel?: string;
}

/**
 * Carné de miembro: quién eres dentro de UDECA.
 *
 * Es la tarjeta que se enseña, no la que se consulta: por eso lleva pocos
 * datos y grandes. El número de fundador, cuando lo hay, es el protagonista.
 */
export interface MemberCardData {
  name: string;
  /** Etiqueta del tipo de cuenta: ENTRENADOR, ATLETA o ALUMNO. */
  roleLabel: string;
  /** Número de fundador. Sin él, es la tarjeta normal de su tipo de cuenta. */
  founderNumber?: number;
  /** "julio de 2026". */
  since?: string;
  /** Frase corta bajo el rol (lo que hace esa cuenta). */
  tagline?: string;
}

export type CardData = SessionCardData | RecordCardData | ReportCardData | MemberCardData;

/**
 * Código de dibujo. Define `udecaDrawCard(canvas, kind, data, logoUri)` y
 * devuelve una promesa que se resuelve cuando la tarjeta está pintada.
 */
export const CARD_SCRIPT = `
var W = 1080, H = 1350;
var BG = '#000000';
var GOLD = '#A2968B';
var GOLD_SOFT = '#C9BDB0';
var TEXT = '#FFFFFF';
var MUTED = '#ADADAD';
var FAINT = '#666666';
/*
 * La letra de las imágenes que se comparten.
 *
 * Era una SERIF —Georgia, Times—, que es la voz de antes del rediseño: cuando
 * la app cambió Cinzel por Sora, estas tarjetas se quedaron atrás. Y son
 * precisamente lo que sale de la app: la sesión que alguien sube a Instagram, su
 * récord, su carné. La marca hablando con dos voces justo donde más se la ve.
 *
 * No se carga Sora de la red a propósito. La imagen se genera dentro de un
 * WebView, muchas veces al terminar de entrenar y a veces en un sótano sin
 * cobertura: una tarjeta que depende de descargar una fuente es una tarjeta que
 * a veces no sale. Se usa la geométrica del sistema, que en iPhone y en Android
 * está siempre y se parece mucho más a Sora que una romana.
 */
var DISPLAY = '"Avenir Next", "Segoe UI", Roboto, system-ui, sans-serif';
var BODY = '"Avenir Next", "Segoe UI", Roboto, system-ui, sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Elige el cuerpo más grande con el que el texto CABE, en vez de recortarlo.
 *
 * Recortar vale para un nombre largo, donde "Marcos Ruiz Fernán…" sigue
 * diciendo quién es. No vale para una palabra suelta que ES el contenido: el
 * oficio dentro de la anilla salía "ENTR…", que no es una abreviatura, es un
 * defecto. Aquí se encoge la letra hasta que entra.
 */
function fitFont(ctx, text, maxWidth, maxSize, minSize, weight, family) {
  var tam = maxSize;
  while (tam > minSize) {
    ctx.font = weight + ' ' + tam + 'px ' + family;
    if (ctx.measureText(text).width <= maxWidth) return tam;
    tam -= 2;
  }
  ctx.font = weight + ' ' + minSize + 'px ' + family;
  return minSize;
}

/** Recorta el texto con … si excede el ancho disponible. */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  var t = text;
  while (t.length > 2 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function loadLogo(uri) {
  return new Promise(function (resolve) {
    if (typeof Image === 'undefined' || !uri) return resolve(null);
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { resolve(null); };
    img.src = uri;
  });
}

/** Fondo + halo + marco + emblema y logotipo (sesión e informe). */
function drawFrame(ctx, logo) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  var glow = ctx.createRadialGradient(W / 2, 220, 0, W / 2, 220, 780);
  glow.addColorStop(0, 'rgba(162, 150, 139, 0.20)');
  glow.addColorStop(1, 'rgba(162, 150, 139, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(162, 150, 139, 0.45)';
  ctx.lineWidth = 4;
  roundRect(ctx, 40, 40, W - 80, H - 80, 44);
  ctx.stroke();
  ctx.textAlign = 'center';
  if (logo) ctx.drawImage(logo, W / 2 - 52, 44, 104, 104);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '600 54px ' + DISPLAY;
  ctx.fillText('U D E C A', W / 2, 198);
  ctx.fillStyle = MUTED;
  ctx.font = '600 23px ' + BODY;
  ctx.fillText('U N I V E R S I D A D   D E   C A L I S T E N I A', W / 2, 238);
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 40, 262, 80, 3);
}

function drawFooter(ctx) {
  ctx.fillStyle = FAINT;
  ctx.font = '600 30px ' + BODY;
  ctx.textAlign = 'center';
  ctx.fillText('w w w . u d e c a . a p p', W / 2, 1265);
}

/** Casilla de estadística: caja redondeada con valor grande y etiqueta. */
function drawStat(ctx, x, y, w, h, value, label) {
  ctx.fillStyle = 'rgba(162, 150, 139, 0.07)';
  roundRect(ctx, x, y, w, h, 26);
  ctx.fill();
  ctx.strokeStyle = 'rgba(162, 150, 139, 0.28)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 26);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = TEXT;
  ctx.font = '800 64px ' + BODY;
  ctx.fillText(fit(ctx, value, w - 50), x + w / 2, y + h / 2 + 4);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '600 25px ' + BODY;
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h - 32);
}

function formatSessionDate(ts) {
  var wd = new Date(ts).toLocaleDateString('es-ES', { weekday: 'long' });
  var dmy = new Date(ts).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  return wd.charAt(0).toUpperCase() + wd.slice(1) + ' ' + dmy;
}

function drawSession(ctx, data) {
  ctx.fillStyle = TEXT;
  ctx.font = '600 62px ' + DISPLAY;
  ctx.fillText('SESIÓN COMPLETADA', W / 2, 362);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '700 38px ' + BODY;
  var sub = data.routineName + (data.dayName ? ' · ' + data.dayName : '');
  ctx.fillText(fit(ctx, sub, W - 200), W / 2, 424);

  // Rejilla 2×2. Series, repeticiones e ISOMÉTRICOS se muestran siempre
  // (aunque valgan 0): la tarjeta debe tener siempre el mismo bloque.
  var stats = [];
  if (data.durationMin > 0) stats.push([data.durationMin + ' min', 'Duración']);
  stats.push([String(data.sets), 'Series']);
  stats.push([String(data.reps), 'Repeticiones']);
  stats.push([data.seconds + ' s', 'Isométricos']);
  if (data.volumeKg > 0) stats.push([data.volumeKg.toLocaleString('es-ES') + ' kg', 'Volumen']);
  var shown = stats.slice(0, 4);

  var bw = 440, bh = 210, gap = 40;
  var cols = shown.length === 1 ? 1 : 2;
  var rows = Math.ceil(shown.length / cols);
  var x0 = (W - (cols * bw + (cols - 1) * gap)) / 2;
  var gridH = rows * bh + (rows - 1) * gap;

  var extras = [];
  if (data.prCount > 0) {
    extras.push({
      text: data.prCount === 1 ? 'NUEVO RÉCORD PERSONAL' : data.prCount + ' RÉCORDS PERSONALES',
      color: GOLD_SOFT, font: '800 40px ' + BODY, gapBefore: 70
    });
  }
  if (data.streak > 1) {
    extras.push({
      text: 'Racha de ' + data.streak + ' días',
      color: '#ECEDEF', font: '600 36px ' + BODY,
      gapBefore: extras.length > 0 ? 56 : 70
    });
  }
  if (data.date) {
    extras.push({
      text: formatSessionDate(data.date),
      color: MUTED, font: '600 32px ' + BODY,
      gapBefore: extras.length > 0 ? 54 : 70
    });
  }
  var extrasH = 0;
  for (var i = 0; i < extras.length; i++) extrasH += extras[i].gapBefore;

  var REGION_TOP = 470, REGION_BOTTOM = 1210;
  var blockH = gridH + extrasH;
  var y0 = Math.round(REGION_TOP + Math.max(0, (REGION_BOTTOM - REGION_TOP - blockH) / 2));

  for (var j = 0; j < shown.length; j++) {
    var cx = x0 + (j % cols) * (bw + gap);
    var cy = y0 + Math.floor(j / cols) * (bh + gap);
    drawStat(ctx, cx, cy, bw, bh, shown[j][0], shown[j][1]);
  }
  var footY = y0 + gridH;
  for (var k = 0; k < extras.length; k++) {
    footY += extras[k].gapBefore;
    ctx.fillStyle = extras[k].color;
    ctx.font = extras[k].font;
    ctx.fillText(extras[k].text, W / 2, footY);
  }
}

/** Tarjeta de récord: marco propio (trazo y proporciones ligeramente distintos). */
function drawRecord(ctx, data, logo) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  var glow = ctx.createRadialGradient(W / 2, 220, 0, W / 2, 220, 760);
  glow.addColorStop(0, 'rgba(162, 150, 139, 0.20)');
  glow.addColorStop(1, 'rgba(162, 150, 139, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(162, 150, 139, 0.45)';
  ctx.lineWidth = 5;
  roundRect(ctx, 40, 40, W - 80, H - 80, 44);
  ctx.stroke();
  ctx.textAlign = 'center';
  if (logo) ctx.drawImage(logo, W / 2 - 52, 44, 104, 104);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '600 54px ' + DISPLAY;
  ctx.fillText('U D E C A', W / 2, 198);
  ctx.fillStyle = MUTED;
  ctx.font = '600 26px ' + BODY;
  ctx.fillText('U N I V E R S I D A D   D E   C A L I S T E N I A', W / 2, 240);
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 44, 272, 88, 4);

  // Insignia PR dibujada a mano (dos anillas + monograma).
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(W / 2, 420, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, 420, 92, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(162, 150, 139, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '900 64px ' + BODY;
  ctx.fillText('PR', W / 2, 443);
  ctx.fillStyle = TEXT;
  ctx.font = '900 64px ' + BODY;
  ctx.fillText('NUEVO RÉCORD PERSONAL', W / 2, 590);

  var prs = (data.prs || []).slice(0, 3);
  var compact = prs.length > 1;
  var y = prs.length === 1 ? 790 : 730;
  for (var i = 0; i < prs.length; i++) {
    ctx.fillStyle = GOLD_SOFT;
    ctx.font = '700 ' + (compact ? 40 : 46) + 'px ' + BODY;
    ctx.fillText(fit(ctx, prs[i].exerciseName.toUpperCase(), W - 200), W / 2, y);
    ctx.fillStyle = TEXT;
    ctx.font = '900 ' + (compact ? 76 : 104) + 'px ' + BODY;
    ctx.fillText(fit(ctx, prs[i].label, W - 200), W / 2, y + (compact ? 84 : 112));
    y += compact ? 190 : 240;
  }
  if (data.streak && data.streak > 1) {
    ctx.fillStyle = '#ECEDEF';
    ctx.font = '600 40px ' + BODY;
    ctx.fillText('Racha de ' + data.streak + ' días', W / 2, 1170);
  }
}

function drawReport(ctx, data) {
  ctx.fillStyle = TEXT;
  ctx.font = '600 56px ' + DISPLAY;
  ctx.fillText('INFORME DE PROGRESO', W / 2, 350);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '700 40px ' + BODY;
  ctx.fillText(fit(ctx, data.clientName.toUpperCase(), W - 200), W / 2, 414);
  if (data.periodLabel) {
    ctx.fillStyle = MUTED;
    ctx.font = '600 28px ' + BODY;
    ctx.fillText(data.periodLabel, W / 2, 458);
  }
  var bw = 440, bh = 190, gap = 36;
  var x0 = (W - (2 * bw + gap)) / 2;
  var y = 510;
  drawStat(ctx, x0, y, bw, bh, String(data.totalWorkouts), 'Entrenos');
  drawStat(ctx, x0 + bw + gap, y, bw, bh, String(data.daysTrained), 'Días entrenados');
  y += bh + gap;
  drawStat(ctx, x0, y, bw, bh, data.totalHours.toLocaleString('es-ES') + ' h', 'Horas');
  var wc = '—';
  if (data.weightChangeKg !== undefined && data.weightChangeKg !== null) {
    wc = (data.weightChangeKg >= 0 ? '+' : '') + data.weightChangeKg.toLocaleString('es-ES') + ' kg';
  }
  drawStat(ctx, x0 + bw + gap, y, bw, bh, wc, 'Peso corporal');
  y += bh + gap + 40;

  ctx.fillStyle = GOLD;
  ctx.font = '800 32px ' + BODY;
  ctx.fillText('MEJORES MARCAS', W / 2, y);
  y += 56;
  var lines = [];
  if (data.bestPushIso) lines.push('Isométrico empuje · ' + data.bestPushIso);
  if (data.bestPullIso) lines.push('Isométrico tirón · ' + data.bestPullIso);
  if (data.bestPushReps) lines.push('Empuje · ' + data.bestPushReps);
  if (data.bestPullReps) lines.push('Tirón · ' + data.bestPullReps);
  if (lines.length === 0) lines.push('Aún sin marcas registradas');
  ctx.fillStyle = '#ECEDEF';
  ctx.font = '600 34px ' + BODY;
  for (var i = 0; i < Math.min(lines.length, 4); i++) {
    ctx.fillText(fit(ctx, lines[i], W - 220), W / 2, y);
    y += 52;
  }
}

/**
 * Carné de miembro. El fundador tiene su propio tratamiento: sello con el
 * número dentro, y el marco doble en oro.
 */
function drawMember(ctx, data, logo) {
  var fundador = typeof data.founderNumber === 'number' && data.founderNumber > 0;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  var glow = ctx.createRadialGradient(W / 2, 700, 0, W / 2, 700, 900);
  glow.addColorStop(0, fundador ? 'rgba(201, 189, 176, 0.22)' : 'rgba(162, 150, 139, 0.14)');
  glow.addColorStop(1, 'rgba(162, 150, 139, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Marco: doble hilo para el fundador, sencillo para el resto.
  ctx.strokeStyle = fundador ? 'rgba(201, 189, 176, 0.75)' : 'rgba(162, 150, 139, 0.45)';
  ctx.lineWidth = 5;
  roundRect(ctx, 40, 40, W - 80, H - 80, 44);
  ctx.stroke();
  if (fundador) {
    ctx.strokeStyle = 'rgba(162, 150, 139, 0.35)';
    ctx.lineWidth = 2;
    roundRect(ctx, 62, 62, W - 124, H - 124, 32);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  if (logo) ctx.drawImage(logo, W / 2 - 52, 96, 104, 104);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '600 54px ' + DISPLAY;
  ctx.fillText('U D E C A', W / 2, 252);
  ctx.fillStyle = MUTED;
  ctx.font = '600 23px ' + BODY;
  ctx.fillText('U N I V E R S I D A D   D E   C A L I S T E N I A', W / 2, 292);

  if (fundador) {
    // Sello: dos anillas y el número dentro. Es el elemento que la gente
    // fotografía, así que manda sobre todo lo demás.
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(W / 2, 520, 128, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(162, 150, 139, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, 520, 146, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = GOLD_SOFT;
    ctx.font = '600 34px ' + BODY;
    ctx.fillText('Nº', W / 2, 468);
    ctx.fillStyle = TEXT;
    ctx.font = '900 116px ' + BODY;
    ctx.fillText(String(data.founderNumber), W / 2, 578);

    // El número CON su oficio. Ponía "MIEMBRO FUNDADOR" a secas, así que el
    // carné de un entrenador y el de un atleta eran idénticos salvo por la
    // línea pequeña de abajo. Y no es lo mismo ser el entrenador número 3 que
    // el atleta número 3: es lo primero que pregunta quien ve la captura.
    ctx.fillStyle = GOLD_SOFT;
    ctx.font = '900 56px ' + BODY;
    ctx.fillText(data.roleLabel.toUpperCase() + ' FUNDADOR', W / 2, 748);
    ctx.fillStyle = MUTED;
    ctx.font = '600 30px ' + BODY;
    ctx.fillText('Estuvo aquí desde el principio', W / 2, 800);
  } else {
    // El carné de quien no es fundador tenía un agujero: el sello del fundador
    // ocupa el centro y aquí no había nada entre el filete de arriba y el rol,
    // trescientos píxeles más abajo. La tarjeta se veía a medio hacer, y es la
    // que va a tener la inmensa mayoría.
    //
    // Se resuelve sin inventarse un dato que no existe: el oficio sube al
    // centro, que es donde la vista va, y se le pone la misma anilla. Las dos
    // tarjetas pasan a ser hermanas —una con tu número dentro, otra con lo que
    // eres— en vez de una completa y otra descolgada.
    ctx.strokeStyle = 'rgba(162, 150, 139, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, 520, 146, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = GOLD_SOFT;
    // "ATLETA" cabe a 52 px y "ENTRENADOR" no: la letra se ajusta al ancho de
    // la anilla en vez de cortar la palabra.
    fitFont(ctx, data.roleLabel.toUpperCase(), 236, 52, 26, '900', BODY);
    ctx.fillText(data.roleLabel.toUpperCase(), W / 2, 512);
    ctx.fillStyle = GOLD;
    ctx.fillRect(W / 2 - 34, 548, 68, 3);

    if (data.tagline) {
      ctx.fillStyle = MUTED;
      ctx.font = '600 34px ' + BODY;
      ctx.fillText(fit(ctx, data.tagline, W - 220), W / 2, 748);
    }
  }

  // Nombre: lo grande de la parte baja. Las dos variantes reparten el hueco de
  // forma distinta —el fundador gasta arriba con el sello— pero las dos acaban
  // a la misma distancia del pie, o la tarjeta se ve descolgada.
  var yNombre = fundador ? 960 : 930;
  ctx.fillStyle = TEXT;
  ctx.font = '600 66px ' + DISPLAY;
  ctx.fillText(fit(ctx, data.name, W - 220), W / 2, yNombre);
  // El rol solo se repite bajo el nombre en la tarjeta de fundador: en la otra
  // ya está escrito en grande justo encima.
  // El rol ya no se repite bajo el nombre del fundador: desde que el sello dice
  // "ENTRENADOR FUNDADOR", escribirlo otra vez cincuenta píxeles más abajo es
  // decir dos veces lo mismo en la misma tarjeta.
  var ySiguiente = yNombre + 56;
  if (data.since) {
    ctx.fillStyle = MUTED;
    ctx.font = '600 28px ' + BODY;
    ctx.fillText('Miembro desde ' + data.since, W / 2, ySiguiente);
  }
}

function udecaDrawCard(canvas, kind, data, logoUri) {
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('sin contexto 2d'));
  return loadLogo(logoUri).then(function (logo) {
    if (kind === 'record') {
      drawRecord(ctx, data, logo);
    } else if (kind === 'member') {
      drawMember(ctx, data, logo);
    } else {
      drawFrame(ctx, logo);
      if (kind === 'session') drawSession(ctx, data);
      else drawReport(ctx, data);
    }
    drawFooter(ctx);
    return canvas;
  });
}
`;

/** Documento HTML autónomo que pinta la tarjeta y devuelve el PNG en base64. */
export function buildCardHtml(kind: CardKind, data: CardData, logoUri: string): string {
  const payload = JSON.stringify({ kind, data, logoUri });
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body{margin:0;background:#000}canvas{display:none}</style></head>
<body><canvas id="c"></canvas><script>
${CARD_SCRIPT}
(function () {
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  };
  try {
    var p = ${payload};
    udecaDrawCard(document.getElementById('c'), p.kind, p.data, p.logoUri)
      .then(function (canvas) { post(canvas.toDataURL('image/png')); })
      .catch(function (e) { post('ERROR:' + e.message); });
  } catch (e) {
    post('ERROR:' + e.message);
  }
})();
</script></body></html>`;
}
