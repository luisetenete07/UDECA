/*
 * Comprobación de lib/fechas.ts y lib/duracion.ts.
 *
 * Estas funciones estaban copiadas por media app y ahora hay una sola de cada.
 * Eso las hace mucho más fáciles de arreglar y también mucho más caras de
 * romper: un fallo aquí ya no afecta a una pantalla, afecta a todas. De ahí
 * que tengan comprobaciones propias.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-fechas.mjs
 */
import {
  diaLargo,
  diaMes,
  esHoy,
  esMismoDia,
  fechaCorta,
  inicioDeLaSemana,
  inicioDelDia,
  mayusculaInicial,
  mesLargo,
} from '../lib/fechas.ts';
import { minutosSegundos, segundosDeTexto } from '../lib/duracion.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nEl día es el del calendario del usuario, no el de UTC');
{
  // Las 23:50 y las 00:10 del día siguiente son días DISTINTOS aunque solo
  // pasen veinte minutos. Es el fallo que hacía que un entreno nocturno
  // contara como el del día siguiente.
  const noche = new Date(2026, 7, 6, 23, 50).getTime();
  const madrugada = new Date(2026, 7, 7, 0, 10).getTime();
  comprueba('23:50 y 00:10 no son el mismo día', !esMismoDia(noche, madrugada));
  comprueba(
    'las 00:00 y las 23:59 del mismo día, sí',
    esMismoDia(new Date(2026, 7, 6, 0, 0).getTime(), new Date(2026, 7, 6, 23, 59, 59).getTime())
  );
  const inicio = inicioDelDia(noche);
  const d = new Date(inicio);
  comprueba(
    'inicioDelDia deja las 00:00 locales',
    d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0
  );
  comprueba('y no cambia de día', d.getDate() === 6 && d.getMonth() === 7);
  comprueba('aplicarlo dos veces da lo mismo', inicioDelDia(inicio) === inicio);
  comprueba('esHoy(ahora) es cierto', esHoy(Date.now()));
  comprueba('y ayer no es hoy', !esHoy(Date.now() - 24 * 60 * 60 * 1000));
}

console.log('\nLa semana empieza en lunes, también el domingo');
{
  // El domingo es el caso que se equivocaba siempre: getDay() lo llama 0, así
  // que "retroceder getDay()-1 días" lo mandaba al lunes SIGUIENTE.
  const dias = [
    [new Date(2026, 7, 3), 'lunes'],
    [new Date(2026, 7, 5), 'miércoles'],
    [new Date(2026, 7, 9), 'domingo'],
  ];
  for (const [fecha, nombre] of dias) {
    const lunes = new Date(inicioDeLaSemana(fecha.getTime()));
    comprueba(
      `${nombre} 2026-08-${String(fecha.getDate()).padStart(2, '0')} -> lunes 3`,
      lunes.getDate() === 3 && lunes.getMonth() === 7 && lunes.getHours() === 0,
      lunes.toString()
    );
  }
  comprueba(
    'el lunes siguiente ya es otra semana',
    new Date(inicioDeLaSemana(new Date(2026, 7, 10).getTime())).getDate() === 10
  );
}

console.log('\nEn español solo va en mayúscula la primera letra');
{
  const agosto = new Date(2026, 7, 5, 12).getTime();
  comprueba('mesLargo', mesLargo(agosto) === 'Agosto de 2026', mesLargo(agosto));
  const dia = diaLargo(agosto);
  comprueba('diaLargo empieza en mayúscula', dia[0] === dia[0].toUpperCase(), dia);
  comprueba('y el resto no se toca', !/ De | Agosto/.test(dia), dia);
  comprueba('mayusculaInicial con texto vacío no rompe', mayusculaInicial('') === '');
  comprueba('fechaCorta lleva año', /2026/.test(fechaCorta(agosto)), fechaCorta(agosto));
  comprueba('diaMes no lo lleva', !/2026/.test(diaMes(agosto)), diaMes(agosto));
}

console.log('\nEl descanso se escribe en minutos y se lee en mm:ss');
{
  comprueba('"2" son dos minutos', segundosDeTexto('2') === 120);
  comprueba('"1.5" son 90 s', segundosDeTexto('1.5') === 90);
  comprueba('"1,5" también (coma española)', segundosDeTexto('1,5') === 90);
  comprueba('"1:30" también', segundosDeTexto('1:30') === 90);
  comprueba('"0:45" son 45 s', segundosDeTexto('0:45') === 45);
  comprueba('vacío es cero', segundosDeTexto('   ') === 0);
  comprueba('texto que no es un número, cero (no NaN)', segundosDeTexto('AMRAP') === 0);
  comprueba('negativo, cero', segundosDeTexto('-3') === 0);

  comprueba('90 s se leen "1:30"', minutosSegundos(90) === '1:30');
  comprueba('210 s se leen "3:30"', minutosSegundos(210) === '3:30');
  comprueba('los segundos van con dos cifras', minutosSegundos(65) === '1:05');
  comprueba('en un campo, el cero se ve vacío', minutosSegundos(0) === '');
  comprueba('sin valor, igual', minutosSegundos(undefined) === '');
  comprueba('en una etiqueta, el cero se ve', minutosSegundos(0, false) === '0:00');

  // Lo que se escribe y se vuelve a leer tiene que dar lo mismo: el coach pone
  // el descanso, se guarda en segundos y el alumno lo ve en su pantalla.
  const ida = ['0:30', '1:30', '2:00', '3:45', '10:05'];
  comprueba(
    'ida y vuelta sin perder nada',
    ida.every((t) => minutosSegundos(segundosDeTexto(t)) === t.replace(/^0(\d):/, '$1:')),
    ida.map((t) => `${t}->${minutosSegundos(segundosDeTexto(t))}`).join(' ')
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
