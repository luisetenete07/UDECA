/**
 * Que las piezas precompiladas de iOS encajen entre sí.
 *
 * POR QUÉ EXISTE ESTE FICHERO
 *
 * La app no se abrió ni una sola vez en iPhone durante veintisiete
 * compilaciones. Pantalla negra dos segundos y fuera, sin decir nada. El
 * informe del móvil lo dijo en una línea:
 *
 *     DYLD, Symbol missing
 *     Symbol not found: ..._decorateModule(object:in:)
 *     Referenced from:  ExpoFileSystem.framework
 *     Expected in:      ExpoModulesCore.framework
 *
 * Desde el SDK 54, Expo no compila estos módulos desde el código: reparte
 * BINARIOS YA COMPILADOS (los .tar.gz de `prebuilds/`). Y en el SDK 57.0.1 el
 * binario de expo-file-system venía compilado contra una versión de
 * expo-modules-core distinta de la que se repartía: una función interna había
 * cambiado de dos parámetros a tres. Dos paquetes con el mismo número de
 * versión, 57.0.1, y sus binarios sin encajar.
 *
 * Nada en nuestro código podía provocarlo ni arreglarlo, y por eso costó tanto:
 *
 *   - No sale en Android, que sí compila desde el código.
 *   - No sale en web.
 *   - El .ipa parece perfecto por dentro: están todos los frameworks, todos
 *     los permisos y el paquete de JavaScript. Lo que falta es un SÍMBOLO
 *     DENTRO de un framework que sí está.
 *   - Ninguna red de seguridad escrita en JavaScript lo ve: el cargador de
 *     iOS mata el proceso antes de que exista JavaScript.
 *
 * Lo único que avisó fue Apple, en el correo de la compilación 21 (ITMS-90863),
 * nombrando este mismo símbolo. Se leyó como un aviso sobre Macs y no lo era.
 *
 * QUÉ HACE
 *
 * Lo mismo que el cargador de iOS, pero aquí y en un segundo: abre los binarios
 * precompilados, apunta qué símbolos DEFINE cada uno y cuáles NECESITA, y
 * comprueba que no falte ninguno.
 *
 * Solo mira los símbolos de Swift cuyo módulo es otro de estos paquetes. Los de
 * iOS, los de Swift y los de React los resuelve el sistema y no son cosa nuestra.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');

let fallos = 0;
const ok = (n, c, d = '') => {
  if (!c) fallos++;
  console.log(`${c ? '  OK  ' : '  FALLO'} ${n}${d ? ' -- ' + d : ''}`);
};

/** Los símbolos que un Mach-O define y los que espera de fuera. */
function simbolos(ruta) {
  const b = readFileSync(ruta);
  if (b.length < 32 || b.readUInt32LE(0) !== 0xfeedfacf) return null; // solo Mach-O 64
  const ncmds = b.readUInt32LE(16);
  const define = new Set();
  const necesita = new Set();
  let pos = 32;
  for (let i = 0; i < ncmds && pos + 8 <= b.length; i++) {
    const cmd = b.readUInt32LE(pos);
    const tam = b.readUInt32LE(pos + 4);
    if (tam <= 0) break;
    if (cmd === 0x02 /* LC_SYMTAB */) {
      const symoff = b.readUInt32LE(pos + 8);
      const nsyms = b.readUInt32LE(pos + 12);
      const stroff = b.readUInt32LE(pos + 16);
      for (let s = 0; s < nsyms; s++) {
        const e = symoff + s * 16;
        if (e + 16 > b.length) break;
        const strx = b.readUInt32LE(e);
        const tipo = b.readUInt8(e + 4);
        if (!strx) continue;
        const ini = stroff + strx;
        const fin = b.indexOf(0, ini);
        if (fin < 0) continue;
        const nombre = b.toString('utf8', ini, fin);
        if (!nombre) continue;
        const externo = (tipo & 0x01) !== 0; // N_EXT
        if (!externo) continue;
        if ((tipo & 0x0e) === 0x00) necesita.add(nombre); // N_UNDF
        else define.add(nombre);
      }
    }
    pos += tam;
  }
  return { define, necesita };
}

/**
 * De qué módulo de Swift es un símbolo.
 *
 * Swift codifica el nombre como `_$s` + longitud + módulo + el resto, así que
 * `_$s15ExpoModulesCore9AnyModule...` es del módulo `ExpoModulesCore`. Sacarlo
 * de aquí es lo que permite mirar solo lo nuestro y no los miles de símbolos
 * del sistema.
 */
function moduloDe(simbolo) {
  const m = /^_\$s(\d+)(.+)$/.exec(simbolo);
  if (!m) return null;
  const largo = Number(m[1]);
  return m[2].length >= largo ? m[2].slice(0, largo) : null;
}

// --- Buscar los paquetes que reparten binarios ya compilados ---------------
const conPrebuild = [];
const modulos = path.join(RAIZ, 'node_modules');

function miraPaquete(nombre) {
  const t = path.join(modulos, nombre, 'prebuilds', 'output', 'release', 'xcframeworks');
  if (!existsSync(t) || !statSync(t).isDirectory()) return;
  for (const f of readdirSync(t)) {
    if (f.endsWith('.tar.gz')) conPrebuild.push({ paquete: nombre, tar: path.join(t, f) });
  }
}

for (const entrada of existsSync(modulos) ? readdirSync(modulos) : []) {
  if (entrada.startsWith('.')) continue;
  // Los paquetes con arroba (@expo/ui) viven una carpeta más adentro. Sin esto
  // se quedaban fuera de la comprobación justo los de Expo, que son los que
  // reparten binarios ya compilados.
  if (entrada.startsWith('@')) {
    const dir = path.join(modulos, entrada);
    if (!statSync(dir).isDirectory()) continue;
    for (const hijo of readdirSync(dir)) miraPaquete(`${entrada}/${hijo}`);
  } else {
    miraPaquete(entrada);
  }
}

console.log('== Piezas de iOS que vienen ya compiladas ==');
if (conPrebuild.length === 0) {
  console.log('  (ninguna: nada que comprobar)');
  process.exit(0);
}

const temporal = mkdtempSync(path.join(tmpdir(), 'udeca-ios-'));
const piezas = [];
try {
  for (const { paquete, tar } of conPrebuild) {
    execFileSync('tar', ['xzf', tar, '-C', temporal], { stdio: 'ignore' });
  }
  // Cada .xcframework trae el binario de iPhone en su carpeta ios-arm64.
  for (const d of readdirSync(temporal)) {
    if (!d.endsWith('.xcframework')) continue;
    const nombre = d.replace('.xcframework', '');
    const bin = path.join(temporal, d, 'ios-arm64', `${nombre}.framework`, nombre);
    if (!existsSync(bin)) continue;
    const s = simbolos(bin);
    if (s) piezas.push({ nombre, ...s });
  }

  const version = (p) => {
    try {
      return JSON.parse(
        readFileSync(path.join(modulos, p, 'package.json'), 'utf8')
      ).version;
    } catch {
      return '?';
    }
  };
  console.log(
    '  ' +
      [...new Set(conPrebuild.map((c) => c.paquete))]
        .map((p) => `${p}@${version(p)}`)
        .join('\n  ')
  );

  // Todo lo que el conjunto ofrece entre sus miembros.
  const nombres = new Set(piezas.map((p) => p.nombre));
  const ofrecido = new Set();
  for (const p of piezas) for (const s of p.define) ofrecido.add(s);

  console.log('\n== Lo que cada pieza necesita de las demás ==');
  for (const p of piezas) {
    const faltan = [...p.necesita].filter((s) => {
      const m = moduloDe(s);
      // Solo lo que TIENE que dar otra de estas piezas. Lo del sistema, no.
      return m && m !== p.nombre && nombres.has(m) && !ofrecido.has(s);
    });
    ok(
      p.nombre,
      faltan.length === 0,
      faltan.length ? `${faltan.length} símbolo(s) que nadie define` : ''
    );
    for (const s of faltan.slice(0, 4)) console.log(`         ${s}`);
  }

  if (fallos > 0) {
    console.log('\n  Esto cierra la app en el iPhone nada más abrirla, siempre y sin');
    console.log('  mensaje: el cargador de iOS resuelve los símbolos al arrancar y');
    console.log('  mata el proceso si falta uno. No se arregla desde el código de la');
    console.log('  app: hay que cuadrar las versiones de estos paquetes entre sí.');
  }
} finally {
  rmSync(temporal, { recursive: true, force: true });
}

console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
