/**
 * La app se llama CALICO: "udeca" no puede volver a colarse.
 *
 * Solo queda donde no es un nombre sino una DIRECCIÓN de algo que existe fuera
 * del código y que no se cambia escribiendo otra cosa aquí: el dominio y sus
 * correos, el proyecto de Firebase, la URL de Vercel, el identificador de la
 * app en las tiendas, el proyecto de EAS y el esquema con el que vuelve el
 * inicio de sesión de Google. Cambiar cualquiera de esos en el código deja la
 * app sin entrar, sin datos o sin actualizaciones.
 *
 * Y en la migración de las claves guardadas en el móvil, que tiene que seguir
 * reconociendo el prefijo viejo (lib/clavesAntiguas.ts).
 *
 *   node scripts/check-sin-udeca.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : `\n${extra}`}`);
  if (!bien) fallos++;
};

/** Lo que sí puede llevarlo, porque es una dirección de fuera. */
const PERMITIDOS = [
  /udeca\.app/i, // dominio, subdominios, correos y la cuenta de Google de la casa
  /udeca-luistenafit/, // proyecto de Firebase
  /udeca\.vercel\.app/, // servidor de pagos y avisos en Vercel
  /com\.udeca\.app/, // identificador de la app en las tiendas
  /github\.com\/luisetenete07\/udeca/i, // el repositorio
  /"slug": "udeca"/, // proyecto de EAS (las compilaciones)
  /udeca:\/\/oauthredirect/, // vuelta del inicio de sesión de Google
  /proyecto `udeca`|proyecto "udeca-(web|acceso)"|udeca-web|webhooks \(`udeca`/, // nombres de proyectos en Vercel y EAS (docs)
  /claude\/udeca-redesign/, // una rama antigua, citada en la historia
  /const ANTES = 'udeca'/, // la migración de claves
];
const ARCHIVOS_PERMITIDOS = new Set(['scripts/check-sin-udeca.mjs', 'scripts/check-google.mjs']);

const archivos = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && existsSync(f) && !/\.(png|jpe?g|webp|gif|ttf|otf|woff2?)$/i.test(f) && !f.includes('package-lock'));

const sueltos = [];
for (const f of archivos) {
  if (ARCHIVOS_PERMITIDOS.has(f)) continue;
  let texto;
  try {
    texto = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  texto.split('\n').forEach((linea, i) => {
    for (const m of linea.matchAll(/udeca/gi)) {
      const alrededor = linea.slice(Math.max(0, m.index - 40), m.index + 45);
      if (PERMITIDOS.some((p) => p.test(alrededor))) continue;
      // La línea del esquema en app.json: el primero de la lista.
      if (f === 'app.json' && linea.trim() === '"udeca",') continue;
      sueltos.push(`    ${f}:${i + 1}  ${linea.trim().slice(0, 100)}`);
    }
  });
}
console.log('\nSin "udeca" fuera de lo que es una dirección de fuera');
ok('ni en textos ni en nombres internos', sueltos.length === 0, sueltos.join('\n'));

console.log('\nLo guardado en el móvil no se pierde al cambiar de nombre');
{
  const migra = readFileSync('lib/clavesAntiguas.ts', 'utf8');
  ok('las claves viejas pasan a su nombre nuevo', /AHORA \+ clave\.slice\(ANTES\.length\)/.test(migra) && /multiRemove\(viejas\)/.test(migra));
  ok('sin pisar una nueva que ya exista', /!yaEstan\.has\(claveNueva\(k\)!\)/.test(migra));
  const raiz = readFileSync('app/_layout.tsx', 'utf8');
  ok('antes de que arranque la sesión (que lee la cola de entrenos y las cuentas)', /migrarClavesAntiguas\(\)/.test(raiz) && /!clavesListas \? null : \(\s*<AuthProvider>/.test(raiz));
  ok('y el widget, aunque se pinte antes de abrir la app', /await migrarClavesAntiguas\(\);/.test(readFileSync('lib/widgetHoy.ts', 'utf8')));
}

console.log(fallos === 0 ? '\n✔ Todo se llama CALICO' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
