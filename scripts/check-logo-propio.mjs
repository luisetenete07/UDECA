/**
 * El logo del entrenador en lugar del de UDECA (lib/planBase.ts › puedeLlevarLogo).
 *
 * Lo que se protege:
 *
 *  - Que sea del PLAN SIN TOPE (y de fundadores y cuentas de la casa): es la
 *    razón más visible para dar el salto desde el plan de entrada.
 *  - Que se decida con lo que escribe el servidor, no con el logo en sí: subir
 *    un logo lo puede cualquiera; que se VEA, no.
 *  - Que UDECA no desaparezca del todo: con marca propia queda un "con UDECA"
 *    pequeño en las pantallas de puerta, en el perfil y en lo que se comparte.
 *    Es nuestro único canal de crecimiento que no cuesta dinero.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-logo-propio.mjs
 */
import { readFileSync } from 'node:fs';
import { puedeLlevarLogo } from '../lib/planBase.ts';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.UTC(2026, 9, 10, 12);

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const lee = (f) => readFileSync(f, 'utf8');
const coach = (extra = {}) => ({
  uid: 'c1', role: 'trainer', name: 'Coach', email: 'coach@demo.test', createdAt: AHORA - 100 * DIA, ...extra,
});

console.log('\nQuién puede llevar logo');
ok('plan sin tope y al día: sí', puedeLlevarLogo(coach({ subscriptionPlan: 'annual', subscriptionUntil: AHORA + 30 * DIA }), AHORA));
ok('plan sin tope caducado: no', !puedeLlevarLogo(coach({ subscriptionPlan: 'annual', subscriptionUntil: AHORA - DIA }), AHORA));
ok('plan de entrada: no', !puedeLlevarLogo(coach({ subscriptionUntil: AHORA + 200 * DIA }), AHORA));
ok('fundador (sin fecha de suscripción): sí', puedeLlevarLogo(coach(), AHORA));
ok('cuenta de la casa: sí', puedeLlevarLogo(coach({ email: 'luistenaf@gmail.com', subscriptionUntil: AHORA - DIA }), AHORA));
ok('un alumno: nunca (el suyo es el de su coach)', !puedeLlevarLogo({ ...coach(), role: 'client' }, AHORA));
ok('sin perfil: no', !puedeLlevarLogo(null, AHORA));

console.log('\nSe decide al enseñarlo, no al subirlo');
{
  const sesion = lee('lib/auth-context.tsx');
  ok('el del coach, para sus alumnos, pasa por la regla',
    /setLogoDelCoach\(datos && puedeLlevarLogo\(datos\) \? \(datos\.brandLogo \?\? null\) : null\)/.test(sesion));
  ok('y el suyo, para él, también', /: puedeLlevarLogo\(profile\)\s*\?\s*\(profile\?\.brandLogo \?\? null\)/.test(sesion));
  const editor = lee('components/EditorDeMarca.tsx');
  ok('subirlo solo sale con el plan que lo incluye', /const puedeLogo = esEntrenador && puedeLlevarLogo\(profile\);/.test(editor));
  ok('y con el de entrada se dice qué incluye', /Incluido en el plan sin tope/.test(editor));
  ok('un logo enorme no entra', /nuevo\.length > 400_000/.test(editor));
  ok('se guarda en PNG, con su transparencia', /png: true/.test(lee('lib/image.ts')));
}

console.log('\nDónde se ve');
{
  ok('pantallas de puerta', /source=\{suyo \? \{ uri: logo! \}/.test(lee('components/Logo.tsx')));
  ok('barra lateral', /logo \? \{ uri: logo \}/.test(lee('components/SidebarBrand.tsx')));
  ok('inicio del coach', /logo=\{logo\}/.test(lee('app/(trainer)/dashboard.tsx')));
  ok('inicio del alumno', /styles\.logoCoach/.test(lee('app/(client)/dashboard.tsx')));
  ok('tarjeta del perfil', /styles\.marcaLogo/.test(lee('components/ProgressCard.tsx')));
  ok('imágenes que se comparten', /marcaActual\(\)\.logo \?\? UDECA_LOGO_DATA_URI/.test(lee('lib/brandCards.ts')));
  ok('informe de progreso', /marcaActual\(\)\.logo \?\? UDECA_LOGO_DATA_URI/.test(lee('lib/report.ts')));
}

console.log('\nY UDECA no desaparece del todo');
{
  ok('"con UDECA" en las pantallas de puerta', />con UDECA</.test(lee('components/Logo.tsx')));
  ok('en el perfil del alumno', />con UDECA</.test(lee('app/(client)/profile.tsx')));
  ok('en el del entrenador', />con UDECA</.test(lee('app/(trainer)/profile.tsx')));
  const motor = lee('lib/cardEngine.ts');
  ok('en las imágenes que se comparten', /T\.marca \? 'C O N   U D E C A'/.test(motor));
  ok('con la web de UDECA al pie', /w w w \. u d e c a \. a p p/.test(motor));
  ok('y en el informe', /\$\{marca\} · con UDECA/.test(lee('lib/report.ts')));
  ok('entrar y registrarse siguen siendo de UDECA', /<Logo sinSesion \/>/.test(lee('app/(auth)/login.tsx')));
}

console.log(fallos === 0 ? '\n✔ El logo es del plan sin tope y UDECA sigue firmando' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
