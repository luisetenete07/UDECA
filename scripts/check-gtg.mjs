/*
 * Grease the groove (lib/gtg.ts).
 *
 * Lo que hay que proteger aquí es que un día de ocho series sueltas siga
 * siendo UN entreno. Si cada serie fuera un registro, la racha contaría ocho,
 * el histórico tendría ocho filas por día y el volumen semanal no habría quien
 * lo leyera. Y que el texto no felicite por pasarse: en este método pasarse es
 * el error más común y el que estanca.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-gtg.mjs
 */
import {
  conSerieAnadida,
  entrenoDeHoy,
  esGtg,
  objetivoDelDia,
  progresoGtg,
  SERIES_POR_DEFECTO,
  seriesDeHoy,
  sinLaUltimaSerie,
  textoDelDia,
} from '../lib/gtg.ts';
import { currentStreak } from '../lib/stats.ts';
import { masDias } from '../lib/fechas.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés:
// sin fijarlo estas comprobaciones leerían el texto en inglés y el resultado
// dependería de dónde se ejecuten.
setIdioma('es');


let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const rutina = (extra = {}) => ({
  id: 'r',
  trainerId: 't',
  clientId: 'c',
  name: 'Dominadas todo el día',
  active: true,
  schedule: 'gtg',
  days: [{ id: 'd', name: 'GtG', exercises: [] }],
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});
const serie = (hecha = true) => ({ reps: '5', weight: '', completed: hecha });
const log = (n, extra = {}) => ({
  id: 'l',
  trainerId: 't',
  clientId: 'c',
  routineId: 'r',
  routineName: 'x',
  dayName: 'GtG',
  date: Date.now(),
  exercises: [{ exerciseId: 'e1', name: 'Dominadas', sets: Array.from({ length: n }, () => serie()) }],
  createdAt: 0,
  ...extra,
});

console.log('\nCuántas series se buscan');
{
  comprueba('una rutina normal no es gtg', !esGtg(rutina({ schedule: 'weekly' })));
  comprueba('sin rutina tampoco', !esGtg(null));
  comprueba('sin decir cuántas, las de por defecto', objetivoDelDia(rutina()) === SERIES_POR_DEFECTO);
  comprueba('las que diga el entrenador', objetivoDelDia(rutina({ gtgSetsPerDay: 10 })) === 10);
  comprueba('cero no vale: al menos una', objetivoDelDia(rutina({ gtgSetsPerDay: 0 })) === 1);
  comprueba('una rutina que no es gtg no tiene objetivo', objetivoDelDia(rutina({ schedule: 'cycle' })) === 0);
}

console.log('\nTodo el día va a UN solo entreno');
{
  const hoy = log(3);
  const ayer = { ...log(5), id: 'ayer', date: Date.now() - 26 * 60 * 60 * 1000 };
  comprueba('encuentra el de hoy', entrenoDeHoy([ayer, hoy], 'r')?.id === 'l');
  comprueba('y no el de ayer', entrenoDeHoy([ayer], 'r') === null);
  comprueba('ni el de otra rutina', entrenoDeHoy([{ ...hoy, routineId: 'otra' }], 'r') === null);
  comprueba('cuenta las series del día', seriesDeHoy(hoy) === 3);
  comprueba('sin entreno, cero', seriesDeHoy(null) === 0);
  comprueba(
    'las series sin marcar no cuentan',
    seriesDeHoy({ ...hoy, exercises: [{ exerciseId: 'e1', name: 'x', sets: [serie(false), serie(true)] }] }) === 1
  );
}

console.log('\nCómo va el día');
{
  const p = progresoGtg(rutina({ gtgSetsPerDay: 8 }), log(3));
  comprueba('tres de ocho', p.hechas === 3 && p.objetivo === 8);
  comprueba('quedan cinco', p.quedan === 5);
  comprueba('no está completo', !p.completo);
  comprueba('el avance es 3/8', Math.abs(p.ratio - 3 / 8) < 0.001);

  const lleno = progresoGtg(rutina({ gtgSetsPerDay: 8 }), log(8));
  comprueba('con ocho, completo', lleno.completo && lleno.quedan === 0);

  // Pasarse no rompe la barra ni deja "quedan -2".
  const pasado = progresoGtg(rutina({ gtgSetsPerDay: 8 }), log(10));
  comprueba('pasarse no pasa del 100 %', pasado.ratio === 1);
  comprueba('ni deja series negativas', pasado.quedan === 0);
  comprueba('sin entreno todavía, cero de ocho', progresoGtg(rutina({ gtgSetsPerDay: 8 }), null).hechas === 0);
}

console.log('\nAñadir y deshacer series');
{
  const ej = { exerciseId: 'e1', name: 'Dominadas', measure: 'reps' };
  const uno = conSerieAnadida([], ej, '5');
  comprueba('la primera crea el ejercicio', uno.length === 1 && uno[0].sets.length === 1);
  comprueba('y la serie queda marcada como hecha', uno[0].sets[0].completed === true);
  comprueba('con su marca', uno[0].sets[0].reps === '5');

  const dos = conSerieAnadida(uno, ej, '5');
  comprueba('la segunda NO crea otro ejercicio', dos.length === 1, String(dos.length));
  comprueba('se le suma al que ya estaba', dos[0].sets.length === 2);

  const otro = conSerieAnadida(dos, { exerciseId: 'e2', name: 'Fondos' }, '8');
  comprueba('otro ejercicio sí entra aparte', otro.length === 2);
  comprueba('y el primero se queda como estaba', otro[0].sets.length === 2);

  comprueba('con peso, se guarda', conSerieAnadida([], ej, '5', '10')[0].sets[0].weight === '10');

  // Deshacer: quita la última, no la primera.
  const menos = sinLaUltimaSerie(otro);
  comprueba('deshacer quita la última añadida', menos.length === 1 && menos[0].exerciseId === 'e1');
  comprueba('el ejercicio que se queda sin series desaparece', !menos.some((e) => e.sets.length === 0));
  const menos2 = sinLaUltimaSerie(menos);
  comprueba('la siguiente quita una del primero', menos2[0].sets.length === 1);
  comprueba('deshacer con la lista vacía no rompe', sinLaUltimaSerie([]).length === 0);
}

console.log('\nLo que se le dice, que no es lo mismo que animar a más');
{
  const conObjetivo = (hechas, objetivo) => textoDelDia(progresoGtg(rutina({ gtgSetsPerDay: objetivo }), log(hechas)));
  comprueba('sin empezar, dice cuántas y que ninguna al fallo',
    /6 series/.test(textoDelDia(progresoGtg(rutina({ gtgSetsPerDay: 6 }), null))) &&
    /fallo/.test(textoDelDia(progresoGtg(rutina({ gtgSetsPerDay: 6 }), null))));
  comprueba('a mitad, dice lo que queda', /Quedan 5/.test(conObjetivo(3, 8)));
  comprueba('y pide no apretar', /sin apretar|sin prisa/.test(conObjetivo(3, 8)));
  comprueba('con una que queda, en singular', /Queda una/.test(conObjetivo(7, 8)));
  // Lo importante: con el objetivo hecho manda PARAR, no seguir.
  comprueba('completo: manda parar', /Descansa/.test(conObjetivo(8, 8)));
  comprueba('y pasándose, también', /Descansa/.test(conObjetivo(12, 8)));
  comprueba('nunca felicita por hacer de más', !/genial|crack|máquina|más/i.test(conObjetivo(12, 8)));
}

console.log('\nDentro de Sensaciones, una rutina suelta puede ser gtg');
{
  // Es la opción para el día sin cuerpo para una sesión: en vez de no hacer
  // nada, series fáciles repartidas. La rutina NO está en modo gtg; el día sí.
  const sensaciones = rutina({ schedule: 'flex' });
  const diaSuave = { id: 'd2', name: 'Dominadas sueltas', gtg: true, exercises: [] };
  const diaNormal = { id: 'd3', name: 'Empuje', exercises: [] };

  comprueba('la rutina de Sensaciones no es gtg', !esGtg(sensaciones));
  comprueba('pero el día marcado sí', esGtg(sensaciones, diaSuave));
  comprueba('y el que no, no', !esGtg(sensaciones, diaNormal));
  comprueba('con día normal no hay objetivo', objetivoDelDia(sensaciones, diaNormal) === 0);
  comprueba(
    'sin decir cuántas, las de por defecto',
    objetivoDelDia(sensaciones, diaSuave) === SERIES_POR_DEFECTO
  );
  comprueba(
    'las del día mandan sobre las de la rutina',
    objetivoDelDia(rutina({ schedule: 'flex', gtgSetsPerDay: 10 }), { ...diaSuave, gtgSetsPerDay: 3 }) === 3
  );
  comprueba(
    'y si el día no dice nada, las de la rutina',
    objetivoDelDia(rutina({ schedule: 'flex', gtgSetsPerDay: 10 }), diaSuave) === 10
  );
  comprueba(
    'el progreso también cuenta contra el objetivo del día',
    progresoGtg(sensaciones, log(2), { ...diaSuave, gtgSetsPerDay: 8 }).quedan === 6
  );
}

console.log('\nEl entreno del día es el de ESA rutina, no el de cualquiera');
{
  // En Sensaciones se puede hacer una sesión por la mañana y elegir el día de
  // gtg por la tarde. Las series sueltas no pueden colarse dentro del entreno
  // de la mañana: serían series de otro entrenamiento.
  const manana = { ...log(4), id: 'manana', dayName: 'Empuje' };
  const tarde = { ...log(2), id: 'tarde', dayName: 'Dominadas sueltas' };

  comprueba('sin pedir día, vale el primero de hoy', entrenoDeHoy([manana], 'r')?.id === 'manana');
  comprueba(
    'pidiendo el día de gtg, no vale el de la mañana',
    entrenoDeHoy([manana], 'r', Date.now(), 'Dominadas sueltas') === null
  );
  comprueba(
    'y encuentra el suyo si ya existe',
    entrenoDeHoy([manana, tarde], 'r', Date.now(), 'Dominadas sueltas')?.id === 'tarde'
  );
}

console.log('\nUn día entero de gtg vale UN día de racha');
{
  // Aquí se entrena todos los días, así que un día sin ninguna serie es un día
  // saltado. Sin esto, la rutina se leería como "plan desconocido" y la racha
  // regalaría un día de hueco, que en este método es precisamente lo que se
  // quiere evitar.
  const plan = { routine: { schedule: 'gtg', days: [{}] } };
  const enDia = (n) => ({ ...log(4), id: `d${n}`, date: masDias(Date.now(), -n) });

  comprueba('tres días seguidos son racha de 3', currentStreak([enDia(0), enDia(1), enDia(2)], plan) === 3);
  comprueba(
    'un día en blanco la corta',
    currentStreak([enDia(0), enDia(1), enDia(3)], plan) === 2,
    String(currentStreak([enDia(0), enDia(1), enDia(3)], plan))
  );
  comprueba('hoy todavía sin series no la rompe', currentStreak([enDia(1), enDia(2)], plan) === 2);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
