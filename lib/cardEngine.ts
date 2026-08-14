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

/**
 * Los rótulos de la tarjeta, ya traducidos.
 *
 * El dibujo corre dentro de un WebView (o de un `new Function` en web), donde
 * no llega nada de la app: ni el idioma, ni `t()`. Así que los textos se
 * traducen AQUÍ, del lado de la app, y viajan con los datos. Es también la
 * razón de que sean claves cortas y no frases: lo que cruza es el resultado,
 * no la decisión.
 */
export interface CardTextos {
  sesionCompletada: string;
  duracion: string;
  series: string;
  repeticiones: string;
  isometricos: string;
  volumen: string;
  nuevoRecord: string;
  records: string;
  racha: string;
  informe: string;
  entrenos: string;
  diasEntrenados: string;
  horas: string;
  pesoCorporal: string;
  mejoresMarcas: string;
  isoEmpuje: string;
  isoTiron: string;
  empuje: string;
  tiron: string;
  sinMarcas: string;
  fundador: string;
  numeroNoSeReasigna: string;
  locale: string;
}

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
  nombre: string;
  /** "ENTRENADOR", "ATLETA", "ALUMNO", "FORMACIÓN". */
  titulo: string;
  lema: string;
  /** Dos letras para el sello. */
  monograma: string;
  /** Color del sello y de la línea, en hexadecimal. */
  acento: string;
  /** "Miembro desde mayo de 2026". */
  desde?: string;
  /** "#0028". Sin él, la tarjeta es la de un miembro normal. */
  fundador?: string;
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
var DISPLAY = 'Georgia, "Times New Roman", serif';
// Los rótulos, ya traducidos por la app: aquí dentro no hay idioma que mirar.
var T = {};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
  ctx.font = '600 23px sans-serif';
  ctx.fillText('U N I V E R S I D A D   D E   C A L I S T E N I A', W / 2, 238);
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 40, 262, 80, 3);
}

function drawFooter(ctx) {
  ctx.fillStyle = FAINT;
  ctx.font = '600 30px sans-serif';
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
  ctx.font = '800 64px sans-serif';
  ctx.fillText(fit(ctx, value, w - 50), x + w / 2, y + h / 2 + 4);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '600 25px sans-serif';
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h - 32);
}

function formatSessionDate(ts) {
  var wd = new Date(ts).toLocaleDateString(T.locale, { weekday: 'long' });
  var dmy = new Date(ts).toLocaleDateString(T.locale, {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  return wd.charAt(0).toUpperCase() + wd.slice(1) + ' ' + dmy;
}

function drawSession(ctx, data) {
  ctx.fillStyle = TEXT;
  ctx.font = '600 62px ' + DISPLAY;
  ctx.fillText(T.sesionCompletada, W / 2, 362);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '700 38px sans-serif';
  var sub = data.routineName + (data.dayName ? ' · ' + data.dayName : '');
  ctx.fillText(fit(ctx, sub, W - 200), W / 2, 424);

  // Rejilla 2×2. Series, repeticiones e ISOMÉTRICOS se muestran siempre
  // (aunque valgan 0): la tarjeta debe tener siempre el mismo bloque.
  var stats = [];
  if (data.durationMin > 0) stats.push([data.durationMin + ' min', T.duracion]);
  stats.push([String(data.sets), T.series]);
  stats.push([String(data.reps), T.repeticiones]);
  stats.push([data.seconds + ' s', T.isometricos]);
  if (data.volumeKg > 0) stats.push([data.volumeKg.toLocaleString(T.locale) + ' kg', T.volumen]);
  var shown = stats.slice(0, 4);

  var bw = 440, bh = 210, gap = 40;
  var cols = shown.length === 1 ? 1 : 2;
  var rows = Math.ceil(shown.length / cols);
  var x0 = (W - (cols * bw + (cols - 1) * gap)) / 2;
  var gridH = rows * bh + (rows - 1) * gap;

  var extras = [];
  if (data.prCount > 0) {
    extras.push({
      text: data.prCount === 1 ? T.nuevoRecord : data.prCount + ' ' + T.records,
      color: GOLD_SOFT, font: '800 40px sans-serif', gapBefore: 70
    });
  }
  if (data.streak > 1) {
    extras.push({
      text: T.racha.replace('{0}', data.streak),
      color: '#ECEDEF', font: '600 36px sans-serif',
      gapBefore: extras.length > 0 ? 56 : 70
    });
  }
  if (data.date) {
    extras.push({
      text: formatSessionDate(data.date),
      color: MUTED, font: '600 32px sans-serif',
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
  ctx.font = '600 26px sans-serif';
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
  ctx.font = '900 64px sans-serif';
  ctx.fillText('PR', W / 2, 443);
  ctx.fillStyle = TEXT;
  ctx.font = '900 64px sans-serif';
  ctx.fillText(T.nuevoRecord, W / 2, 590);

  var prs = (data.prs || []).slice(0, 3);
  var compact = prs.length > 1;
  var y = prs.length === 1 ? 790 : 730;
  for (var i = 0; i < prs.length; i++) {
    ctx.fillStyle = GOLD_SOFT;
    ctx.font = '700 ' + (compact ? 40 : 46) + 'px sans-serif';
    ctx.fillText(fit(ctx, prs[i].exerciseName.toUpperCase(), W - 200), W / 2, y);
    ctx.fillStyle = TEXT;
    ctx.font = '900 ' + (compact ? 76 : 104) + 'px sans-serif';
    ctx.fillText(fit(ctx, prs[i].label, W - 200), W / 2, y + (compact ? 84 : 112));
    y += compact ? 190 : 240;
  }
  if (data.streak && data.streak > 1) {
    ctx.fillStyle = '#ECEDEF';
    ctx.font = '600 40px sans-serif';
    ctx.fillText(T.racha.replace('{0}', data.streak), W / 2, 1170);
  }
}

function drawReport(ctx, data) {
  ctx.fillStyle = TEXT;
  ctx.font = '600 56px ' + DISPLAY;
  ctx.fillText(T.informe, W / 2, 350);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '700 40px sans-serif';
  ctx.fillText(fit(ctx, data.clientName.toUpperCase(), W - 200), W / 2, 414);
  if (data.periodLabel) {
    ctx.fillStyle = MUTED;
    ctx.font = '600 28px sans-serif';
    ctx.fillText(data.periodLabel, W / 2, 458);
  }
  var bw = 440, bh = 190, gap = 36;
  var x0 = (W - (2 * bw + gap)) / 2;
  var y = 510;
  drawStat(ctx, x0, y, bw, bh, String(data.totalWorkouts), T.entrenos);
  drawStat(ctx, x0 + bw + gap, y, bw, bh, String(data.daysTrained), T.diasEntrenados);
  y += bh + gap;
  drawStat(ctx, x0, y, bw, bh, data.totalHours.toLocaleString(T.locale) + ' h', T.horas);
  var wc = '—';
  if (data.weightChangeKg !== undefined && data.weightChangeKg !== null) {
    wc = (data.weightChangeKg >= 0 ? '+' : '') + data.weightChangeKg.toLocaleString(T.locale) + ' kg';
  }
  drawStat(ctx, x0 + bw + gap, y, bw, bh, wc, T.pesoCorporal);
  y += bh + gap + 40;

  ctx.fillStyle = GOLD;
  ctx.font = '800 32px sans-serif';
  ctx.fillText(T.mejoresMarcas, W / 2, y);
  y += 56;
  var lines = [];
  if (data.bestPushIso) lines.push(T.isoEmpuje + ' · ' + data.bestPushIso);
  if (data.bestPullIso) lines.push(T.isoTiron + ' · ' + data.bestPullIso);
  if (data.bestPushReps) lines.push(T.empuje + ' · ' + data.bestPushReps);
  if (data.bestPullReps) lines.push(T.tiron + ' · ' + data.bestPullReps);
  if (lines.length === 0) lines.push(T.sinMarcas);
  ctx.fillStyle = '#ECEDEF';
  ctx.font = '600 34px sans-serif';
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
  var acento = data.acento || GOLD;
  var esFundador = !!data.fundador;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  // El halo toma el color del tipo de cuenta: es lo primero que se ve y lo que
  // hace que dos carnés distintos se distingan de lejos, antes de leer nada.
  var glow = ctx.createRadialGradient(W / 2, 640, 0, W / 2, 640, 900);
  glow.addColorStop(0, hexA(acento, esFundador ? 0.24 : 0.15));
  glow.addColorStop(1, hexA(acento, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = hexA(acento, 0.5);
  ctx.lineWidth = 4;
  roundRect(ctx, 40, 40, W - 80, H - 80, 44);
  ctx.stroke();
  // El fundador lleva marco doble. No hace falta explicarlo: una tarjeta con
  // dos marcos al lado de una con uno ya dice cuál es cuál.
  if (esFundador) {
    ctx.strokeStyle = hexA(acento, 0.3);
    ctx.lineWidth = 2;
    roundRect(ctx, 60, 60, W - 120, H - 120, 34);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  if (logo) ctx.drawImage(logo, W / 2 - 46, 96, 92, 92);
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = '600 46px ' + DISPLAY;
  ctx.fillText('U D E C A', W / 2, 244);
  ctx.fillStyle = MUTED;
  ctx.font = '600 21px sans-serif';
  ctx.fillText('U N I V E R S I D A D   D E   C A L I S T E N I A', W / 2, 282);

  // El sello: dos anillas y el monograma del tipo de cuenta. Al fundador se le
  // cambia el monograma por su número, que es lo que de verdad viene a enseñar.
  var cy = 470;
  ctx.strokeStyle = acento;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W / 2, cy, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = hexA(acento, 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W / 2, cy, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = acento;
  if (esFundador) {
    ctx.font = '900 66px sans-serif';
    ctx.fillText(data.fundador, W / 2, cy + 24);
    // La palabra va FUERA del sello. Dentro quedaba pegada al arco de abajo, y
    // un sello con el texto rozando el borde parece mal impreso, no antiguo.
    ctx.fillStyle = MUTED;
    ctx.font = '700 26px sans-serif';
    ctx.fillText(espaciado(T.fundador), W / 2, cy + 172);
  } else {
    ctx.font = '900 76px sans-serif';
    ctx.fillText(data.monograma || 'UD', W / 2, cy + 26);
  }

  // El nombre encoge hasta caber. Un nombre largo recortado con puntos
  // suspensivos en el carné de alguien es lo peor que puede hacer esta
  // tarjeta: es literalmente el dato que la persona viene a enseñar.
  ctx.fillStyle = TEXT;
  ajusta(ctx, data.nombre, W - 180, 76, 40, '700 ', ' ' + DISPLAY);
  ctx.fillText(fit(ctx, data.nombre, W - 180), W / 2, 730);

  // El tipo de cuenta, dentro de su cápsula y en su color: es lo que hace que
  // dos carnés se distingan a un metro, antes de leer una sola palabra.
  var etiqueta = espaciado(data.titulo);
  ctx.font = '800 40px sans-serif';
  var anchoTexto = ctx.measureText(etiqueta).width;
  var pw = Math.min(W - 160, anchoTexto + 90);
  var ph = 84;
  var px = W / 2 - pw / 2;
  var py = 800;
  ctx.fillStyle = hexA(acento, 0.12);
  roundRect(ctx, px, py, pw, ph, ph / 2);
  ctx.fill();
  ctx.strokeStyle = hexA(acento, 0.55);
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, ph / 2);
  ctx.stroke();
  ctx.fillStyle = acento;
  ctx.fillText(etiqueta, W / 2, py + 54);

  ctx.fillStyle = MUTED;
  ctx.font = '600 32px sans-serif';
  ctx.fillText(fit(ctx, data.lema, W - 200), W / 2, 942);

  if (data.desde) {
    ctx.fillStyle = FAINT;
    ctx.font = '600 30px sans-serif';
    ctx.fillText(data.desde, W / 2, 1040);
  }

  // El fundador, además del sello, lleva su promesa escrita. Es lo que hace que
  // el número signifique algo para quien ve la tarjeta y no lo entiende.
  if (esFundador) {
    ctx.fillStyle = GOLD_SOFT;
    ctx.font = '600 28px sans-serif';
    ctx.fillText(T.numeroNoSeReasigna, W / 2, 1104);
  }
}

/*
 * Fija la fuente más grande, bajando de "desde" a "hasta", con la que el texto
 * cabe en el ancho dado. Deja la fuente puesta en el contexto.
 *
 * (Sin acentos graves en este comentario: todo este bloque vive dentro de una
 * plantilla de cadena, y uno solo la cerraría por la mitad.)
 */
function ajusta(ctx, texto, maxWidth, desde, hasta, pre, post) {
  var t = desde;
  while (t > hasta) {
    ctx.font = pre + t + 'px' + post;
    if (ctx.measureText(texto).width <= maxWidth) return t;
    t -= 2;
  }
  ctx.font = pre + hasta + 'px' + post;
  return hasta;
}

/** Un color hex con la opacidad que se le pida. */
function hexA(hex, a) {
  var h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  if (isNaN(n)) return 'rgba(162, 150, 139, ' + a + ')';
  return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + a + ')';
}

/** "ATLETA" -> "A T L E T A". Separado se lee como un sello, no como texto. */
function espaciado(t) {
  return String(t || '').split('').join(' ');
}

function udecaDrawCard(canvas, kind, data, logoUri, textos) {
  T = textos || {};
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
export function buildCardHtml(
  kind: CardKind,
  data: CardData,
  logoUri: string,
  textos: CardTextos
): string {
  const payload = JSON.stringify({ kind, data, logoUri, textos });
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
    udecaDrawCard(document.getElementById('c'), p.kind, p.data, p.logoUri, p.textos)
      .then(function (canvas) { post(canvas.toDataURL('image/png')); })
      .catch(function (e) { post('ERROR:' + e.message); });
  } catch (e) {
    post('ERROR:' + e.message);
  }
})();
</script></body></html>`;
}
