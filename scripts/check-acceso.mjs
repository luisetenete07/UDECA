/*
 * Quién entra en la app y quién ve el muro (lib/planBase.ts).
 *
 * Lo que hay que proteger: las dos puertas. `hasPlatformAccess` decide si
 * alguien ve la app o el muro de pago, y `needsEntryPayment` si le pedimos el
 * euro del alta. Equivocarse en cualquiera de las dos son las dos peores
 * cosas que puede hacer esta app: dejar fuera a quien paga, o cobrar dos veces
 * a quien ya pagó.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-acceso.mjs
 */
import {
  ADMIN_EMAILS,
  CUENTAS_ILIMITADAS,
  DAY_MS,
  ENTRY_REQUIRED_FROM,
  accesoIlimitado,
  hasPlatformAccess,
  isAdmin,
  needsEntryPayment,
  PAGOS_ACTIVOS,
  subscriptionState,
} from '../lib/planBase.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const AHORA = Date.parse('2026-08-12T10:00:00Z');
const NUEVA = ENTRY_REQUIRED_FROM + 5 * DAY_MS;

/** Un atleta cualquiera, registrado después de que existiera el alta. */
const atleta = (extra = {}) => ({
  uid: 'a1',
  role: 'athlete',
  email: 'alguien@ejemplo.test',
  name: 'Alguien',
  createdAt: NUEVA,
  ...extra,
});

console.log('\nLa cuenta de la casa');
{
  const casa = atleta({ email: 'udeca.app+atleta@gmail.com' });
  comprueba('está en la lista', accesoIlimitado(casa));
  comprueba('con mayúsculas también', accesoIlimitado(atleta({ email: 'UDECA.app+Atleta@Gmail.com' })));
  comprueba('con espacios de sobra también', accesoIlimitado(atleta({ email: '  udeca.app+atleta@gmail.com ' })));

  // Lo que se le da: entrar siempre y no pagar. Ni un día menos.
  comprueba('entra en la app', hasPlatformAccess(casa, AHORA));
  comprueba('y no le piden el euro del alta', !needsEntryPayment(casa));
  const e = subscriptionState(casa, AHORA);
  comprueba('sin cuenta atrás', e.daysLeft === null, String(e.daysLeft));
  comprueba('y sin cartel de "estás de prueba"', !e.trial);
  comprueba('activa', e.active);

  // Con la suscripción caducada de hace un año sigue dentro: para eso está.
  const caducada = atleta({
    email: 'udeca.app+atleta@gmail.com',
    subscriptionUntil: AHORA - 365 * DAY_MS,
    trialEndsAt: AHORA - 380 * DAY_MS,
  });
  comprueba('caducada hace un año, sigue entrando', hasPlatformAccess(caducada, AHORA));
  comprueba('y sigue sin pagar el alta', !needsEntryPayment(caducada));

  // Y lo que NO se le da, que es lo que importa: mandar.
  comprueba('NO es administradora', !isAdmin(casa));
  comprueba('las dos listas no se pisan',
    CUENTAS_ILIMITADAS.every((c) => !ADMIN_EMAILS.includes(c)), CUENTAS_ILIMITADAS.join(','));
}

console.log('\nUn atleta normal, para comparar');
{
  const enPrueba = atleta({
    subscriptionUntil: AHORA + 5 * DAY_MS,
    trialEndsAt: AHORA + 5 * DAY_MS,
  });
  comprueba('en prueba, entra', hasPlatformAccess(enPrueba, AHORA));
  comprueba('con sus días contados', subscriptionState(enPrueba, AHORA).daysLeft === 5);
  comprueba('y sabiendo que es prueba', subscriptionState(enPrueba, AHORA).trial);
  /*
   * La prueba NO exime del alta: el euro es justo lo que la compra.
   *
   * Pero eso vale solo mientras SE COBRE. Con los pagos apagados no hay alta
   * que pedir y el muro se levanta entero (ver PAGOS_ACTIVOS en planBase), así
   * que aquí se comprueba lo contrario: que nadie se queda en una puerta que no
   * abre con ninguna llave. La condición se escribe con la constante y no a
   * mano para que el día que se vuelva a cobrar esto vuelva a exigir el euro
   * solo, sin que nadie se acuerde de venir.
   */
  comprueba(
    PAGOS_ACTIVOS
      ? 'estando de prueba, el alta sigue pendiente'
      : 'sin cobrar, a nadie se le pide el alta',
    needsEntryPayment(enPrueba) === PAGOS_ACTIVOS
  );

  const caducado = atleta({
    subscriptionUntil: AHORA - DAY_MS,
    trialEndsAt: AHORA - DAY_MS,
    entryPaidAt: NUEVA,
  });
  comprueba('caducado, al muro', !hasPlatformAccess(caducado, AHORA));

  const pagando = atleta({
    subscriptionUntil: AHORA + 25 * DAY_MS,
    trialEndsAt: AHORA - 10 * DAY_MS,
    entryPaidAt: NUEVA,
  });
  comprueba('pagando, dentro', hasPlatformAccess(pagando, AHORA));
  comprueba('y ya no es prueba', !subscriptionState(pagando, AHORA).trial);
  comprueba('ni le piden el alta otra vez', !needsEntryPayment(pagando));
}

console.log('\nLos que nunca pagan');
{
  const admin = atleta({ email: ADMIN_EMAILS[0] });
  comprueba('el admin entra siempre', hasPlatformAccess(admin, AHORA));
  comprueba('y no paga alta', !needsEntryPayment(admin));

  // El alumno de un coach entra gratis por definición.
  const alumno = { uid: 'c1', role: 'client', email: 'alumno@ejemplo.test', name: 'Alumno', createdAt: NUEVA, trainerId: 't1' };
  comprueba('el alumno de un coach entra', hasPlatformAccess(alumno, AHORA));
  comprueba('y no paga nada', !needsEntryPayment(alumno));

  // Fundador: existía antes de que hubiera alta, no se le cambian las reglas.
  const fundador = atleta({ createdAt: ENTRY_REQUIRED_FROM - DAY_MS, subscriptionUntil: AHORA - DAY_MS });
  comprueba('a un fundador no se le cobra el alta a posteriori', !needsEntryPayment(fundador));

  comprueba('sin perfil no se rompe nada', hasPlatformAccess(null) && !needsEntryPayment(null));
  comprueba('sin correo, tampoco', !accesoIlimitado(atleta({ email: undefined })));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
