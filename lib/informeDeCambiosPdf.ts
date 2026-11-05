import { diaLargo, fechaLegible } from './fechas';
import { frase, t } from './idioma';
import { CALICO_LOGO_OSCURO_DATA_URI } from './calicoLogo';
import { marcaActual } from './marcaActual';
import {
  INICIO_DEL_REGISTRO,
  type EventoDelInforme,
  type FuenteDelEvento,
  type InformeDeCambios,
  type TipoDeLinea,
} from './informeDeCambios';

/**
 * El informe de cambios en PDF (ver lib/informeDeCambios.ts para qué entra).
 *
 * Mismo papel que el informe de progreso (lib/report.ts): fondo blanco, porque
 * un PDF acaba impreso o en un visor que no pinta fondos, y la marca del
 * entrenador arriba. Pensado también para enseñarse en pantalla —en un vídeo—:
 * cada día de cambio es un bloque que se lee solo, con la fecha bien grande y
 * cada línea marcada por lo que es (nuevo, quitado, series…).
 */

const AZUL = '#1E56D6';
const INK = '#14161B';
const MUTED = '#6C727C';
const HAIRLINE = '#E4E6EA';
const VERDE = '#1F7A46';
const ROJO = '#B3261E';
const MORADO = '#6B3FB8';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function firma(): string {
  const { marca } = marcaActual();
  return marca ? `${marca} · con CALICO` : 'CALICO · Calisthenics Coaches';
}

const FUENTE: Record<FuenteDelEvento, { texto: string; color: string }> = {
  'plan-nuevo': { texto: 'Plan nuevo', color: AZUL },
  cambio: { texto: 'Cambio del plan', color: INK },
  ciclo: { texto: 'Planificación', color: MORADO },
  entrenos: { texto: 'Visto en los entrenos', color: MUTED },
};

const LINEA: Record<TipoDeLinea, { texto: string; clase: string }> = {
  nuevo: { texto: 'Nuevo', clase: 'nuevo' },
  quitado: { texto: 'Quitado', clase: 'quitado' },
  sustituido: { texto: 'Cambiado por', clase: 'cambio' },
  series: { texto: 'Series', clase: 'cambio' },
  detalle: { texto: 'Detalle', clase: 'detalle' },
  dia: { texto: 'Día', clase: 'detalle' },
  contenido: { texto: '', clase: 'contenido' },
};

function evento(e: EventoDelInforme): string {
  const f = FUENTE[e.fuente];
  return `<div class="evento">
    <div class="evento-cab">
      <span class="fuente" style="color:${f.color};border-color:${f.color}">${escapeHtml(t(f.texto))}</span>
      <span class="evento-titulo">${escapeHtml(e.titulo)}</span>
    </div>
    ${e.notas.map((n) => `<p class="nota-ev">${escapeHtml(n)}</p>`).join('')}
    ${e.dias
      .map(
        (d) => `<div class="dia">
          <div class="dia-nombre">${escapeHtml(d.nombre)}</div>
          ${d.lineas
            .map((l) => {
              const tipo = LINEA[l.tipo];
              return `<div class="linea ${tipo.clase}">${
                tipo.texto ? `<span class="tag">${escapeHtml(t(tipo.texto))}</span>` : '<span class="punto">·</span>'
              }<span class="txt">${escapeHtml(l.texto)}</span></div>`;
            })
            .join('')}
        </div>`
      )
      .join('')}
  </div>`;
}

export function informeDeCambiosHtml(
  inf: InformeDeCambios,
  quien: { alumno: string; nivel?: string; objetivo?: string; entrenador?: string }
): string {
  const diasConCambios = inf.dias.length;
  const planes = inf.planes
    .map(
      (p) => `<div class="plan">
        <div class="plan-cab">
          <b>${escapeHtml(p.nombre)}</b>
          <span>${escapeHtml(p.tipo)} · ${
            p.hasta === null
              ? escapeHtml(frase`desde el ${fechaLegible(p.desde)} · el de ahora`)
              : escapeHtml(frase`del ${fechaLegible(p.desde)} al ${fechaLegible(p.hasta)}`)
          } · ${escapeHtml(p.sesiones === 1 ? t('1 entreno en el periodo') : frase`${p.sesiones} entrenos en el periodo`)}</span>
        </div>
        <table>
          <thead><tr><th class="d">${escapeHtml(t('Día'))}</th><th>${escapeHtml(t('Ejercicios'))}</th><th class="num">${escapeHtml(t('Entrenos'))}</th></tr></thead>
          <tbody>${p.dias
            .map(
              (d) => `<tr>
                <td class="d">${escapeHtml(d.nombre)}</td>
                <td>${
                  d.descanso
                    ? `<i>${escapeHtml(t('Descanso'))}</i>`
                    : d.ejercicios.length === 0
                      ? '—'
                      : d.ejercicios.map((e) => `${escapeHtml(e.nombre)} <span class="cuanto">${escapeHtml(e.cuanto)}</span>`).join(' · ')
                }</td>
                <td class="num">${d.descanso ? '' : d.sesiones}</td>
              </tr>`
            )
            .join('')}${p.otros
            .map(
              (o) => `<tr class="otro"><td class="d">${escapeHtml(o.nombre)}</td><td><i>${escapeHtml(
                t('Ya no está en el plan')
              )}</i></td><td class="num">${o.sesiones}</td></tr>`
            )
            .join('')}</tbody>
        </table>
      </div>`
    )
    .join('');

  const cronologia = inf.dias
    .map(
      (d) => `<div class="fecha">
        <div class="fecha-cab">${escapeHtml(diaLargo(d.dia, true))}</div>
        ${d.eventos.map(evento).join('')}
      </div>`
    )
    .join('');

  const notaFuentes =
    inf.desde < INICIO_DEL_REGISTRO
      ? `<p class="note">${escapeHtml(
          frase`Desde el ${fechaLegible(INICIO_DEL_REGISTRO)}, cada cambio sale del registro del plan, tal como lo guardó el entrenador. Lo anterior se deduce de los entrenos («Visto en los entrenos»): ejercicios que entran o salen y número de series, cuando se repiten en la sesión siguiente. Las repeticiones pautadas de antes no quedaban guardadas.`
        )}</p>`
      : '';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(frase`Cambios del entrenamiento · ${quien.alumno}`)}</title>
    <style>
      @page { size: A4; margin: 13mm 12mm 12mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        margin: 0; background: #FFFFFF; color: ${INK};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 11px; line-height: 1.45; -webkit-font-smoothing: antialiased;
      }
      .sheet { max-width: 186mm; margin: 0 auto; }
      .head { display: flex; align-items: flex-start; gap: 14px; border-bottom: 2px solid ${AZUL}; padding-bottom: 14px; }
      .head img { width: 46px; height: 46px; }
      .head .who { flex: 1; }
      .brand { font-size: 9px; letter-spacing: 3.4px; text-transform: uppercase; color: ${AZUL}; font-weight: 700; }
      h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 25px; letter-spacing: .4px; margin: 3px 0 2px; }
      .sub { color: ${MUTED}; font-size: 10.5px; }
      .stamp { text-align: right; color: ${MUTED}; font-size: 9.5px; line-height: 1.6; white-space: nowrap; }
      .stamp b { display: block; color: ${INK}; font-size: 10.5px; }
      section { margin-top: 20px; }
      h2 {
        font-family: Georgia, 'Times New Roman', serif; font-size: 12px; letter-spacing: 2.2px;
        text-transform: uppercase; color: ${AZUL}; margin: 0 0 9px;
        border-bottom: 1px solid ${HAIRLINE}; padding-bottom: 6px; font-weight: 700; break-after: avoid;
      }
      .note { color: ${MUTED}; font-size: 9.5px; margin: 9px 0 0; }
      .tiles { display: flex; gap: 7px; break-inside: avoid; }
      .tile { flex: 1; border: 1px solid ${HAIRLINE}; border-radius: 8px; padding: 9px 6px; text-align: center; }
      .tile b { display: block; font-size: 19px; font-weight: 700; letter-spacing: -.4px; }
      .tile span { display: block; font-size: 8px; letter-spacing: .9px; text-transform: uppercase; color: ${MUTED}; margin-top: 2px; }

      .plan { border: 1px solid ${HAIRLINE}; border-radius: 8px; padding: 10px 12px; margin-bottom: 9px; break-inside: avoid; }
      .plan-cab b { font-size: 13px; display: block; }
      .plan-cab span { color: ${MUTED}; font-size: 9.5px; }
      table { width: 100%; border-collapse: collapse; margin-top: 7px; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
      th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid ${HAIRLINE}; vertical-align: top; }
      th { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: ${MUTED}; font-weight: 600; background: #FAFAFB; }
      td.d, th.d { width: 26%; font-weight: 600; }
      td.num, th.num { text-align: right; width: 56px; font-variant-numeric: tabular-nums; }
      .cuanto { color: ${AZUL}; font-weight: 600; white-space: nowrap; }
      tr.otro td { color: ${MUTED}; }

      .fecha { margin-bottom: 12px; padding-left: 12px; border-left: 3px solid ${AZUL}; break-inside: avoid; }
      .fecha-cab { font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: 700; margin-bottom: 5px; break-after: avoid; }
      .evento { margin: 0 0 8px; break-inside: avoid; }
      .evento-cab { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
      .fuente { font-size: 7.5px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; border: 1px solid; border-radius: 4px; padding: 1px 5px; }
      .evento-titulo { font-weight: 700; font-size: 11.5px; }
      .nota-ev { margin: 3px 0 0; color: ${MUTED}; font-size: 10px; }
      .dia { margin: 5px 0 0 2px; }
      .dia-nombre { font-weight: 600; font-size: 10.5px; margin-bottom: 2px; }
      .linea { display: flex; align-items: baseline; gap: 7px; padding: 1.5px 0; }
      .linea .tag { flex: 0 0 66px; font-size: 7.5px; letter-spacing: .7px; text-transform: uppercase; font-weight: 700; }
      .linea .punto { flex: 0 0 66px; color: ${MUTED}; text-align: center; }
      .linea.nuevo .tag { color: ${VERDE}; }
      .linea.quitado .tag { color: ${ROJO}; }
      .linea.quitado .txt { text-decoration: line-through; color: ${MUTED}; }
      .linea.cambio .tag { color: ${AZUL}; }
      .linea.detalle .tag { color: ${MUTED}; }
      .linea.contenido .txt { color: ${INK}; }
      .vacio { color: ${MUTED}; font-size: 10.5px; }
      .foot { margin-top: 24px; padding-top: 9px; border-top: 1px solid ${HAIRLINE};
              display: flex; justify-content: space-between; color: ${MUTED}; font-size: 8.5px;
              letter-spacing: 1px; text-transform: uppercase; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="head">
        <img src="${marcaActual().logo ?? CALICO_LOGO_OSCURO_DATA_URI}" alt="" />
        <div class="who">
          <div class="brand">${escapeHtml(firma())}</div>
          <h1>${escapeHtml(quien.alumno)}</h1>
          <div class="sub">${escapeHtml(t('Cambios del entrenamiento, día a día'))}${
            quien.nivel ? ` · ${escapeHtml(quien.nivel)}` : ''
          }${quien.objetivo ? ` · ${escapeHtml(frase`Objetivo: ${quien.objetivo}`)}` : ''}</div>
        </div>
        <div class="stamp">
          <b>${fechaLegible(inf.desde)} — ${fechaLegible(inf.hasta)}</b>
          ${escapeHtml(frase`Emitido el ${fechaLegible(Date.now())}`)}${
            quien.entrenador ? `<br />${escapeHtml(frase`por ${quien.entrenador}`)}` : ''
          }
        </div>
      </div>

      <section>
        <h2>${escapeHtml(t('El periodo en cifras'))}</h2>
        <div class="tiles">
          <div class="tile"><b>${inf.sesiones}</b><span>${escapeHtml(t('Entrenos'))}</span></div>
          <div class="tile"><b>${inf.planes.length || '—'}</b><span>${escapeHtml(t('Planes'))}</span></div>
          <div class="tile"><b>${diasConCambios}</b><span>${escapeHtml(t('Días con cambios'))}</span></div>
          <div class="tile"><b>${inf.cambios}</b><span>${escapeHtml(t('Cambios'))}</span></div>
        </div>
      </section>

      ${
        inf.planes.length > 0
          ? `<section>
              <h2>${escapeHtml(t('Planes y tipos de entreno'))}</h2>
              ${planes}
              <p class="note">${escapeHtml(t('Cada plan, como está guardado ahora, y cuántas veces entrenó cada día en el periodo.'))}</p>
             </section>`
          : ''
      }

      <section>
        <h2>${escapeHtml(t('Cambios, día a día'))}</h2>
        ${cronologia || `<p class="vacio">${escapeHtml(t('No hay cambios en este periodo con lo que has elegido.'))}</p>`}
        ${notaFuentes}
      </section>

      <div class="foot">
        <span>${escapeHtml(firma())}</span>
        <span>${escapeHtml(quien.alumno)} · ${fechaLegible(inf.desde)} — ${fechaLegible(inf.hasta)}</span>
      </div>
    </div>
  </body>
</html>`;
}
