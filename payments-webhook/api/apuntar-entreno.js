import Anthropic from '@anthropic-ai/sdk';
import admin from 'firebase-admin';

/**
 * "Ayer hice cuatro series de dominadas: ocho, siete, seis y cinco."
 *
 * Este endpoint coge esa frase —dictada al móvil por alguien que entrenó sin
 * la app delante— y la convierte en las series y las marcas que la pantalla de
 * registro va a rellenar. Registrar eso a mano son treinta toques; contarlo son
 * diez segundos, y esa diferencia es la que decide si el entreno se apunta o se
 * pierde.
 *
 * Por qué vive en el servidor y no en la app: la clave de Anthropic es un
 * secreto y el repositorio es público. Una clave metida en la app se saca del
 * paquete en dos minutos y la paga UDECA. Aquí solo existe como variable de
 * entorno de Vercel.
 *
 * Quién puede llamar: solo alguien con sesión de Firebase, y hay que
 * demostrarlo con el token, no decirlo. Cada llamada cuesta dinero de verdad,
 * así que además se cuenta cuántas lleva cada persona hoy y se corta arriba.
 *
 * Este endpoint NO guarda nada del entreno: devuelve lo entendido y ya. Quien
 * decide si eso se registra es la persona, mirándolo en pantalla. Una IA que
 * escribe sola en el histórico de alguien es una IA que un día le mete
 * cuarenta dominadas que no hizo.
 *
 * Variables de entorno (Vercel): ANTHROPIC_API_KEY, FIREBASE_SERVICE_ACCOUNT,
 * y opcionalmente ANTHROPIC_MODEL para cambiar de modelo sin tocar el código.
 */

/** El dictado puede alargarse; un minuto de margen para pensarlo. */
export const maxDuration = 60;

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

/** Más de esto no es un entreno dictado, es un pegote. */
const MAX_TEXTO = 2000;
/** Y más de esto de ejercicios distintos tampoco cabe en una sesión. */
const MAX_CATALOGO = 300;
/** Dictados por persona y día. Suficiente de sobra; frena el abuso. */
const LIMITE_DIARIO = 40;

const ORIGENES = [
  'https://app.udeca.app',
  'https://www.udeca.app',
  'https://udeca.app',
  'http://localhost:4599',
  'http://localhost:8081',
];

let db = null;
function ensureInit() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
  if (!db) db = admin.firestore();
}

/**
 * La forma exacta de la respuesta.
 *
 * Se le impone al modelo en vez de pedírsela por escrito y cruzar los dedos:
 * así lo que vuelve es JSON válido con estos campos siempre, y la app no tiene
 * que adivinar si esta vez ha contestado con una frase por delante.
 *
 * El cero significa "no lo dijo" en todos ellos. Se usa el cero y no un nulo
 * para que el esquema no tenga que admitir dos tipos por campo, que es donde
 * empiezan los fallos tontos.
 */
const ESQUEMA = {
  type: 'object',
  properties: {
    ejercicios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string' },
          series: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                marca: { type: 'integer' },
                peso: { type: 'number' },
              },
              required: ['marca', 'peso'],
              additionalProperties: false,
            },
          },
        },
        required: ['exerciseId', 'series'],
        additionalProperties: false,
      },
    },
    duracionMin: { type: 'integer' },
    haceDias: { type: 'integer' },
    sinIdentificar: { type: 'array', items: { type: 'string' } },
  },
  required: ['ejercicios', 'duracionMin', 'haceDias', 'sinIdentificar'],
  additionalProperties: false,
};

const INSTRUCCIONES = [
  'Eres el ayudante que apunta entrenos de calistenia. Recibes lo que alguien ha',
  'dictado sobre un entreno que YA hizo y lo conviertes en series y marcas.',
  '',
  'Reglas, sin excepciones:',
  '- Solo puedes usar los exerciseId de la lista que se te da. Ni uno inventado.',
  '- "cuatro series de ocho" son 4 series con marca 8 cada una.',
  '- "ocho, siete, seis y cinco" son 4 series, una por número, en ese orden.',
  '- Si un ejercicio se midio en segundos (medida "seconds" o "secondsDual"),',
  '  la marca son SEGUNDOS: "aguante treinta segundos" es marca 30.',
  '- El peso va en kilos y solo en ejercicios con carga "weighted" o "assisted".',
  '  En los de carga "none" pon siempre peso 0.',
  '- Si dijo que hizo una serie pero no cuantas repeticiones, pon marca 0: la',
  '  serie cuenta igual. No te inventes el numero.',
  '- duracionMin: los minutos que dijo que duro; 0 si no lo dijo.',
  '- haceDias: 0 si fue hoy, 1 ayer, 2 anteayer... -1 si no dijo cuando.',
  '- sinIdentificar: los ejercicios que nombro y no estan en la lista, con las',
  '  palabras que uso. Es preferible decir que no lo has sabido colocar a',
  '  colocarlo en el ejercicio equivocado.',
  '',
  'No añadas nada que no se haya dicho. Lo que apuntes de mas queda en el',
  'historial de una persona como trabajo que nunca hizo.',
].join('\n');

/** El corte diario, contado en Firestore para que sobreviva al reinicio. */
async function dentroDelLimite(uid) {
  const dia = new Date().toISOString().slice(0, 10);
  const ref = db.collection('aiUsage').doc(`${uid}_${dia}`);
  const cuantas = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const n = (doc.exists ? doc.data().count || 0 : 0) + 1;
    tx.set(ref, { uid, dia, count: n, updatedAt: Date.now() }, { merge: true });
    return n;
  });
  return cuantas <= LIMITE_DIARIO;
}

export default async function handler(req, res) {
  const origen = req.headers.origin;
  // La app nativa no manda Origin; el navegador si, y ahi se restringe.
  if (origen && ORIGENES.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en Vercel' });
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Falta FIREBASE_SERVICE_ACCOUNT en Vercel' });
  }

  try {
    ensureInit();
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Sin sesión' });
    const identidad = await admin.auth().verifyIdToken(token);

    const cuerpo = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const texto = String(cuerpo.texto || '').trim().slice(0, MAX_TEXTO);
    const catalogo = Array.isArray(cuerpo.catalogo) ? cuerpo.catalogo.slice(0, MAX_CATALOGO) : [];
    if (!texto) return res.status(400).json({ error: 'No hay nada que apuntar' });
    if (catalogo.length === 0) return res.status(400).json({ error: 'Sin ejercicios que reconocer' });

    if (!(await dentroDelLimite(identidad.uid))) {
      return res.status(429).json({ error: 'Has llegado al límite de dictados por hoy' });
    }

    const hoy = new Date();
    const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const respuesta = await cliente.messages.create({
      model: MODELO,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: INSTRUCCIONES,
      output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
      messages: [
        {
          role: 'user',
          content: [
            `Hoy es ${hoy.toISOString().slice(0, 10)}.`,
            '',
            'Ejercicios disponibles (JSON):',
            JSON.stringify(
              catalogo.map((e) => ({
                exerciseId: String(e.id ?? ''),
                nombre: String(e.nombre ?? ''),
                medida: String(e.medida ?? 'reps'),
                carga: String(e.carga ?? 'none'),
              }))
            ),
            '',
            'Lo que ha dictado:',
            texto,
          ].join('\n'),
        },
      ],
    });

    // Una negativa del modelo no trae contenido que leer: se corta antes.
    if (respuesta.stop_reason === 'refusal') {
      return res.status(200).json({ error: 'No he podido apuntar eso' });
    }
    const bloque = respuesta.content.find((b) => b.type === 'text');
    if (!bloque) return res.status(200).json({ error: 'No he entendido el dictado' });
    return res.status(200).json(JSON.parse(bloque.text));
  } catch (e) {
    console.error('apuntar-entreno', e);
    const codigo = e?.errorInfo?.code || '';
    if (codigo.includes('auth/')) return res.status(401).json({ error: 'Sesión no válida' });
    return res.status(500).json({ error: 'No se pudo apuntar el dictado' });
  }
}
