/**
 * La superserie, ronda a ronda (lib/superserie.ts y app/(client)/workout.tsx).
 *
 * Lo que se protege: que al marcar la serie de A aparezca YA la de B, sin
 * descanso; que el descanso llegue solo al cerrar la ronda; y que el bloque
 * entero se vea junto, en una tarjeta, con las dos series a la vista antes de
 * empezar.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-superserie.mjs
 */
import { readFileSync } from 'node:fs';
import {
  bloqueDe,
  descansoDelBloque,
  rondasDe,
  siguienteDelBloque,
  trasMarcarSerie,
} from '../lib/superserie.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const series = (...hechas) => ({ sets: hechas.map((completed) => ({ completed })) });

// Plan: 0 suelto · 1+2 superserie · 3 suelto · 4+5+6 triserie
const plan = [
  { restSeconds: 90 },
  { restSeconds: 60 },
  { supersetWithPrevious: true, restSeconds: 120 },
  { restSeconds: 90 },
  {},
  { supersetWithPrevious: true },
  { supersetWithPrevious: true },
];

console.log('\nLos bloques');
ok('un ejercicio suelto es su propio bloque', igual(bloqueDe(plan, 0), { inicio: 0, fin: 0 }));
ok('A y B de la superserie, el mismo bloque', igual(bloqueDe(plan, 1), bloqueDe(plan, 2)) && igual(bloqueDe(plan, 2), { inicio: 1, fin: 2 }));
ok('y la triserie, de tres', igual(bloqueDe(plan, 5), { inicio: 4, fin: 6 }));
ok('el primero de la sesión nunca va encadenado', igual(bloqueDe([{ supersetWithPrevious: true }, {}], 0), { inicio: 0, fin: 0 }));
ok('descanso de la ronda: el del último', descansoDelBloque(plan, { inicio: 1, fin: 2 }) === 120);
ok('si el último no lo dice, el mayor de los demás', descansoDelBloque([{ restSeconds: 75 }, { supersetWithPrevious: true }], { inicio: 0, fin: 1 }) === 75);

console.log('\nAl marcar una serie');
{
  // A1 recién marcada; B1 sin hacer.
  const log = [series(true, true), series(true, false, false), series(false, false, false)];
  const r = trasMarcarSerie(log, plan, 1, 0);
  ok('A1 hecha → B1 ya, sin descanso', r.tipo === 'encadenar' && igual(r.siguiente, { ejercicio: 2, serie: 0 }));
}
{
  const log = [series(true, true), series(true, false, false), series(true, false, false)];
  const r = trasMarcarSerie(log, plan, 2, 0);
  ok('B1 hecha → descanso, y después A2', r.tipo === 'descansar' && igual(r.siguiente, { ejercicio: 1, serie: 1 }) && !r.bloqueTerminado);
}
{
  // Fuera de orden: B1 antes que A1.
  const log = [series(true, true), series(false, false), series(true, false)];
  const r = trasMarcarSerie(log, plan, 2, 0);
  ok('B1 antes que A1 → A1 ya, sin descanso', r.tipo === 'encadenar' && igual(r.siguiente, { ejercicio: 1, serie: 0 }));
}
{
  // A tiene 3 series y B 2: la tercera ronda es solo de A.
  const log = [series(true, true), series(true, true, false), series(true, true)];
  ok('rondas: las del que más series lleva', rondasDe(log, { inicio: 1, fin: 2 }) === 3);
  const r = trasMarcarSerie(log, plan, 2, 1);
  ok('ronda 2 cerrada → descanso y A3 sola', r.tipo === 'descansar' && igual(r.siguiente, { ejercicio: 1, serie: 2 }));
}
{
  // Saltado B: A ya no espera a nadie.
  const log = [series(true, true), series(true, false), { saltado: true, sets: [{}, {}] }];
  const r = trasMarcarSerie(log, plan, 1, 0);
  ok('con B saltado, A descansa entre series', r.tipo === 'descansar' && igual(r.siguiente, { ejercicio: 1, serie: 1 }));
}
{
  // Superserie entera hecha → al siguiente ejercicio.
  const log = [series(true, true), series(true, true), series(true, true), series(false, false)];
  const r = trasMarcarSerie(log, plan, 2, 1);
  ok('bloque terminado → al siguiente ejercicio', r.tipo === 'descansar' && r.bloqueTerminado && igual(r.siguiente, { ejercicio: 3, serie: 0 }));
}
{
  // Ejercicio suelto: como siempre, descanso entre series.
  const log = [series(true, false), series(false), series(false)];
  const r = trasMarcarSerie(log, plan, 0, 0);
  ok('un ejercicio suelto descansa entre series', r.tipo === 'descansar' && igual(r.siguiente, { ejercicio: 0, serie: 1 }));
}
{
  // Triserie: A1 → B1 → C1.
  const log = [series(), series(), series(), series(), series(true, false), series(true, false), series(false, false)];
  const r = trasMarcarSerie(log, plan, 5, 0);
  ok('triserie: B1 hecha → C1 ya', r.tipo === 'encadenar' && igual(r.siguiente, { ejercicio: 6, serie: 0 }));
  ok('la siguiente del bloque va ronda a ronda', igual(siguienteDelBloque(log, { inicio: 4, fin: 6 }), { ejercicio: 6, serie: 0 }));
}

console.log('\nEn la pantalla del entreno');
{
  const w = readFileSync('app/(client)/workout.tsx', 'utf8');
  ok('la superserie se pinta entera, en su tarjeta', /if \(esSuperserie\(bloqueVisible\)\) return tarjetaDeSuperserie\(bloqueVisible\);/.test(w));
  ok('lo que toca después lo decide trasMarcarSerie', /const despues = trasMarcarSerie\(conLaMarca, plan, exerciseIndex, setIndex\);/.test(w));
  ok('encadenada: sin descanso', /if \(despues\.tipo === 'encadenar'\) \{[\s\S]{0,300}\} else \{\s*const rest = descansoDelBloque/.test(w));
  ok('desplegada solo la ronda que toca, entera', /\{ronda\(actual, true\)\}/.test(w));
  ok('el paso que toca se enciende', />AHORA<\/Text>/.test(w));
  ok('entre paso y paso, "sin descanso"; al final, el descanso', />sin descanso<\/Text>/.test(w) && /Luego, descanso de \$\{/.test(w));
  ok('lo hecho y lo que queda, en una línea al pie', /rondas hechas`/.test(w) && /Quedan \$\{quedan\} rondas más/.test(w));
  ok('el esfuerzo se pregunta en la última ronda', /\(hecho \|\| actual === ultimaRonda\)/.test(w));
  ok('y sin contestarlo no se pasa solo al siguiente', /!faltaEsfuerzo\(conLaMarca, bloque\)/.test(w));
  ok('Siguiente salta la superserie entera', /setViewIndex\(Math\.min\(log\.length - 1, bloqueVisible\.fin \+ 1\)\)/.test(w));
  ok('y antes de empezar ya se ve como bloque', /Superserie · sin descanso entre ellos/.test(w));
}

console.log(fallos === 0 ? '\n✔ La superserie se hace como se entrena: A, B y descanso' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
