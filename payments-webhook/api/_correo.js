/**
 * Envío de correo (Resend), en un solo sitio.
 *
 * Existe porque los avisos solo llegaban por notificación push, y el push solo
 * existe si la persona tiene la app de móvil instalada y ha dado permiso. Quien
 * usa UDECA desde el navegador —que son muchos— no recibía nada: se encontraba
 * el muro de pago al acabarse la prueba sin haber sido avisado, después de que la propia
 * app le prometiera por escrito que se le avisaría. Eso no es un aviso perdido,
 * es alguien que iba a pagar y se va.
 *
 * El guion bajo del nombre no es decorativo: Vercel no publica como función los
 * ficheros de /api que empiezan por "_", así que esto es un módulo compartido y
 * no un endpoint abierto a internet.
 *
 * SIN CLAVE NO PASA NADA. Si `RESEND_API_KEY` no está puesta, esto no envía y
 * lo dice; el resto de la tarea diaria sigue igual. Así el código puede estar
 * publicado antes de que exista la cuenta, y el día que se pegue la clave en
 * Vercel empieza a funcionar solo.
 */

const RESEND_URL = 'https://api.resend.com/emails';

/** Remitente. Tiene que ser un dominio verificado en Resend. */
function remitente() {
  return process.env.MAIL_FROM || 'UDECA <avisos@udeca.app>';
}

export function correoConfigurado() {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Envuelve el texto en una página sobria con la marca.
 *
 * Sin imágenes ni tipografías externas: un correo que depende de que el cliente
 * cargue recursos remotos se ve roto en la mitad de las bandejas, y encima
 * acaba en spam más a menudo.
 */
function plantilla(titulo, parrafos, boton) {
  const cuerpo = parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3a3a">${p}</p>`
    )
    .join('');
  const cta = boton
    ? `<p style="margin:22px 0 0">
         <a href="${boton.url}" style="display:inline-block;background:#A2968B;color:#0A0A0A;
            text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">
           ${boton.texto}
         </a>
       </p>`
    : '';
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f2f0;padding:24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;
             border-radius:14px;padding:28px 26px;font-family:-apple-system,BlinkMacSystemFont,
             'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <tr><td>
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:1.6px;color:#A2968B;
             text-transform:uppercase;font-weight:600">UDECA</p>
          <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:#111111">${titulo}</h1>
          ${cuerpo}${cta}
          <p style="margin:26px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a">
            Recibes este aviso porque tienes una cuenta en UDECA.
          </p>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

/**
 * Envía un correo. Nunca lanza: un fallo de correo no puede tumbar la tarea
 * diaria, que además actualiza estadísticas y manda notificaciones.
 */
export async function enviarCorreo({ to, subject, titulo, parrafos, boton }) {
  if (!correoConfigurado()) return { ok: false, motivo: 'sin-clave' };
  if (!to) return { ok: false, motivo: 'sin-destinatario' };

  try {
    const r = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remitente(),
        to: [to],
        subject,
        html: plantilla(titulo, parrafos, boton),
        // Alternativa en texto plano: hay quien lee el correo así, y tenerla
        // baja bastante la probabilidad de acabar en spam.
        text: `${titulo}\n\n${parrafos.join('\n\n').replace(/<[^>]+>/g, '')}${
          boton ? `\n\n${boton.texto}: ${boton.url}` : ''
        }`,
      }),
    });
    if (!r.ok) return { ok: false, motivo: `http-${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: 'error-red' };
  }
}

/** Varios correos a la vez. Devuelve cuántos salieron bien. */
export async function enviarCorreos(lista) {
  if (lista.length === 0 || !correoConfigurado()) return 0;
  const r = await Promise.all(lista.map((c) => enviarCorreo(c)));
  return r.filter((x) => x.ok).length;
}
