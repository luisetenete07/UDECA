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
  descansoTrasRonda,
  enLaRonda,
  rondasDe,
  serieSuelta,
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

console.log('\nSeries desiguales (2 de A, 3 de B)');
{
  const planDesigual = [{ restSeconds: 60 }, { supersetWithPrevious: true, restSeconds: 45 }];
  const b = { inicio: 0, fin: 1 };
  const log = [series(true, true), series(true, true, false)];
  ok('la 3.ª de B es una serie suelta', serieSuelta(log, b, 2) === 1);
  ok('las dos primeras, no', serieSuelta(log, b, 0) === null && serieSuelta(log, b, 1) === null);
  ok('en la 3.ª ronda solo está B', igual(enLaRonda(log, b, 2), [1]));
  const r = trasMarcarSerie(log, planDesigual, 1, 1);
  ok('tras la 2.ª ronda, descanso y luego B sola', r.tipo === 'descansar' && igual(r.siguiente, { ejercicio: 1, serie: 2 }));
  ok('el descanso de una ronda entera, el de la superserie', descansoTrasRonda(planDesigual, log, b, 1) === 45);
  const conB = [series(true, true), series(true, true, true)];
  ok('el de la serie suelta, el del propio ejercicio', descansoTrasRonda(planDesigual, conB, b, 2) === 45);
  const planB = [{ restSeconds: 60 }, { supersetWithPrevious: true }];
  ok('y si no tiene, el de la superserie', descansoTrasRonda(planB, conB, b, 2) === 60);
  // Con B saltado no es "suelta": B no ha terminado, se ha quedado fuera.
  const saltado = [series(true, false), { saltado: true, sets: [{}, {}] }];
  ok('con el otro saltado, no se llama suelta', serieSuelta(saltado, b, 1) === null);
}

console.log('\nEn la pantalla del entreno');
{
  const w = readFileSync('app/(client)/workout.tsx', 'utf8');
  ok('la superserie se pinta entera, en su tarjeta', /if \(esSuperserie\(bloqueVisible\)\) return tarjetaDeSuperserie\(bloqueVisible\);/.test(w));
  ok('lo que toca después lo decide trasMarcarSerie', /const despues = trasMarcarSerie\(conLaMarca, plan, exerciseIndex, setIndex\);/.test(w));
  {
    // Sin descanso entre los de la ronda. La única pausa posible es la que el
    // entrenador ponga para cambiar de ejercicio al fusionar rutinas
    // (lib/combinarRutinas.ts), y solo si la puso.
    const m = /if \(despues\.tipo === 'encadenar'\) \{([\s\S]{0,900}?)\} else \{\s*const rest = descansoTrasRonda/.exec(w);
    const rama = m?.[1] ?? '';
    const pausas = rama.match(/startRest\(/g) ?? [];
    ok(
      'encadenada: sin descanso (salvo la transición que ponga el entrenador)',
      !!m && (pausas.length === 0 || (pausas.length === 1 && /if \(transicion > 0\) \{\s*startRest\(transicion,/.test(rama)))
    );
  }
  ok('desplegada solo la ronda que toca, entera', /\{ronda\(actual, true\)\}/.test(w));
  ok('el paso que toca se enciende', />AHORA<\/Text>/.test(w));
  ok('entre paso y paso, "sin descanso"; al final, el descanso', /'sin descanso'/.test(w) && /Luego, descanso de \$\{/.test(w));
  ok('lo hecho y lo que queda, en una línea al pie', /rondas hechas`/.test(w) && /Quedan \$\{quedan\} rondas más/.test(w));
  ok('el esfuerzo se pregunta en la última ronda', /\(hecho \|\| actual === ultimaRonda\)/.test(w));
  ok('y sin contestarlo no se pasa solo al siguiente', /!faltaEsfuerzo\(conLaMarca, bloque\)/.test(w));
  ok('Siguiente salta la superserie entera', /setViewIndex\(Math\.min\(log\.length - 1, bloqueVisible\.fin \+ 1\)\)/.test(w));
  ok('y antes de empezar ya se ve como bloque', /Superserie · sin descanso entre ellos/.test(w));
  ok('la serie suelta se avisa en la tarjeta', /Esta va sola: \$\{terminaron\} ya ha hecho sus series\./.test(w));
  ok('y antes de empezar', /la última de \$\{quien\} va sola/.test(w));
  ok('su descanso es el suyo', /descansoTrasRonda\(plan, conLaMarca, bloque, setIndex\)/.test(w));
}

console.log(fallos === 0 ? '\n✔ La superserie se hace como se entrena: A, B y descanso' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
