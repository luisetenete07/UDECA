/*
 * Sube la versión mínima (config/version → minima): el muro de "actualiza para
 * seguir" para todo el que tenga una anterior. Ver docs/ACTUALIZAR.md.
 *
 * Desde la 1.2.0 la app avisa sola cuando la tienda tiene algo nuevo. Esto es
 * para lo que no avisa solo: las versiones anteriores a ese aviso, que solo
 * entienden la mínima, y cualquier día que haga falta cortar ya, sin margen.
 *
 * Se lanza desde Actions → "Versión mínima" → Run workflow.
 *
 * NO DEJA A NADIE FUERA POR ERROR
 *
 * Antes de escribir nada se pregunta a la App Store qué versión tiene
 * publicada. Si es anterior a la mínima pedida, se para: con el muro por
 * encima de lo publicado, la tienda no tiene nada que dar y nadie podría
 * entrar. Google Play no tiene una consulta pública como la de Apple, así que
 * eso lo confirma quien lo lanza.
 *
 * Sin ESCRIBIR=true solo comprueba y dice qué haría.
 *
 *   MINIMA=1.2.0 ESCRIBIR=false node --experimental-strip-types \
 *     --import ./scripts/_ts-hook.mjs scripts/version-minima.mjs
 */
import { ID_EN_LA_APP_STORE, comparaVersiones, esVersion } from '../lib/version.ts';

const minima = (process.env.MINIMA || '').trim();
const escribir = process.env.ESCRIBIR === 'true';

if (!esVersion(minima)) {
  console.error(`"${minima}" no es una versión. Escribe algo como 1.2.0.`);
  process.exit(1);
}

async function enLaAppStore(pais) {
  const url =
    `https://itunes.apple.com/lookup?id=${ID_EN_LA_APP_STORE}` +
    (pais ? `&country=${pais}` : '') +
    `&t=${Date.now()}`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    return d?.results?.[0] ?? null;
  } catch {
    return null;
  }
}

// Se dice en qué tienda está: que conteste la de Estados Unidos no quiere
// decir que esté a la venta en España (pasó: Apple decía "no disponible en tu
// país" a un usuario español con la versión ya publicada).
const enEspana = await enLaAppStore('es');
const sinPais = await enLaAppStore();
console.log(`Tienda de España: ${enEspana ? `sí (${enEspana.version})` : 'NO está a la venta'}`);
console.log(`Tienda de Estados Unidos: ${sinPais ? `sí (${sinPais.version})` : 'NO está a la venta'}`);
const ficha = enEspana ?? sinPais;
if (!ficha || !esVersion(ficha.version)) {
  console.error('La App Store no contesta o no encuentra la app. No se toca nada.');
  process.exit(1);
}
console.log(`App Store: "${ficha.trackName}" ${ficha.version}, publicada el ${ficha.currentVersionReleaseDate}.`);

if (comparaVersiones(ficha.version, minima) < 0) {
  console.error(
    `En la App Store todavía está la ${ficha.version}. Con la mínima en ${minima} nadie podría ` +
      'entrar en el iPhone. Espera a que Apple la publique y vuelve a lanzarlo.'
  );
  process.exit(1);
}

if (!escribir) {
  console.log(`Todo en orden para poner la mínima en ${minima}. No se ha escrito nada (ESCRIBIR no está activado).`);
  process.exit(0);
}

let initializeApp, applicationDefault, getFirestore, FieldValue;
try {
  ({ initializeApp, applicationDefault } = await import('firebase-admin/app'));
  ({ getFirestore, FieldValue } = await import('firebase-admin/firestore'));
} catch {
  console.error('Falta el paquete firebase-admin. Instálalo con: npm i --no-save firebase-admin');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const ref = getFirestore().collection('config').doc('version');
const antes = (await ref.get()).data()?.minima ?? '(ninguna)';
await ref.set({ minima, actualizada: FieldValue.serverTimestamp() }, { merge: true });
console.log(`Mínima: ${antes} → ${minima}. Quien tenga una versión anterior verá el muro al abrir la app.`);
