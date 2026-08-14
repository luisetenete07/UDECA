/**
 * Los permisos que pide la app en el móvil.
 *
 * POR QUÉ ESTO TIENE SU PROPIA COMPROBACIÓN. Los textos de permiso son lo
 * primero que lee un usuario del móvil y lo primero que mira Apple al revisar
 * la app. Los que trae Expo por defecto ("Allow $(PRODUCT_NAME) to access your
 * camera") son motivo de rechazo, y encima se cuelan solos: basta añadir un
 * plugin para que aparezca un permiso que la app no usa. Aquí se comprueba:
 *
 *  - Que ningún texto sea el genérico de Expo.
 *  - Que no se pida ningún permiso que la app no usa.
 *  - Que estén los que sí usa (fotos, movimiento y calendario).
 *  - Que cada uno tenga su traducción, en español y en inglés. Un permiso sin
 *    traducir es la única pantalla de la app que seguiría saliendo en español
 *    pase lo que pase, porque la pinta iOS y no nuestro <Text>.
 *
 *   node scripts/check-permisos.mjs
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let fallos = 0;
const mal = (m) => {
  console.error('  ✗', m);
  fallos++;
};

const raiz = new URL('..', import.meta.url).pathname;
const introspect = JSON.parse(
  execFileSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], {
    cwd: raiz,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
);
const plist = introspect.ios?.infoPlist ?? {};

/** Lo que la app usa de verdad, y por qué. */
const NECESARIOS = [
  ['NSPhotoLibraryUsageDescription', 'foto de perfil, fotos de progreso y libretas'],
  ['NSMotionUsageDescription', 'contador de pasos'],
  ['NSCalendarsUsageDescription', 'llevar cobros y bloques al calendario'],
  ['NSCalendarsFullAccessUsageDescription', 'lo mismo, en iOS 17+'],
];

/** Lo que NO se usa: si aparece, alguien añadió un plugin sin mirar. */
const SOBRAN = [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSRemindersUsageDescription',
  'NSRemindersFullAccessUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSContactsUsageDescription',
];

for (const [clave, para] of NECESARIOS) {
  const texto = plist[clave];
  if (!texto) mal(`falta ${clave} (${para})`);
  else if (/\$\(PRODUCT_NAME\)|^Allow /.test(texto)) mal(`${clave} sigue con el texto de ejemplo de Expo`);
  else if (texto.length < 40) mal(`${clave} es demasiado escueto para pasar revisión: "${texto}"`);
}

for (const clave of SOBRAN) {
  if (plist[clave]) mal(`se pide ${clave} y la app no lo usa: "${plist[clave]}"`);
}

// --- Traducciones ---
const locales = introspect.locales ?? {};
for (const idioma of ['es', 'en']) {
  if (!locales[idioma]) {
    mal(`no hay traducción de los permisos para "${idioma}"`);
    continue;
  }
  const fichero = JSON.parse(readFileSync(new URL('../' + locales[idioma].replace('./', ''), import.meta.url), 'utf8'));
  for (const [clave] of NECESARIOS) {
    if (!fichero[clave]) mal(`${locales[idioma]}: falta ${clave}`);
  }
  // El inglés tiene que estar en inglés: si alguien copia el fichero español y
  // se olvida de traducirlo, esto lo canta.
  if (idioma === 'en') {
    for (const [clave] of NECESARIOS) {
      const t = fichero[clave] ?? '';
      if (/\b(para|tus|tu|los|las|del|que|sin)\b/i.test(t)) mal(`en.json: ${clave} sigue en español`);
    }
  }
}

console.log(fallos === 0 ? 'check-permisos: OK' : `check-permisos: ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
