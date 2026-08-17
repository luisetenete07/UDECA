#!/usr/bin/env node
/**
 * Guardián de módulos nativos.
 *
 * El rechazo de Apple de julio (crash al abrir en iPad) salió de aquí:
 * `react-native-reanimated` entró como dependencia TRANSITIVA, no estaba
 * declarada en package.json, el autolinking no la empaquetó y la app moría al
 * arrancar buscando RNWorklets.framework. No lo detectamos nosotros: nos lo
 * dijo el revisor de Apple.
 *
 * Un módulo nativo solo llega al binario si está DECLARADO. Este script recorre
 * node_modules, localiza todo lo que trae código nativo (config de módulo Expo
 * o podspec) y falla si encuentra alguno que no esté ni en las dependencias ni
 * en la lista de conocidos. Así, el día que una actualización arrastre otro
 * módulo nativo por debajo, se entera CI y no la App Store.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MODULES = join(ROOT, 'node_modules');

/**
 * Paquetes internos de Expo: los arrastra el propio `expo` (que sí está
 * declarado) y su autolinking los resuelve solo. No hace falta declararlos.
 * Si añades uno a mano, documenta POR QUÉ es seguro.
 */
const ALLOWED = new Set([
  '@expo/log-box',
  '@expo/dom-webview',
  '@react-native-masked-view/masked-view', // lo usa @react-navigation, va con él
  'expo-application',
  'expo-glass-effect',
  'expo-image-loader',
  'expo-modules-core',
  'expo-modules-jsi',
  'expo-symbols',
]);

function hasNativeCode(dir) {
  if (existsSync(join(dir, 'expo-module.config.json'))) return true;
  try {
    return readdirSync(dir).some((f) => f.endsWith('.podspec'));
  } catch {
    return false;
  }
}

function listPackages() {
  const out = [];
  for (const entry of readdirSync(MODULES)) {
    if (entry.startsWith('.')) continue;
    if (entry.startsWith('@')) {
      for (const sub of readdirSync(join(MODULES, entry))) {
        out.push(`${entry}/${sub}`);
      }
    } else {
      out.push(entry);
    }
  }
  return out;
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const declared = new Set(Object.keys(pkg.dependencies ?? {}));

const undeclared = [];
for (const name of listPackages()) {
  const dir = join(MODULES, name);
  if (!hasNativeCode(dir)) continue;
  if (declared.has(name) || ALLOWED.has(name)) continue;
  undeclared.push(name);
}

if (undeclared.length > 0) {
  console.error('\n✖ Módulos nativos sin declarar en package.json:\n');
  for (const name of undeclared) console.error(`    ${name}`);
  console.error(`
Estos paquetes traen código nativo pero han entrado como dependencia
transitiva. El autolinking NO los empaqueta, así que la app compila pero
CRASHEA al arrancar en el dispositivo (esto fue el rechazo de Apple).

Arréglalo de una de estas dos formas:
  1. Si la app lo usa de verdad:  npx expo install <paquete>
     (lo declara en package.json y entra en el binario)
  2. Si es un interno seguro que arrastra otra librería: añádelo a ALLOWED
     en scripts/check-native-deps.mjs, explicando por qué es seguro.
`);
  process.exit(1);
}

/**
 * Y AHORA AL REVÉS: declarado pero que no lo usa nadie.
 *
 * El fallo de arriba (módulo nativo sin declarar) ya estaba cubierto. Este es
 * su gemelo, y ha costado más caro: `react-native-reanimated` y
 * `react-native-worklets` estaban declarados —se declararon justo para arreglar
 * aquel rechazo de Apple— pero NINGUNA línea de la app los usaba. Seguían
 * metiendo `RNWorklets.framework` en el binario de iOS, con su instalación de
 * runtime al arrancar, para no hacer nada.
 *
 * Un módulo nativo que no se usa no es peso muerto inofensivo: es código que se
 * ejecuta antes que el tuyo, en el momento más frágil de la vida de la app, y
 * que si falla la mata sin dejar ni un mensaje en pantalla. En web y en Android
 * no se nota; en iPhone es una app que no abre.
 *
 * La regla: si trae código nativo y está declarado, que se use. Y si hace falta
 * sin que aparezca en el código, que esté escrito aquí por qué.
 */
const SIN_IMPORTAR = new Map([
  ['expo-linking', 'lo necesita expo-router para los enlaces profundos'],
  ['react-native-screens', 'lo usan expo-router y react-navigation por debajo'],
]);

const FUENTES = ['app', 'components', 'lib', 'plugins'];

function textoDelProyecto() {
  let texto = readFileSync(join(ROOT, 'app.json'), 'utf8');
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (/\.(ts|tsx|js|jsx)$/.test(entrada.name)) texto += readFileSync(ruta, 'utf8');
    }
  };
  for (const d of FUENTES) {
    const ruta = join(ROOT, d);
    if (existsSync(ruta)) recorrer(ruta);
  }
  return texto;
}

const proyecto = textoDelProyecto();
const sobrantes = [];
for (const name of declared) {
  const dir = join(MODULES, name);
  if (!existsSync(dir) || !hasNativeCode(dir)) continue;
  if (SIN_IMPORTAR.has(name)) continue;
  if (proyecto.includes(name)) continue;
  sobrantes.push(name);
}

if (sobrantes.length > 0) {
  console.error('\n✖ Módulos nativos declarados que no usa nadie:\n');
  for (const name of sobrantes) console.error(`    ${name}`);
  console.error(`
Traen código nativo al binario para no hacer nada. En iPhone eso es código
que corre ANTES que el tuyo al abrir la app: si falla, la app se cierra sin
enseñar nada (pasó con RNWorklets.framework).

Arréglalo de una de estas dos formas:
  1. Si de verdad no se usa:  npm uninstall <paquete>
  2. Si hace falta aunque no aparezca en el código: añádelo a SIN_IMPORTAR
     en scripts/check-native-deps.mjs, escribiendo quién lo necesita.
`);
  process.exit(1);
}

console.log(
  `✔ Módulos nativos correctos (${declared.size} declarados, ${ALLOWED.size} internos conocidos, ` +
    `ninguno de sobra)`
);
