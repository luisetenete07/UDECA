/*
 * Por dónde ibas, y por dónde sigue el ciclo (lib/ultimoEntreno.ts).
 *
 * POR QUÉ EXISTE
 *
 * Un plan por ciclos rueda con el calendario, no con lo que entrenas: si te
 * saltas dos días, el ciclo no te espera. Vuelves y estás en el Día 4 sin haber
 * hecho el 2 ni el 3. Lo único que había para arreglarlo era reiniciar el ciclo
 * entero y volver al Día 1, tirando lo que llevabas.
 *
 * Lo que se comprueba aquí es lo que hace falta para retomarlo bien: encontrar
 * el último entreno DE ESA rutina, saber a qué día del plan corresponde y
 * calcular el siguiente dando la vuelta al final del ciclo.
 *
 * Y sobre todo, lo que NO se puede hacer: ofrecer "sigue por el Día 1" a quien
 * no sabemos por dónde iba. Eso no es continuar, es reiniciar sin decirlo.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-ultimo-entreno.mjs
 */
import { haceCuanto, siguienteDelCiclo, ultimoEntrenoDe } from '../lib/ultimoEntreno.ts';
import { masDias } from '../lib/fechas.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés.
setIdioma('es');

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const AHORA = Date.now();

/** Un ciclo de cinco días con un descanso en medio. */
const ciclo = {
  id: 'r1',
  schedule: 'cycle',
  days: [
    { id: 'd1', name: 'Día 1' },
    { id: 'd2', name: 'Empuje' },
    { id: 'd3', name: 'Tirón' },
    { id: 'd4', name: 'Día 4', isRest: true },
    { id: 'd5', name: 'Piernas' },
  ],
};

const entreno = (nombre, hace, routineId = 'r1') => ({
  id: `l${nombre}${hace}`,
  routineId,
  routineName: 'Plan',
  dayName: nombre,
  date: masDias(AHORA, -hace),
});

console.log('\nCuál fue el último entreno');
{
  const logs = [entreno('Empuje', 6), entreno('Tirón', 2), entreno('Día 1', 9)];
  const u = ultimoEntrenoDe(logs, ciclo, AHORA);
  ok('encuentra el más reciente', u?.log.dayName === 'Tirón', u?.log.dayName);
  ok('y sabe qué día del plan era', u?.indice === 2, String(u?.indice));
  ok('con su nombre', u?.nombre === 'Tirón', u?.nombre);
  ok('y cuántos días hace', u?.hace === 2, String(u?.hace));
}

console.log('\nSolo cuenta el historial DE ESTA rutina');
{
  // Quien cambia de plan no quiere que le digan por dónde iba el anterior.
  const logs = [entreno('Otra cosa', 1, 'r2'), entreno('Empuje', 5)];
  const u = ultimoEntrenoDe(logs, ciclo, AHORA);
  ok('se ignora lo de otra rutina', u?.log.dayName === 'Empuje', u?.log.dayName);
  ok('sin nada de esta rutina, nada', ultimoEntrenoDe([entreno('X', 1, 'r2')], ciclo, AHORA) === null);
  ok('sin historial, nada', ultimoEntrenoDe([], ciclo, AHORA) === null);
  ok('sin rutina, nada', ultimoEntrenoDe(logs, null, AHORA) === null);
}

console.log('\nUn día que ya no está en el plan');
{
  /*
   * El entrenador puede haber renombrado o quitado ese día desde entonces. Se
   * enseña lo que dice el registro —es verdad: eso fue lo que entrenó— pero sin
   * inventarse una posición en el ciclo.
   */
  const u = ultimoEntrenoDe([entreno('Un día que ya no existe', 3)], ciclo, AHORA);
  ok('se sigue sabiendo qué entrenó', u?.nombre === 'Un día que ya no existe', u?.nombre);
  ok('pero no se le asigna un día del ciclo', u?.indice === null, String(u?.indice));
  ok('y por eso no se le ofrece continuar', siguienteDelCiclo(u, 5) === null);
}

console.log('\nPor dónde sigue el ciclo');
{
  const trasEmpuje = ultimoEntrenoDe([entreno('Empuje', 1)], ciclo, AHORA);
  ok('después del Día 2 va el 3', siguienteDelCiclo(trasEmpuje, 5) === 2);

  // Un ciclo es un círculo: después del último viene otra vez el primero.
  const trasUltimo = ultimoEntrenoDe([entreno('Piernas', 1)], ciclo, AHORA);
  ok('después del último se vuelve al primero', siguienteDelCiclo(trasUltimo, 5) === 0);

  // El siguiente puede ser descanso, y eso hay que poder decirlo antes de que
  // lo pulse: encontrarse una pantalla de descanso sin avisar desconcierta.
  const trasTiron = ultimoEntrenoDe([entreno('Tirón', 1)], ciclo, AHORA);
  const i = siguienteDelCiclo(trasTiron, 5);
  ok('el siguiente puede ser un descanso', i === 3 && ciclo.days[i].isRest === true);

  ok('sin último entreno no se ofrece nada', siguienteDelCiclo(null, 5) === null);
  ok('un ciclo sin días tampoco', siguienteDelCiclo(trasEmpuje, 0) === null);
}

console.log('\nCuánto hace, en palabras');
{
  // La fecha obligaría a hacer la cuenta, y la cuenta es justo el dato.
  ok('hoy', haceCuanto(0) === 'hoy', haceCuanto(0));
  ok('ayer', haceCuanto(1) === 'ayer', haceCuanto(1));
  ok('y a partir de ahí, los días', haceCuanto(6) === 'hace 6 días', haceCuanto(6));
  ok('nada negativo se cuela', haceCuanto(-3) === 'hoy', haceCuanto(-3));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
