/*
 * Mastery es de UN entrenador. Que siga siéndolo.
 *
 * La app fue CALICO: una plataforma para muchos entrenadores, cada uno con su
 * alta, su plan, su marca y su código de invitación. Todo eso se quitó cuando
 * pasó a ser la app de Luis Tena para sus alumnos. Lo que se protege aquí es
 * que no vuelva a colarse por una puerta de atrás:
 *
 *  1. Nadie se registra como entrenador desde la app, y las reglas no dejan
 *     crear uno que no sea con los correos de Luis.
 *  2. El alumno no necesita código: la solicitud va a quien esté apuntado como
 *     el coach (config/coach), y solo Luis puede apuntarse.
 *  3. No queda nada que cobre: ni muros de pago, ni enlaces a Stripe, ni
 *     precios.
 *  4. El nombre es el nuevo, en la app y en el móvil.
 *  5. No hay nada más en internet que la app: ni web de presentación, ni
 *     páginas sueltas, ni intro que venda la app a quien no la conoce.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-un-solo-coach.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MARCA, MARCA_CORTA } from '../lib/marca.ts';
import { ADMIN_EMAILS, isAdmin } from '../lib/planBase.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const hay = (f) => existsSync(new URL(`../${f}`, import.meta.url));
/** Sin comentarios: lo que se comprueba es lo que corre, no lo que se cuenta. */
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n1 · Alta solo de alumnos');
{
  const auth = sinComentarios(lee('lib/auth-context.tsx'));
  ok('el contexto ya no sabe registrar entrenadores', !/registerTrainer/.test(auth));
  ok("crear la cuenta siempre crea un alumno", /role: 'client'/.test(auth) && !/role: 'trainer'/.test(auth));
  ok('y manda la solicitud al coach en el mismo paso', /pedirEntrada\(nuevo\)/.test(auth));

  const completar = sinComentarios(lee('app/(auth)/completar.tsx'));
  ok('completar la cuenta no pregunta el rol', !/Entrenador/.test(completar) && !/setRole/.test(completar));
  ok('ni pide código', !/codigo/i.test(completar));

  const registro = sinComentarios(lee('app/(auth)/register.tsx'));
  ok('el registro no ofrece ser entrenador', !/'Entrenador'/.test(registro));

  const reglas = lee('firestore.rules');
  const crear = reglas.slice(reglas.indexOf('match /users/{userId}'), reglas.indexOf('allow update', reglas.indexOf('match /users/{userId}')));
  ok(
    'las reglas solo dejan crear entrenadores con los correos de Luis',
    /request\.resource\.data\.role == 'client'\s*\|\|\s*\(\s*request\.auth\.token\.email_verified == true\s*&& request\.auth\.token\.email in \[/.test(crear)
  );
  for (const correo of ADMIN_EMAILS) {
    ok(`y ${correo} está en esa lista`, crear.includes(`'${correo}'`), 'la lista de las reglas y la de lib/planBase.ts se han separado');
  }
  ok('y nadie nace con suscripción', /!\('subscriptionUntil' in request\.resource\.data\)/.test(crear));
  ok('aceptar a un alumno ya no mira plazas', !/coachWithinPlan/.test(reglas));
}

console.log('\n2 · La solicitud llega a Luis sin código');
{
  const coach = lee('lib/coachUnico.ts');
  ok('hay un sitio que dice quién es el coach', /doc\(db, 'config', 'coach'\)/.test(coach));
  ok('solo se apunta una cuenta de entrenador con correo de Luis', /profile\.role !== 'trainer' \|\| !isAdmin\(profile\)/.test(coach));
  ok('y solo si falta: abrir la app no es una escritura', /if \(snap\.exists\(\) && snap\.data\(\)\.trainerId\) return;/.test(coach));

  const layout = lee('app/(trainer)/_layout.tsx');
  ok('la cuenta de Luis se apunta al abrir su panel', /fijarCoach\(profile\)/.test(layout));

  const reglas = lee('firestore.rules');
  const bloque = reglas.slice(reglas.indexOf('match /config/coach'), reglas.indexOf('match /config/{docId}'));
  ok('las reglas dejan leer quién es el coach con sesión', /allow read: if request\.auth != null;/.test(bloque));
  ok('pero escribirlo solo a Luis, verificado', /email_verified == true/.test(bloque) && ADMIN_EMAILS.every((c) => bloque.includes(`'${c}'`)));
  ok('apuntándose a sí mismo y siendo entrenador', /trainerId == request\.auth\.uid/.test(bloque) && /\.data\.role == 'trainer'/.test(bloque));
  ok('y no se puede borrar desde la app', /allow delete: if false;/.test(bloque));

  const solicitudes = reglas.slice(reglas.indexOf('match /joinRequests/{reqId}'), reglas.indexOf('match /users/{userId}'));
  ok(
    'una solicitud solo puede ir al coach apuntado',
    /trainerId\s*== get\(\/databases\/\$\(database\)\/documents\/config\/coach\)\.data\.trainerId/.test(solicitudes)
  );

  const puerta = lee('components/LinkTrainerScreen.tsx');
  ok('la pantalla de espera solo pide código si no se sabe quién es el coach', /coach === null/.test(puerta));

  ok('el coach se reconoce por los correos de Luis', isAdmin({ email: 'LuisTenaF@gmail.com' }) && !isAdmin({ email: 'otro@gmail.com' }));
}

console.log('\n3 · Nada que cobre');
{
  for (const f of [
    'components/Paywall.tsx',
    'components/EntryWall.tsx',
    'components/TrialBanner.tsx',
    'components/UpgradeCard.tsx',
    'components/EditorDeMarca.tsx',
    'lib/precios.ts',
    'lib/enlacesDeCobro.ts',
    'lib/fundador.ts',
    'lib/marcaPropia.ts',
    'payments-webhook/api/pagar.js',
    'payments-webhook/api/stripe-webhook.js',
    'payments-webhook/api/claim-entry.js',
    'payments-webhook/api/check-subscription.js',
  ]) {
    ok(`${f} ya no existe`, !hay(f));
  }

  // Ningún enlace a la pasarela ni al endpoint de pago en lo que se publica.
  const ficheros = [];
  const recorre = (dir) => {
    for (const n of readdirSync(new URL(`../${dir}`, import.meta.url))) {
      const ruta = join(dir, n);
      const st = statSync(new URL(`../${ruta}`, import.meta.url));
      if (st.isDirectory()) recorre(ruta);
      else if (/\.(tsx?|js|html)$/.test(n)) ficheros.push(ruta);
    }
  };
  for (const d of ['app', 'components', 'lib', 'payments-webhook/api']) recorre(d);
  const conPago = ficheros.filter((f) => /buy\.stripe\.com|\/api\/pagar|\/api\/claim-entry|\/api\/check-subscription/.test(sinComentarios(lee(f))));
  ok('ni un enlace a Stripe ni a los endpoints de cobro', conPago.length === 0, conPago.join(', '));

  ok('el servidor ya no tiene Stripe dentro', !ficheros.filter((f) => f.startsWith('payments-webhook')).some((f) => /from 'stripe'/.test(lee(f))));
}

console.log('\n4 · El nombre nuevo');
{
  ok('la app se llama Mastery', MARCA === 'Mastery');
  const app = JSON.parse(lee('app.json')).expo;
  ok(`bajo el icono se lee ${MARCA_CORTA}`, app.name === MARCA_CORTA, app.name);
  ok('sin tocar el identificador de las tiendas', app.ios.bundleIdentifier === 'com.udeca.app' && app.android.package === 'entrenadores.app');
  const manifest = JSON.parse(lee('public/manifest.json'));
  ok('la app web instalada también', manifest.short_name === MARCA_CORTA && manifest.name === MARCA);
  ok('y la pestaña del navegador', lee('app/+html.tsx').includes(`<title>${MARCA}</title>`));

  const i18n = lee('lib/i18n.ts');
  const conCalico = [...i18n.matchAll(/^ {2}'([^']*CALICO[^']*)':/gm)].map((m) => m[1]);
  ok('ninguna frase de la app dice CALICO', conCalico.length === 0, conCalico.slice(0, 3).join(' | '));
}

console.log('\n4b · Es la app de Luis, y se nota');
{
  /*
   * "Personaliza todo para mí. Soy Luis. Es mi app": arriba a la izquierda el
   * tridente, MASTERY y @luistenafit, y en los textos, Luis en vez de "tu
   * entrenador". Una app de un solo coach que habla de "tu entrenador" suena
   * a plataforma de muchos.
   */
  const marca = lee('lib/marca.ts');
  ok('el usuario de Luis está apuntado', /export const ARROBA = '@luistenafit';/.test(marca));
  const firma = sinComentarios(lee('components/MarcaMastery.tsx'));
  ok('la firma lleva el tridente, MASTERY y @luistenafit',
    /emblema\.png/.test(firma) && /\{MARCA_CORTA\}/.test(firma) && /\{ARROBA\}/.test(firma));
  ok('en la barra lateral del ordenador', /<MarcaMastery \/>/.test(sinComentarios(lee('components/SidebarBrand.tsx'))));
  ok('sin el rol de la cuenta debajo', !/rotuloDelRol/.test(lee('components/SidebarBrand.tsx')));
  for (const f of ['app/(client)/dashboard.tsx', 'app/(trainer)/dashboard.tsx']) {
    ok(`y en el inicio del móvil (${f})`, /<MarcaMasteryEnMovil \/>/.test(lee(f)));
  }
  ok('el panel no se llama "Panel del entrenador"', !/Panel del entrenador/.test(lee('app/(trainer)/dashboard.tsx')));

  const ficheros = [];
  const recorre = (dir) => {
    for (const n of readdirSync(new URL(`../${dir}`, import.meta.url))) {
      const ruta = join(dir, n);
      if (statSync(new URL(`../${ruta}`, import.meta.url)).isDirectory()) recorre(ruta);
      else if (/\.(tsx?|js)$/.test(n)) ficheros.push(ruta);
    }
  };
  for (const d of ['app', 'components', 'lib', 'payments-webhook/api']) recorre(d);
  const generico = ficheros.filter((f) => /\b[Tt]u (entrenador|coach)\b|\b[Yy]our coach\b/.test(sinComentarios(lee(f))));
  ok('ningún texto dice "tu entrenador": dice Luis', generico.length === 0, generico.join(', '));
}

console.log('\n5 · En internet, solo la app');
{
  for (const d of ['web', 'acceso', 'payments-webhook/public']) {
    ok(`${d}/ ya no existe`, !hay(d));
  }
  const despliegue = lee('.github/workflows/deploy.yml');
  ok('el despliegue no publica páginas sueltas', !/for pagina in/.test(despliegue) && !despliegue.includes('www.udeca.app'));
  ok('sin flujos para subir a las tiendas', !hay('.github/workflows/build-ios.yml') && !hay('.github/workflows/build-android.yml'));
  ok('sin intro de presentación', !hay('app/(auth)/welcome.tsx') && !/welcome/.test(lee('app/index.tsx')));
  ok('quien no tiene sesión va directo a entrar', /<Redirect href="\/\(auth\)\/login" \/>/.test(lee('app/index.tsx')));
}

console.log(fallos === 0 ? '\n✔ Un solo entrenador, sin cobros y con su nombre' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
