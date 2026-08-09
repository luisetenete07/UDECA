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
  diasEntre,
  inicioDeLaSemana,
  inicioDelDia,
  inicioDelMes,
  masDias,
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

console.log('\nSumar días y contarlos: por calendario, no por milisegundos');
{
  // Sumar 86.400.000 ms falla el día que cambia la hora: ese día dura 23 o 25
  // horas y "mañana" cae a las 23:00 de hoy o a la 1:00 de pasado. Estas dos
  // funciones son la razón de que el ciclo de días sueltos no se descoloque
  // en primavera.
  const jueves = new Date(2026, 7, 6, 9, 30).getTime();
  comprueba('mañana es el 7', new Date(masDias(jueves, 1)).getDate() === 7);
  comprueba('ayer es el 5', new Date(masDias(jueves, -1)).getDate() === 5);
  comprueba('y siempre a las 00:00', new Date(masDias(jueves, 1)).getHours() === 0);
  comprueba('sumar cero es el mismo día a las 00:00', masDias(jueves, 0) === inicioDelDia(jueves));

  // Marzo de 2026: el cambio de hora en España es el domingo 29.
  const antes = new Date(2026, 2, 28, 12, 0).getTime();
  const despues = masDias(antes, 2);
  comprueba('cruzando el cambio de hora, el 30', new Date(despues).getDate() === 30);
  comprueba('y sigue siendo medianoche', new Date(despues).getHours() === 0);
  comprueba('dos días son dos días', diasEntre(antes, despues) === 2);
  comprueba(
    'la semana del cambio de hora mide 7 días, no 6',
    diasEntre(new Date(2026, 2, 23).getTime(), new Date(2026, 2, 30).getTime()) === 7
  );
  comprueba('hacia atrás cuenta negativo', diasEntre(despues, antes) === -2);
  comprueba('el mismo día son cero', diasEntre(antes, antes) === 0);
  comprueba('la hora no cuenta', diasEntre(new Date(2026, 7, 6, 23, 59), new Date(2026, 7, 7, 0, 1)) === 1);
}

console.log('\nLa semana empieza en lunes, también el domingo');
{
  // El fallo clásico: `getDay()` devuelve 0 para el domingo, así que hay que
  // retroceder SEIS días, no uno. Había cinco copias de esta función por la
  // app; ahora hay una, y este es el caso que las cinco podían fallar.
  const lunes = new Date(2026, 7, 3).getTime();
  for (let i = 0; i < 7; i++) {
    const dia = masDias(lunes, i);
    comprueba(
      `el día +${i} pertenece a la semana del lunes 3`,
      inicioDeLaSemana(dia) === lunes,
      new Date(inicioDeLaSemana(dia)).toDateString()
    );
  }
  comprueba(
    'el lunes siguiente ya es otra semana',
    inicioDeLaSemana(masDias(lunes, 7)) === masDias(lunes, 7)
  );
  comprueba('a media tarde del domingo sigue siendo esa semana',
    inicioDeLaSemana(new Date(2026, 7, 9, 18, 45).getTime()) === lunes);
}

console.log('\nEl mes natural');
{
  const ts = new Date(2026, 7, 17, 13, 20).getTime();
  const uno = new Date(inicioDelMes(ts));
  comprueba('cae en el día 1', uno.getDate() === 1);
  comprueba('del mismo mes', uno.getMonth() === 7);
  comprueba('a las 00:00', uno.getHours() === 0);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
