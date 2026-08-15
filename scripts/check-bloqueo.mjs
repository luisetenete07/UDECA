/**
 * El alumno que no paga: cuándo se le corta y cuándo no.
 *
 * Es la regla que más cara sale si se equivoca en cualquiera de los dos
 * sentidos. Si bloquea de menos, el coach trabaja gratis sin enterarse. Si
 * bloquea de más, un alumno al día se queda fuera de su propio entrenamiento
 * sin haber hecho nada mal, que es la clase de fallo por la que la gente se da
 * de baja y no vuelve.
 *
 * El calendario que se comprueba aquí:
 *
 *   día 0    vence la cuota            → entra, con aviso
 *   días 1-5 margen                    → entra, con aviso
 *   día 6    se acabó el margen        → BLOQUEADO
 *   dice "ya he pagado"                → entra otra vez, 3 días
 *   día 4 sin que el coach confirme    → BLOQUEADO otra vez
 *   el coach confirma                  → entra, y a correr
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-bloqueo.mjs
 */
import {
  CLIENT_GRACE_DAYS,
  CLIENT_REPORT_GRACE_DAYS,
  clientDaysUntilLock,
  clientIsLocked,
} from '../lib/planBase.ts';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.UTC(2026, 7, 15, 12, 0, 0);

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

/** Un alumno con cuota puesta, al que le venció el pago hace `dias` días. */
const alumno = (dias, extra = {}) => ({
  uid: 'a1',
  role: 'client',
  name: 'Marcos',
  email: 'marcos@demo.test',
  trainerId: 'coach1',
  monthlyFeeEur: 45,
  nextPaymentDate: AHORA - dias * DIA,
  ...extra,
});

console.log('\nEl margen son ' + CLIENT_GRACE_DAYS + ' días');
ok('el día que vence, entra', !clientIsLocked(alumno(0), AHORA));
ok('al día siguiente, entra', !clientIsLocked(alumno(1), AHORA));
ok('a los 5 días, todavía entra', !clientIsLocked(alumno(5), AHORA));
ok('a los 6, ya no', clientIsLocked(alumno(6), AHORA));
ok('y a los 30 tampoco', clientIsLocked(alumno(30), AHORA));

console.log('\nY se le dice cuánto le queda antes de quedarse fuera');
ok('el día que vence, 5 días', clientDaysUntilLock(alumno(0), AHORA) === 5);
ok('a los 3 días, quedan 2', clientDaysUntilLock(alumno(3), AHORA) === 2);
ok('pasado el margen, cero', clientDaysUntilLock(alumno(6), AHORA) === 0);

console.log('\n"Ya he pagado" le devuelve el acceso mientras el coach lo confirma');
{
  const acabaDeAvisar = alumno(6, { paymentReportedAt: AHORA - 1000 });
  ok('avisar reabre la app', !clientIsLocked(acabaDeAvisar, AHORA));
}
{
  const aviso2Dias = alumno(10, { paymentReportedAt: AHORA - 2 * DIA });
  ok(`sigue dentro ${CLIENT_REPORT_GRACE_DAYS} días`, !clientIsLocked(aviso2Dias, AHORA));
}
{
  // Si el coach no confirma, el aviso no puede valer para siempre: si no,
  // cualquiera pulsa "ya he pagado" y no vuelve a pagar nunca.
  const aviso4Dias = alumno(10, { paymentReportedAt: AHORA - 4 * DIA });
  ok('pero no para siempre', clientIsLocked(aviso4Dias, AHORA));
}
{
  const confirmado = alumno(-30, { paymentStatus: 'paid', paymentReportedAt: AHORA - 40 * DIA });
  ok('y al confirmarlo, entra sin más', !clientIsLocked(confirmado, AHORA));
}

console.log('\nA quien no hay nada que cobrarle NO se le bloquea nunca');
ok('sin cuota (0 €)', !clientIsLocked(alumno(60, { monthlyFeeEur: 0 }), AHORA));
ok('sin fecha de pago', !clientIsLocked({ ...alumno(60), nextPaymentDate: undefined }, AHORA));
ok('de cortesía', !clientIsLocked(alumno(60, { paymentStatus: 'free' }), AHORA));
ok('de prueba', !clientIsLocked(alumno(60, { paymentStatus: 'trial' }), AHORA));
ok('sin entrenador', !clientIsLocked(alumno(60, { trainerId: undefined }), AHORA));
ok('un atleta, que se paga lo suyo aparte', !clientIsLocked(alumno(60, { role: 'athlete' }), AHORA));
ok('un entrenador', !clientIsLocked(alumno(60, { role: 'trainer' }), AHORA));
ok('sin perfil todavía', !clientIsLocked(null, AHORA));

console.log('\nY la pantalla de bloqueo está enchufada de verdad');
{
  // Que la regla funcione no sirve de nada si nadie la mira: esto comprueba
  // que el layout del alumno la consulta y enseña la pantalla.
  const { readFileSync } = await import('node:fs');
  const layout = readFileSync('app/(client)/_layout.tsx', 'utf8');
  ok(
    'el layout del alumno consulta el bloqueo',
    /clientIsLocked\(profile\)/.test(layout)
  );
  ok(
    'y enseña la pantalla de cuota pendiente',
    /<ClientLockScreen \/>/.test(layout)
  );
  const pantalla = readFileSync('components/ClientLockScreen.tsx', 'utf8');
  ok('con el botón de "ya he pagado"', /Ya he pagado/.test(pantalla));
  ok('y sin forma de saltársela', !/onClose|cerrar|dismiss/i.test(pantalla));
}

console.log(fallos === 0 ? '\n✔ El bloqueo por impago funciona' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
