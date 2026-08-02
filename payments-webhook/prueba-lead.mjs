/*
 * Prueba local del endpoint de la comunidad contra el emulador de Firestore.
 * Se ejecuta a mano; Vercel no la despliega (solo publica lo que hay en api/).
 *
 * Con el emulador levantado (`firebase emulators:start` en la raíz del
 * proyecto) y una cuenta de servicio cualquiera —al emulador le vale una
 * inventada, no uses la de producción—:
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_SERVICE_ACCOUNT="$(cat cuenta-de-prueba.json)" \
 *   node prueba-lead.mjs
 *
 * Sin `TELEGRAM_INVITE_URL` y sin el documento `config/comunidad`, la puerta
 * responde 503: es exactamente lo que ve alguien cuando la comunidad no está
 * abierta. Poniendo cualquiera de los dos, responde 200 con el enlace.
 */
import handler from './api/lead.js';

function respuesta() {
  const r = {
    codigo: 0,
    cuerpo: null,
    cabeceras: {},
    setHeader(k, v) {
      this.cabeceras[k] = v;
    },
    status(c) {
      this.codigo = c;
      return this;
    },
    json(b) {
      this.cuerpo = b;
      return this;
    },
    end() {
      return this;
    },
  };
  return r;
}

async function llamar(metodo, cuerpo) {
  const req = {
    method: metodo,
    headers: { origin: 'https://acceso.udeca.app' },
    body: cuerpo,
  };
  const res = respuesta();
  await handler(req, res);
  return res;
}

const salud = await llamar('GET');
console.log('GET   ', salud.codigo, JSON.stringify(salud.cuerpo));

const alta = await llamar('POST', { name: 'Prueba Local', email: 'prueba@ejemplo.com' });
console.log('POST  ', alta.codigo, JSON.stringify(alta.cuerpo));

const malo = await llamar('POST', { name: 'X', email: 'no-es-correo' });
console.log('POST ✗', malo.codigo, JSON.stringify(malo.cuerpo));

process.exit(0);
