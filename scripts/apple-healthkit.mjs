/**
 * Deja el App ID de UDECA listo para Salud (HealthKit) antes de compilar iOS.
 *
 * POR QUÉ HACE FALTA
 *
 * Los pasos del Apple Watch se leen de Salud, y eso exige la capacidad
 * HealthKit en el App ID y en el perfil de firma. EAS sabe activarla sola...
 * pero solo en modo interactivo: compilando desde aquí (sin nadie delante)
 * usa el perfil que ya tenía, y Xcode lo rechaza:
 *
 *   Provisioning profile "*[expo] com.udeca.app AppStore …" doesn't include
 *   the HealthKit capability.
 *
 * QUÉ HACE (con la clave de App Store Connect, la misma que usa EAS)
 *
 *  1. Si el App ID no tiene HealthKit, se lo activa.
 *  2. Si el perfil de App Store que hay no lo incluye, lo retira. En la
 *     compilación, EAS ve que su perfil ya no está en Apple y crea uno nuevo,
 *     que ya sale con HealthKit. Es lo mismo que haría EAS a mano.
 *
 * Es idempotente: con todo en orden, no toca nada. No escribe ni imprime
 * ninguna clave.
 *
 *   EXPO_ASC_API_KEY_PATH=… EXPO_ASC_KEY_ID=… EXPO_ASC_ISSUER_ID=… node scripts/apple-healthkit.mjs
 */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BUNDLE = 'com.udeca.app';
const API = 'https://api.appstoreconnect.apple.com/v1';
const ENTITLEMENT = 'com.apple.developer.healthkit';

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

async function asc(metodo, ruta, cuerpo) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (r.status === 204) return null;
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status}: ${texto.slice(0, 400)}`);
  return texto ? JSON.parse(texto) : null;
}

const ids = await asc('GET', `/bundleIds?filter[identifier]=${BUNDLE}&limit=20`);
const bundle = ids.data.find((b) => b.attributes.identifier === BUNDLE);
if (!bundle) {
  console.error(`No encuentro el App ID ${BUNDLE}`);
  process.exit(1);
}

// 1. La capacidad.
const caps = await asc('GET', `/bundleIds/${bundle.id}/bundleIdCapabilities?limit=200`);
const tiene = caps.data.some((c) => c.attributes.capabilityType === 'HEALTHKIT');
if (tiene) {
  console.log('HealthKit ya estaba activado en el App ID.');
} else {
  await asc('POST', '/bundleIdCapabilities', {
    data: {
      type: 'bundleIdCapabilities',
      attributes: { capabilityType: 'HEALTHKIT' },
      relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } } },
    },
  });
  console.log('HealthKit activado en el App ID.');
}

// 2. Los perfiles de App Store que no lo llevan.
const perfiles = await asc(
  'GET',
  `/bundleIds/${bundle.id}/profiles?limit=200&fields[profiles]=name,profileType,profileState,profileContent`
);
let retirados = 0;
for (const p of perfiles.data) {
  const { name, profileType, profileState, profileContent } = p.attributes;
  if (profileType !== 'IOS_APP_STORE') continue;
  const contenido = profileContent ? Buffer.from(profileContent, 'base64').toString('latin1') : '';
  const conSalud = contenido.includes(ENTITLEMENT);
  console.log(`Perfil "${name}" · ${profileState} · ${conSalud ? 'con' : 'sin'} HealthKit`);
  if (!conSalud) {
    await asc('DELETE', `/profiles/${p.id}`);
    retirados++;
    console.log(`  → retirado: EAS creará uno nuevo con HealthKit al compilar.`);
  }
}
console.log(retirados ? `${retirados} perfil(es) retirado(s).` : 'Perfiles al día.');
