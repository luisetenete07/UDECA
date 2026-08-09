/*
 * Fechas escritas a mano fuera de lib/fechas.ts.
 *
 * Este guion existe porque la duplicación de fechas ya pasó una vez y costó
 * cara: llegó a haber CINCO versiones de "cuándo empieza la semana" —en
 * lib/stats.ts, lib/cyclePlan.ts, lib/cycleStats.ts, components/CycleProgress
 * y lib/fechas.ts— y dos de "el principio del día" repartidas en una docena
 * de copias sueltas. No es solo repetición: el fallo clásico de la primera es
 * el domingo (`getDay()` devuelve 0 y hay que retroceder seis días, no uno) y
 * el de la segunda es comparar milisegundos, que hace que un entreno de las
 * once de la noche cuente como el del día siguiente. Con una sola copia esos
 * fallos se arreglan una vez; con cinco, se arreglan cuatro veces y se olvida
 * la quinta.
 *
 *   node scripts/check-fechas-sueltas.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const CARPETAS = ['app', 'components', 'lib'];

/**
 * Ficheros que pueden escribirlas a mano, con el motivo.
 *
 * `lib/cardEngine.ts` es un script que se incrusta tal cual dentro de un
 * WebView para dibujar las tarjetas: allí no existen los imports de la app,
 * así que su copia es inevitable y está aislada.
 */
const PERMITIDOS = {
  'lib/fechas.ts': 'es la casa de todas',
  'lib/cardEngine.ts': 'se ejecuta dentro de un WebView, sin imports',
};

const PATRONES = [
  { re: /setHours\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/, usa: 'inicioDelDia()' },
  { re: /toLocaleDateString\(\s*'es-ES'/, usa: 'diaMes(), fechaCorta(), mesLargo()… de lib/fechas' },
  { re: /\.charAt\(0\)\.toUpperCase\(\)\s*\+\s*\w+\.slice\(1\)/, usa: 'mayusculaInicial()' },
];

function* ficheros(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) yield* ficheros(ruta);
    else if (/\.tsx?$/.test(nombre)) yield ruta;
  }
}

let sueltas = 0;
for (const carpeta of CARPETAS) {
  for (const ruta of ficheros(join(RAIZ, carpeta))) {
    const rel = ruta.slice(RAIZ.length);
    if (PERMITIDOS[rel]) continue;
    const lineas = readFileSync(ruta, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
      for (const { re, usa } of PATRONES) {
        if (re.test(linea)) {
          console.log(`  ✖ ${rel}:${i + 1} — usa ${usa}`);
          console.log(`      ${linea.trim().slice(0, 90)}`);
          sueltas++;
        }
      }
    });
  }
}

if (sueltas === 0) {
  console.log('✔ Ninguna fecha escrita a mano fuera de lib/fechas.ts');
  console.log(
    `  (${Object.entries(PERMITIDOS)
      .map(([f, motivo]) => `${f}: ${motivo}`)
      .join('; ')})`
  );
}
process.exit(sueltas === 0 ? 0 : 1);
