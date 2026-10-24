/**
 * En qué países está a la venta CALICO en la App Store, y por qué no en los
 * que no. Solo LEE: no cambia nada en App Store Connect.
 *
 * POR QUÉ EXISTE
 *
 * La 1.2.0 salía "Lista para distribución" en verde y, aun así, un iPhone de
 * España decía "no disponible en tu país o región". La búsqueda pública de
 * Apple lo confirmaba (en la tienda de Estados Unidos sí, en la de España no),
 * pero no decía el motivo. App Store Connect sí lo dice, país por país: si
 * falta el estado de comerciante de la Ley de Servicios Digitales de la UE, si
 * el país no está marcado, si falta una clasificación…
 *
 * Usa la misma clave que EAS (la .p8 de los secretos del repo). No escribe ni
 * imprime ninguna clave.
 *
 *   EXPO_ASC_API_KEY_PATH=… EXPO_ASC_KEY_ID=… EXPO_ASC_ISSUER_ID=… node scripts/apple-disponibilidad.mjs
 */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const APP_ID = '6794591283';
const BASE = 'https://api.appstoreconnect.apple.com';
/** Los países de la UE (los de la Ley de Servicios Digitales), en el código de Apple. */
const UE = new Set([
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL',
  'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE',
]);

const { EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID } = process.env;
if (!EXPO_ASC_API_KEY_PATH || !EXPO_ASC_KEY_ID || !EXPO_ASC_ISSUER_ID) {
  console.error('Faltan EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID o EXPO_ASC_ISSUER_ID');
  process.exit(1);
}

const b64url = (b) => Buffer.from(b).toString('base64url');
function token() {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = b64url(JSON.stringify({ alg: 'ES256', kid: EXPO_ASC_KEY_ID, typ: 'JWT' }));
  const cuerpo = b64url(
    JSON.stringify({ iss: EXPO_ASC_ISSUER_ID, iat: ahora, exp: ahora + 15 * 60, aud: 'appstoreconnect-v1' })
  );
  const firma = createSign('SHA256')
    .update(`${cabecera}.${cuerpo}`)
    .sign({ key: readFileSync(EXPO_ASC_API_KEY_PATH, 'utf8'), dsaEncoding: 'ieee-p1363' });
  return `${cabecera}.${cuerpo}.${b64url(firma)}`;
}
const jwt = token();

async function leer(ruta) {
  const r = await fetch(ruta.startsWith('http') ? ruta : `${BASE}${ruta}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`GET ${ruta} → ${r.status}: ${texto.slice(0, 600)}`);
  return JSON.parse(texto);
}

// La app y su versión publicada.
const app = await leer(`/v1/apps/${APP_ID}?fields[apps]=name,bundleId,primaryLocale`);
console.log(`App: ${app.data.attributes.name} (${app.data.attributes.bundleId})`);

// La disponibilidad, país por país (API v2).
const disp = await leer(`/v1/apps/${APP_ID}/appAvailabilityV2`);
console.log(`Se añade sola en países nuevos: ${disp.data.attributes.availableInNewTerritories ? 'sí' : 'no'}`);

const paises = [];
let siguiente = `/v2/appAvailabilities/${disp.data.id}/territoryAvailabilities?limit=200&include=territory`;
while (siguiente) {
  const pag = await leer(siguiente);
  for (const t of pag.data) {
    paises.push({
      pais: t.relationships?.territory?.data?.id ?? '?',
      disponible: !!t.attributes.available,
      estados: t.attributes.contentStatuses ?? [],
    });
  }
  siguiente = pag.links?.next ?? null;
}

const enVenta = paises.filter((p) => p.disponible && p.estados.every((e) => e === 'AVAILABLE'));
console.log(`\nPaíses: ${paises.length} en la lista · ${enVenta.length} a la venta de verdad`);

const espana = paises.find((p) => p.pais === 'ESP');
console.log(
  `\nESPAÑA: ${espana ? `marcada=${espana.disponible ? 'sí' : 'NO'} · estado=${espana.estados.join(', ') || '(sin estado)'}` : 'NO está en la lista de países'}`
);

// Los motivos, agrupados: cuántos países tiene cada uno, y si son de la UE.
const porEstado = new Map();
for (const p of paises) {
  const clave = `${p.disponible ? 'marcado' : 'NO marcado'} · ${p.estados.join(', ') || '(sin estado)'}`;
  const g = porEstado.get(clave) ?? [];
  g.push(p.pais);
  porEstado.set(clave, g);
}
console.log('\nPor estado:');
for (const [clave, lista] of [...porEstado].sort((a, b) => b[1].length - a[1].length)) {
  const ue = lista.filter((x) => UE.has(x)).length;
  console.log(`  ${clave}: ${lista.length} países${ue ? ` (${ue} de la UE)` : ''} — ${lista.slice(0, 12).join(' ')}${lista.length > 12 ? ' …' : ''}`);
}
