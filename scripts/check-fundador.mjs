/*
 * Comprobación de la insignia de fundador (lib/fundador.ts).
 *
 * Aquí lo que se protege es una promesa: el número no se pierde nunca. Un
 * fallo que lo apagara de más no sería un fallo visual, sería quitarle a
 * alguien lo que compró. Y al revés: dejarlo encendido en una cuenta caducada
 * vacía la insignia para todos los demás.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-fundador.mjs
 */
import { AVISO_DIAS, estadoInsignia, numeroFundador } from '../lib/fundador.ts';
import { hasPlatformAccess } from '../lib/planBase.ts';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date(2026, 7, 6, 12, 0, 0).getTime();
let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else { console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`); fallos++; }
}

const base = { uid: 'u', name: 'X', email: 'x@y.z', createdAt: 0 };
const coach = (extra) => ({ ...base, role: 'trainer', founderNumber: 28, ...extra });
const atleta = (extra) => ({ ...base, role: 'athlete', founderNumber: 28, ...extra });

console.log('\nSin número, no hay insignia');
comprueba('cuenta sin número', estadoInsignia(coach({ founderNumber: undefined })).activa === false);
comprueba('sin perfil', estadoInsignia(null).activa === false);
comprueba(
  'un número cero no es un número',
  estadoInsignia(coach({ founderNumber: 0 })).numero === undefined
);

console.log('\nEl número NO se pierde nunca');
const caducado = estadoInsignia(
  atleta({ subscriptionUntil: AHORA - 30 * DIA, trialEndsAt: AHORA - 30 * DIA }),
  AHORA
);
comprueba('con la cuenta caducada la insignia se apaga', caducado.activa === false);
comprueba('pero el número sigue ahí', caducado.numero === 28, String(caducado.numero));

console.log('\nAtleta: paga o se apaga');
comprueba(
  'en prueba, encendida',
  estadoInsignia(atleta({ subscriptionUntil: AHORA + 10 * DIA, trialEndsAt: AHORA + 10 * DIA }), AHORA)
    .activa === true
);
comprueba(
  'con el plan al día, encendida',
  estadoInsignia(atleta({ subscriptionUntil: AHORA + 200 * DIA, trialEndsAt: AHORA - 5 * DIA }), AHORA)
    .activa === true
);
comprueba(
  'al expirar sin pagar, apagada',
  estadoInsignia(atleta({ subscriptionUntil: AHORA - DIA, trialEndsAt: AHORA - DIA }), AHORA)
    .activa === false
);

console.log('\nEntrenador: le vale con tener cuenta, aunque sea gratis');
comprueba(
  'caducado pero con 3 alumnos (le sobran las 5 plazas): encendida',
  estadoInsignia(coach({ subscriptionUntil: AHORA - 60 * DIA, clientCount: 3 }), AHORA).activa === true
);
comprueba(
  'justo en el límite de plazas: encendida',
  estadoInsignia(coach({ subscriptionUntil: AHORA - 60 * DIA, clientCount: 5 }), AHORA).activa === true
);
comprueba(
  'caducado y por encima de sus plazas: apagada',
  estadoInsignia(coach({ subscriptionUntil: AHORA - 60 * DIA, clientCount: 6 }), AHORA).activa === false
);
comprueba(
  'con muchos alumnos pero el plan al día: encendida',
  estadoInsignia(coach({ subscriptionUntil: AHORA + 100 * DIA, clientCount: 40 }), AHORA).activa === true
);
comprueba(
  'plazas recortadas a cero (tarjeta ya usada) y caducado: apagada',
  estadoInsignia(
    coach({ subscriptionUntil: AHORA - DIA, clientCount: 1, clientSlots: 0 }),
    AHORA
  ).activa === false
);

console.log('\nCuentas que no pagan plataforma');
comprueba(
  'el alumno de un coach nunca la pierde',
  estadoInsignia({ ...base, role: 'client', founderNumber: 3, subscriptionUntil: AHORA - 99 * DIA }, AHORA)
    .activa === true
);
comprueba(
  'las cuentas antiguas (sin fecha) tampoco',
  estadoInsignia(coach({ subscriptionUntil: undefined, clientCount: 99 }), AHORA).activa === true
);
comprueba(
  'el admin tampoco',
  estadoInsignia(
    { ...base, role: 'trainer', email: 'luisetenete07@gmail.com', founderNumber: 1, subscriptionUntil: AHORA - 99 * DIA, clientCount: 99 },
    AHORA
  ).activa === true
);

console.log(`\nEl aviso, ${AVISO_DIAS} días antes`);
const enAviso = estadoInsignia(
  atleta({ subscriptionUntil: AHORA + 3 * DIA, trialEndsAt: AHORA + 3 * DIA }),
  AHORA
);
comprueba('a 3 días avisa', enAviso.diasParaApagarse === 3, String(enAviso.diasParaApagarse));
comprueba(
  'a 6 días todavía no',
  estadoInsignia(atleta({ subscriptionUntil: AHORA + 6 * DIA }), AHORA).diasParaApagarse === null
);
comprueba(
  'justo en el límite del aviso, sí',
  estadoInsignia(atleta({ subscriptionUntil: AHORA + AVISO_DIAS * DIA }), AHORA).diasParaApagarse ===
    AVISO_DIAS
);
comprueba(
  'ya apagada no cuenta atrás',
  estadoInsignia(atleta({ subscriptionUntil: AHORA - DIA }), AHORA).diasParaApagarse === null
);

console.log('\nY al coach no se le mete prisa con algo que no le va a pasar');
comprueba(
  'coach a 2 días de caducar pero con plazas de sobra: sin cuenta atrás',
  estadoInsignia(coach({ subscriptionUntil: AHORA + 2 * DIA, clientCount: 2 }), AHORA)
    .diasParaApagarse === null
);
comprueba(
  'coach a 2 días de caducar y con 20 alumnos: sí avisa',
  estadoInsignia(coach({ subscriptionUntil: AHORA + 2 * DIA, clientCount: 20 }), AHORA)
    .diasParaApagarse === 2
);

// Lo que de verdad hay que proteger no es cada caso suelto, sino que la
// insignia y la puerta de la app digan siempre lo mismo. Si algún día alguien
// cambia una y no la otra, se vería aquí: habría gente dentro de la app con la
// insignia apagada, o gente en el muro de pago con la insignia en oro.
console.log('\nLa insignia y la puerta, siempre de acuerdo');
{
  const roles = ['trainer', 'athlete', 'client'];
  const fechas = [undefined, AHORA - 99 * DIA, AHORA - DIA, AHORA + DIA, AHORA + 99 * DIA];
  const alumnos = [0, 3, 5, 6, 40];
  const plazas = [undefined, 0, 5];
  const correos = ['x@y.z', 'luisetenete07@gmail.com'];
  let casos = 0;
  let discrepancias = 0;
  for (const role of roles)
    for (const subscriptionUntil of fechas)
      for (const clientCount of alumnos)
        for (const clientSlots of plazas)
          for (const email of correos) {
            const p = { ...base, email, role, founderNumber: 9, subscriptionUntil, clientCount, clientSlots };
            casos++;
            if (estadoInsignia(p, AHORA).activa !== hasPlatformAccess(p, AHORA)) {
              discrepancias++;
              if (discrepancias === 1) console.log('   primer caso:', JSON.stringify(p));
            }
          }
  comprueba(`${casos} combinaciones, ninguna discrepancia`, discrepancias === 0, `${discrepancias} discrepancias`);
}

console.log('\nEl número, escrito');
comprueba('cuatro cifras', numeroFundador(28) === '#0028');
comprueba('y no se recorta', numeroFundador(12345) === '#12345');

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
