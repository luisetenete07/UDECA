/**
 * Quién lleva días sin entrenar (lib/sinEntrenar.ts), en el panel del coach.
 *
 * Lo que se protege: que la lista diga a quién escribir y a nadie más. Un
 * alumno de baja acordada o con la app en pausa no es un aviso, es ruido, y una
 * lista con ruido se deja de mirar.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-sin-entrenar.mjs
 */
import { readFileSync } from 'node:fs';
import { alumnosSinEntrenar, DIAS_SIN_ENTRENAR } from '../lib/sinEntrenar.ts';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date(2026, 9, 10, 12, 0, 0).getTime();

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

const alumno = (uid, extra = {}) => ({
  uid,
  role: 'client',
  name: `Alumno ${uid}`,
  email: `${uid}@demo.test`,
  trainerId: 'coach1',
  createdAt: AHORA - 90 * DIA,
  ...extra,
});
const entreno = (clientId, haceDias) => ({ id: `${clientId}-${haceDias}`, clientId, trainerId: 'coach1', date: AHORA - haceDias * DIA, exercises: [] });
const uids = (lista) => lista.map((x) => x.alumno.uid).join(',');

console.log('\nA partir de ' + DIAS_SIN_ENTRENAR + ' días');
{
  const r = alumnosSinEntrenar(
    [alumno('a'), alumno('b'), alumno('c')],
    [entreno('a', 1), entreno('b', DIAS_SIN_ENTRENAR - 1), entreno('c', DIAS_SIN_ENTRENAR), entreno('c', 20)],
    AHORA
  );
  ok('quien entrenó ayer no sale', !uids(r).includes('a'));
  ok('ni quien está a un día del límite', !uids(r).includes('b'));
  ok('el que llega al límite, sí', uids(r) === 'c', uids(r));
  ok('y cuenta desde su ÚLTIMO entreno, no el primero', r[0]?.dias === DIAS_SIN_ENTRENAR, String(r[0]?.dias));
}

console.log('\nNo avisa de lo que ya se sabe');
{
  const enPausa = alumno('p', { planPauses: [{ desde: AHORA - 10 * DIA, hasta: AHORA + 5 * DIA }] });
  const sinPeriodo = alumno('q', { nextPaymentDate: AHORA - 30 * DIA });
  const r = alumnosSinEntrenar([enPausa, sinPeriodo], [entreno('p', 12), entreno('q', 12)], AHORA);
  ok('con el plan en pausa, no sale', !uids(r).includes('p'), uids(r));
  ok('con la app en pausa (periodo acabado), tampoco', !uids(r).includes('q'), uids(r));
}

console.log('\nLos que aún no han empezado');
{
  const nuevo = alumno('n', { createdAt: AHORA - 2 * DIA });
  const parado = alumno('v', { createdAt: AHORA - 20 * DIA });
  const r = alumnosSinEntrenar([nuevo, parado, alumno('x')], [entreno('x', 9)], AHORA);
  ok('recién llegado, aún no', !uids(r).includes('n'));
  ok('llegó hace semanas y nada: sale, sin días', r.find((x) => x.alumno.uid === 'v')?.dias === null);
  ok('y va al final de la lista', uids(r) === 'x,v', uids(r));
}

console.log('\nEl panel lo enseña');
{
  const panel = readFileSync('app/(trainer)/dashboard.tsx', 'utf8');
  ok('en "Necesita tu atención"', /sinEntrenar\.length > 0 \? \(/.test(panel) && /alumnosSinEntrenar\(clients, logs, now\)/.test(panel));
  ok('y cada uno lleva a su ficha', /setSinEntrenarOpen\(false\);\s*router\.push\(`\/\(trainer\)\/clients\/\$\{alumno\.uid\}`\)/.test(panel));
}

console.log(fallos === 0 ? '\n✔ La lista de sin entrenar dice a quién escribir' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
