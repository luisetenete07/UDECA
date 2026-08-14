/*
 * Contador de pasos (lib/pasos.ts).
 *
 * Lo que hay que proteger: que una lectura parcial del móvil no borre lo que
 * el usuario escribió a mano —que es el fallo que hace que la gente deje de
 * usar un contador— y que la semana cuente los días en blanco, porque una
 * semana perfecta hecha de tres días no es una semana perfecta.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-pasos.mjs
 */
import {
  balanceDelDia,
  caloriasDePasos,
  objetivoDeTexto,
  OBJETIVO_MAXIMO,
  OBJETIVO_MINIMO,
  mediaSemanal,
  OBJETIVO_POR_DEFECTO,
  pasosAGuardar,
  pasosDeHoy,
  progresoDePasos,
  textoDelBalance,
  textoDePasos,
  ultimosSieteDias,
} from '../lib/pasos.ts';
import { inicioDelDia, masDias } from '../lib/fechas.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nCómo va el día');
{
  const p = progresoDePasos(4000, 8000);
  comprueba('la mitad del objetivo', p.ratio === 0.5 && p.quedan === 4000);
  comprueba('no está cumplido', !p.cumplido);
  comprueba('con el objetivo, cumplido', progresoDePasos(8000, 8000).cumplido);
  // Pasarse no rompe la barra ni deja "quedan -2000".
  comprueba('pasarse no pasa del 100 %', progresoDePasos(20000, 8000).ratio === 1);
  comprueba('ni deja pasos negativos', progresoDePasos(20000, 8000).quedan === 0);
  comprueba('sin objetivo, el de por defecto', progresoDePasos(0).objetivo === OBJETIVO_POR_DEFECTO);
  comprueba('un objetivo de cero no divide entre cero', Number.isFinite(progresoDePasos(100, 0).ratio));
  comprueba('pasos negativos se quedan en cero', progresoDePasos(-500).pasos === 0);
}

console.log('\nLa semana, con sus días en blanco');
{
  const hoy = Date.now();
  const registros = [
    { date: masDias(hoy, -6), steps: 9000, source: 'telefono' },
    { date: masDias(hoy, -3), steps: 5000, source: 'mano' },
    { date: hoy, steps: 2000, source: 'telefono' },
  ];
  const semana = ultimosSieteDias(registros, hoy);
  comprueba('siete días', semana.length === 7);
  comprueba('el último es hoy', inicioDelDia(semana[6].date) === inicioDelDia(hoy));
  comprueba('en orden, del más viejo al más nuevo', semana[0].date < semana[6].date);
  comprueba('los días sin registro salen a cero', semana[1].steps === 0 && semana[2].steps === 0);
  comprueba('y los que hay, con su cifra', semana[0].steps === 9000 && semana[6].steps === 2000);
  // Contando los ceros: 16000/7 = 2286. Saltárselos daría 5333 y una semana
  // floja parecería buena.
  comprueba('la media cuenta los días en blanco', mediaSemanal(registros, hoy) === 2286, String(mediaSemanal(registros, hoy)));

  comprueba('encuentra los de hoy', pasosDeHoy(registros, hoy)?.steps === 2000);
  comprueba('sin registro de hoy, nada', pasosDeHoy([registros[0]], hoy) === null);
}

console.log('\nQué se guarda cuando llega una lectura del móvil');
{
  // iPhone: la lectura es la del día entero, así que manda.
  comprueba('en iPhone la lectura sustituye', pasosAGuardar({ date: 0, steps: 300, source: 'telefono' }, 9000, { acumulativo: false }) === 9000);
  comprueba('sin nada previo, se guarda tal cual', pasosAGuardar(null, 4000, { acumulativo: false }) === 4000);

  // Android: solo cuenta con la app abierta, así que se suma; si sustituyera,
  // abrir UDECA a las ocho de la tarde borraría el día entero.
  comprueba('en Android se suma a lo del día', pasosAGuardar({ date: 0, steps: 4000, source: 'telefono' }, 300, { acumulativo: true }) === 4300);

  // Y lo escrito a mano no lo pisa una lectura parcial: quien teclea los 12.000
  // de su reloj no puede verlos convertidos en 300.
  const aMano = { date: 0, steps: 12000, source: 'mano' };
  comprueba('lo escrito a mano no lo pisa una lectura menor', pasosAGuardar(aMano, 300, { acumulativo: false }) === 12000);
  comprueba('pero una lectura mayor sí manda', pasosAGuardar(aMano, 15000, { acumulativo: false }) === 15000);
  comprueba('una lectura negativa no resta', pasosAGuardar(null, -50, { acumulativo: false }) === 0);
}

console.log('\nLas calorías, que son una estimación');
{
  comprueba('10.000 pasos de una persona de 70 kg', caloriasDePasos(10000, 70) === 350, String(caloriasDePasos(10000, 70)));
  comprueba('pesando más, más', caloriasDePasos(10000, 90) > caloriasDePasos(10000, 70));
  // Sin peso no se inventa una cifra: se calla.
  comprueba('sin peso, nada', caloriasDePasos(10000) === 0);
  comprueba('sin pasos, nada', caloriasDePasos(0, 70) === 0);
}

console.log('\nLo que se le dice');
{
  comprueba('sin andar, dice el objetivo', /8.000 pasos/.test(textoDePasos(progresoDePasos(0, 8000))));
  comprueba('a medias, lo que queda', /4.000 pasos/.test(textoDePasos(progresoDePasos(4000, 8000))));
  comprueba('cumplido, lo dice y para', /cumplido/i.test(textoDePasos(progresoDePasos(8000, 8000))));
  comprueba('y no riñe por pasarse', !/demasiado|exceso/i.test(textoDePasos(progresoDePasos(30000, 8000))));
}

console.log('\nEl objetivo lo pone el entrenador');
{
  // Sin que nadie lo elija, 10.000. No es un detalle: es la cifra que ve todo
  // alumno cuyo coach aún no ha entrado en su ficha.
  comprueba('por omisión son 10.000', OBJETIVO_POR_DEFECTO === 10000, String(OBJETIVO_POR_DEFECTO));
  comprueba('se lee un número escrito a mano', objetivoDeTexto('12000') === 12000);
  comprueba('con puntos también', objetivoDeTexto('12.000') === 12000, String(objetivoDeTexto('12.000')));
  // Borrar el campo es quitar el objetivo. Devolver 10.000 sería no dejarle
  // deshacer lo que puso.
  comprueba('vacío no es 10.000, es nada', objetivoDeTexto('') === undefined);
  comprueba('ni letras', objetivoDeTexto('muchos') === undefined);
  comprueba('un disparate no entra', objetivoDeTexto('999999') === undefined);
  comprueba('ni una cifra ridícula', objetivoDeTexto('12') === undefined);
  comprueba('los topes sí', objetivoDeTexto(String(OBJETIVO_MINIMO)) === OBJETIVO_MINIMO
    && objetivoDeTexto(String(OBJETIVO_MAXIMO)) === OBJETIVO_MAXIMO);
}

console.log('\nEl presupuesto de calorías del día');
{
  // Los pasos SUMAN al presupuesto. Es la misma resta que descontarlos de lo
  // comido, pero al derecho: "hoy tienes 2.320" se entiende y "has comido
  // 1.450 menos 320" no.
  const b = balanceDelDia(2000, 1450, 320);
  comprueba('el presupuesto es el plan más lo andado', b.disponibles === 2320, String(b.disponibles));
  comprueba('quedan las que quedan', b.restantes === 870, String(b.restantes));
  comprueba('y no se ha pasado', b.pasado === false);

  // Enseñar un cero a quien se ha pasado 600 kcal es esconder justo el dato
  // por el que ha entrado en la pantalla.
  const p = balanceDelDia(2000, 2600, 0);
  comprueba('pasarse sale en negativo, no en cero', p.restantes === -600, String(p.restantes));
  comprueba('y se marca como pasado', p.pasado === true);

  comprueba('sin andar, el presupuesto es el del plan', balanceDelDia(2000, 0).disponibles === 2000);
  comprueba('nada negativo entra', balanceDelDia(-5, -5, -5).disponibles === 0);
  comprueba('sin plan no se inventa nada', balanceDelDia(0, 0, 0).disponibles === 0);
}

console.log('\nDe dónde sale el presupuesto');
{
  const conPasos = textoDelBalance(balanceDelDia(2000, 1450, 320));
  comprueba('dice lo comido y lo disponible', /1.450/.test(conPasos) && /2.320/.test(conPasos), conPasos);
  comprueba('y de dónde salen las de más', /por andar/.test(conPasos), conPasos);
  const sinPasos = textoDelBalance(balanceDelDia(2000, 1450, 0));
  comprueba('sin pasos no habla de andar', !/andar/.test(sinPasos), sinPasos);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
