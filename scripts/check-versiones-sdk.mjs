#!/usr/bin/env node
/**
 * Cada módulo nativo, en la versión que trae el SDK. Ni una más.
 *
 * POR QUÉ EXISTE
 *
 * La app se cerraba nada más abrirla en el iPhone. No había ningún error en el
 * código: `react-native-gesture-handler` iba por la 3.0.2 y Expo SDK 57 trae la
 * 2.32; `@react-native-async-storage/async-storage` por la 3.1.1 cuando el SDK
 * trae la 2.2; `react-native-webview` por la 14 cuando el SDK trae la 13.16.
 * Tres versiones MAYORES por delante, en tres librerías con código nativo.
 *
 * Un módulo nativo tiene dos mitades —el JavaScript y el binario— y el SDK las
 * compila juntas. Cuando el JavaScript viene de una versión mayor distinta, la
 * mitad de abajo ya no encaja: gesture-handler envuelve la aplicación entera
 * (`GestureHandlerRootView` en app/_layout.tsx) y se inicializa antes de que se
 * pinte nada, así que el desajuste no da un error en pantalla, cierra la app.
 * En el navegador no pasa: ahí no hay binario.
 *
 * Y llegó solo. En package.json esas versiones iban con `^`, que autoriza a
 * npm a instalar cualquier versión mayor futura; un `npm install` cualquier
 * martes se trae la 3.0 y a partir de ese día la app no arranca en el móvil,
 * sin que nadie haya tocado una línea. Por eso van con `~` o clavadas, que es
 * como las escribe el propio Expo.
 *
 * QUÉ COMPRUEBA
 *
 * Que cada dependencia que el SDK conoce (`expo/bundledNativeModules.json`, la
 * lista con la que `npx expo install` decide qué instalar) esté declarada
 * EXACTAMENTE como dice esa lista, y que lo instalado en node_modules cumpla.
 *
 * Si algún día hace falta una versión distinta a propósito, se pone en
 * A_PROPOSITO con el motivo escrito. Lo que no puede volver a pasar es que se
 * cuele sin que nadie lo sepa.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-versiones-sdk.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const lee = (ruta) => JSON.parse(readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8'));

/**
 * Excepciones deliberadas: paquete -> por qué.
 * Vacío, y cuanto más tiempo siga vacío, mejor.
 */
const A_PROPOSITO = {};

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

const pkg = lee('package.json');
const bundled = lee('node_modules/expo/bundledNativeModules.json');
const deps = { ...pkg.dependencies };

console.log('\nLo declarado es lo que trae el SDK');
{
  const desviados = [];
  for (const [nombre, declarado] of Object.entries(deps)) {
    const esperado = bundled[nombre];
    if (!esperado) continue; // no lo gestiona el SDK: no es asunto de esta comprobación
    if (A_PROPOSITO[nombre]) continue;
    if (declarado !== esperado) desviados.push(`${nombre}: ${declarado} (SDK: ${esperado})`);
  }
  ok(
    'ninguna dependencia se sale de la lista del SDK',
    desviados.length === 0,
    desviados.join(' · ')
  );
}

console.log('\nY nada va con ^, que es lo que dejó entrar la 3.0');
{
  // El acento circunflejo autoriza cualquier versión mayor futura. En un módulo
  // nativo eso es una app que deja de arrancar sin que nadie la toque.
  const abiertos = Object.entries(deps)
    .filter(([nombre, v]) => bundled[nombre] && !A_PROPOSITO[nombre] && v.startsWith('^'))
    // El propio SDK escribe algunos con ^ (los que no llevan binario). Si él lo
    // hace, aquí también vale: lo que se compara es contra su lista.
    .filter(([nombre, v]) => bundled[nombre] !== v);
  ok('sin rangos que se abran solos', abiertos.length === 0, abiertos.map(([n]) => n).join(' · '));
}

console.log('\nY lo instalado cumple lo declarado');
{
  const malos = [];
  const mayor = (v) => v.replace(/^[~^]/, '').split('.')[0];
  for (const [nombre, declarado] of Object.entries(deps)) {
    const esperado = bundled[nombre];
    if (!esperado || A_PROPOSITO[nombre]) continue;
    const ruta = `node_modules/${nombre}/package.json`;
    if (!existsSync(new URL(`../${ruta}`, import.meta.url))) {
      malos.push(`${nombre}: no instalado`);
      continue;
    }
    const instalado = lee(ruta).version;
    if (mayor(instalado) !== mayor(esperado)) {
      malos.push(`${nombre}: instalado ${instalado}, SDK ${esperado}`);
    }
  }
  ok('ningún módulo va una versión mayor por delante', malos.length === 0, malos.join(' · '));
}

console.log('\nLas tres que cerraban la app, una por una');
for (const [nombre, mayorBuena] of [
  ['react-native-gesture-handler', '2'],
  ['@react-native-async-storage/async-storage', '2'],
  ['react-native-webview', '13'],
]) {
  const declarado = deps[nombre] ?? '(sin declarar)';
  ok(
    `${nombre} en la ${mayorBuena}.x`,
    declarado.replace(/^[~^]/, '').split('.')[0] === mayorBuena,
    declarado
  );
}

console.log(
  fallos === 0
    ? '\n✔ Los módulos nativos van en la versión que compila el SDK'
    : `\n${fallos} fallo(s) — corrige con: npx expo install --fix`
);
process.exit(fallos === 0 ? 0 : 1);
