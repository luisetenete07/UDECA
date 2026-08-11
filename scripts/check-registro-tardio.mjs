/*
 * Registrar un entreno días después (lib/registroTardio.ts).
 *
 * Lo que hay que proteger: que no se pueda registrar un entreno del futuro
 * (sería inflar la racha sin entrenar) y que la hora que se le pone no lo
 * deje caer en el día de al lado, que es donde se estropea el histórico.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-registro-tardio.mjs
 */
import {
  conUnaSerieMas,
  conUnaSerieMenos,
  diaValido,
  diasParaElegir,
  entrenosDelDia,
  fechaDelRegistro,
  hayAlgoQueGuardar,
  logDelDia,
  minutosDeTexto,
} from '../lib/registroTardio.ts';
import { esMismoDia, inicioDelDia, masDias } from '../lib/fechas.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nQué días se pueden elegir');
{
  const dias = diasParaElegir(Date.now(), 14);
  comprueba('salen catorce', dias.length === 14);
  comprueba('el primero es hoy', esMismoDia(dias[0], Date.now()));
  comprueba('van hacia atrás', dias[1] < dias[0] && dias[13] < dias[12]);
  comprueba('todos a las 00:00', dias.every((d) => inicioDelDia(d) === d));

  comprueba('hoy vale', diaValido(Date.now()));
  comprueba('ayer vale', diaValido(masDias(Date.now(), -1)));
  // Un entreno de mañana no se ha hecho: dejarlo sería racha regalada.
  comprueba('mañana NO vale', !diaValido(masDias(Date.now(), 1)));
  comprueba('hace un mes tampoco', !diaValido(masDias(Date.now(), -30)));
}

console.log('\nCon qué hora se guarda');
{
  const ahora = Date.now();
  comprueba('si es de hoy, la de ahora', fechaDelRegistro(inicioDelDia(ahora), ahora) === ahora);

  // El mediodía y no las 00:00: a medianoche, cualquier desfase lo empuja al
  // día anterior y el entreno sale en el día equivocado.
  const ayer = masDias(ahora, -1);
  const guardado = fechaDelRegistro(ayer, ahora);
  comprueba('si es de otro día, cae ese día', esMismoDia(guardado, ayer));
  comprueba('y no en la frontera', new Date(guardado).getHours() === 12);
  comprueba('anteayer también', esMismoDia(fechaDelRegistro(masDias(ahora, -2), ahora), masDias(ahora, -2)));
}

console.log('\nEl entreno de partida');
{
  const dia = {
    id: 'd',
    name: 'Empuje',
    exercises: [
      { id: 'x1', exerciseId: 'e1', name: 'Flexiones', sets: 3, reps: '12', measure: 'reps' },
      { id: 'x2', exerciseId: 'e2', name: 'Fondos', sets: 2, reps: '8-12', measure: 'reps' },
    ],
  };
  const log = logDelDia(dia);
  comprueba('trae los ejercicios del plan', log.length === 2);
  comprueba('con sus series', log[0].sets.length === 3 && log[1].sets.length === 2);
  // Se está registrando algo YA hecho: empezar con todo sin marcar obligaría a
  // tocar cada serie solo para volver al punto de partida.
  comprueba('todas marcadas como hechas', log.every((e) => e.sets.every((s) => s.completed)));
  comprueba('un número exacto se precarga', log[0].sets[0].reps === '12');
  comprueba('un rango se deja en blanco', log[1].sets[0].reps === '');
  comprueba('sin día, no hay nada', logDelDia(null).length === 0);

  const mas = conUnaSerieMas(log, 0);
  comprueba('se puede añadir una serie', mas[0].sets.length === 4);
  comprueba('y llega marcada', mas[0].sets[3].completed === true);
  comprueba('sin tocar el otro ejercicio', mas[1].sets.length === 2);

  const menos = conUnaSerieMenos(mas, 0);
  comprueba('y quitarla', menos[0].sets.length === 3);
  const soloUna = conUnaSerieMenos([{ exerciseId: 'e', name: 'x', sets: [{ reps: '', weight: '', completed: true }] }], 0);
  comprueba('quitar la única deja el ejercicio fuera', soloUna.length === 0);
  comprueba('quitar de un índice que no existe no rompe', conUnaSerieMenos(log, 9).length === 2);
}

console.log('\nCuándo se puede guardar');
{
  // Basta con una serie: quien registra un entreno de hace tres días se acuerda
  // de que hizo cuatro series mucho mejor que de las repeticiones de la tercera.
  const conSeries = [{ exerciseId: 'e', name: 'x', sets: [{ reps: '', weight: '', completed: true }] }];
  comprueba('con una serie, aunque esté sin marca, sí', hayAlgoQueGuardar(conSeries));
  comprueba('sin ejercicios, no', !hayAlgoQueGuardar([]));
  comprueba('con un ejercicio sin series, no', !hayAlgoQueGuardar([{ exerciseId: 'e', name: 'x', sets: [] }]));
}

console.log('\nLa duración escrita a mano');
{
  comprueba('45 minutos', minutosDeTexto('45') === 45);
  comprueba('vacío, nada', minutosDeTexto('') === undefined);
  comprueba('texto, nada', minutosDeTexto('un rato') === undefined);
  comprueba('cero, nada', minutosDeTexto('0') === undefined);
  comprueba('negativo, nada', minutosDeTexto('-30') === undefined);
  comprueba('un dedo de más se recorta', minutosDeTexto('99999') === 720);
}

console.log('\nAvisar de que ya hay un entreno ese día');
{
  const ayer = masDias(Date.now(), -1);
  const logs = [
    { id: 'a', date: ayer + 1000, exercises: [] },
    { id: 'b', date: Date.now(), exercises: [] },
  ];
  comprueba('encuentra el de ayer', entrenosDelDia(logs, ayer).length === 1);
  comprueba('y el de hoy', entrenosDelDia(logs, Date.now())[0].id === 'b');
  comprueba('un día sin nada, ninguno', entrenosDelDia(logs, masDias(Date.now(), -5)).length === 0);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
