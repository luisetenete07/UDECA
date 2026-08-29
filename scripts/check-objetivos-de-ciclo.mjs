/*
 * Los objetivos del ciclo: cuánto falta, y que el número sea verdad.
 *
 * QUÉ SE PROTEGE
 *
 * Un objetivo solo sirve si dice cuánto falta, y solo dice la verdad si el
 * número sale de las marcas que ya se apuntan al entrenar. En cuanto haya que
 * moverlo a mano, la segunda semana estará desactualizado — y entonces miente,
 * que es peor que no estar.
 *
 * Y hay dos casos que parecen detalles y no lo son:
 *
 *  - SIN NINGUNA MARCA no se dice "0 de 12". Eso parece un suspenso el primer
 *    día del ciclo, cuando lo único que pasa es que aún no se ha entrenado.
 *  - Una serie A MEDIO ESCRIBIR no es una marca. Contarla convertiría un
 *    tecleo en un récord.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-objetivos-de-ciclo.mjs
 */
import {
  MAX_META,
  mejorMarca,
  metaDeTexto,
  ordenados,
  progresoDeObjetivo,
  resumen,
  textoDeObjetivo,
  unidad,
} from '../lib/objetivosDeCiclo.ts';
import { setIdioma } from '../lib/idioma.ts';

setIdioma('es');

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const serie = (reps, extra = {}) => ({ reps: String(reps), completed: true, ...extra });
const log = (ejercicioId, series) => ({
  id: 'l1',
  date: Date.now(),
  exercises: [{ exerciseId: ejercicioId, name: 'Dominadas', sets: series }],
});
const objetivo = (extra = {}) => ({
  id: 'o1',
  ejercicioId: 'e1',
  nombre: 'Dominadas',
  medida: 'reps',
  meta: 12,
  ...extra,
});

console.log('\nLa mejor marca sale de lo que ya está apuntado');
{
  ok('coge la mejor de todas las series', mejorMarca([log('e1', [serie(6), serie(9), serie(7)])], 'e1', 'reps') === 9);
  // Una serie a medio escribir no es una marca: es alguien tecleando.
  ok('no cuenta lo que no se ha completado',
    mejorMarca([log('e1', [serie(6), { reps: '30', completed: false }])], 'e1', 'reps') === 6);
  ok('de otro ejercicio, nada', mejorMarca([log('e2', [serie(20)])], 'e1', 'reps') === 0);
  ok('sin historial, cero', mejorMarca([], 'e1', 'reps') === 0);
  // Un clúster son varios números dentro de una misma serie.
  ok('mira dentro de los clústeres',
    mejorMarca([log('e1', [{ reps: '5', clusters: ['5', '8'], completed: true }])], 'e1', 'reps') === 8);
  // Los kilos van en su campo, no en el de repeticiones.
  ok('los kilos se leen de su campo',
    mejorMarca([log('e1', [serie(5, { weight: 20 }), serie(5, { weight: 32 })])], 'e1', 'kg') === 32);
}

console.log('\nCuánto falta');
{
  const p = progresoDeObjetivo(objetivo(), [log('e1', [serie(9)])]);
  ok('nueve de doce', p.actual === 9 && p.meta === 12);
  ok('faltan tres', p.falta === 3 && !p.logrado);
  ok('y el ratio cuadra', Math.abs(p.ratio - 0.75) < 0.001, String(p.ratio));

  const hecho = progresoDeObjetivo(objetivo(), [log('e1', [serie(12)])]);
  ok('con la meta justa, conseguido', hecho.logrado && hecho.falta === 0);
  // Pasarse no da más del 100 %: una barra al 140 % no significa nada.
  const pasado = progresoDeObjetivo(objetivo(), [log('e1', [serie(20)])]);
  ok('pasarse sigue siendo conseguido', pasado.logrado && pasado.ratio === 1);
  // Sin meta no se divide entre cero.
  const sinMeta = progresoDeObjetivo(objetivo({ meta: 0 }), [log('e1', [serie(9)])]);
  ok('sin meta no divide entre cero', Number.isFinite(sinMeta.ratio) && !sinMeta.logrado);
}

console.log('\nLo que se le dice al alumno');
{
  ok('conseguido se dice y se para', /Conseguido/.test(textoDeObjetivo(progresoDeObjetivo(objetivo(), [log('e1', [serie(12)])]), 'reps')));
  const aMedias = textoDeObjetivo(progresoDeObjetivo(objetivo(), [log('e1', [serie(9)])]), 'reps');
  // La unidad se dice UNA vez: "9 repeticiones de 12 repeticiones · te faltan 3
  // repeticiones" se lee como un formulario, no como una frase.
  ok('a medias dice cuánto falta', /^9 de 12 repeticiones · te faltan 3$/.test(aMedias), aMedias);
  ok('y no riñe', !/mal|fall|deber/i.test(aMedias), aMedias);
  /*
   * El primer día del ciclo NO se dice "0 de 12". Parece un suspenso, y lo
   * único que pasa es que todavía no se ha entrenado.
   */
  const sinNada = textoDeObjetivo(progresoDeObjetivo(objetivo(), []), 'reps');
  ok('sin marcas no parece un suspenso', !/^0 /.test(sinNada) && /Sin marcas/.test(sinNada), sinNada);
}

console.log('\nCada cosa con su unidad');
{
  ok('los segundos', unidad(20, 'seg') === '20 s');
  ok('los kilos', unidad(32, 'kg') === '32 kg');
  ok('las repeticiones', unidad(12, 'reps') === '12 repeticiones');
  // "1 repeticiones" delata que nadie ha leído la pantalla.
  ok('y una sola, en singular', unidad(1, 'reps') === '1 repetición');
}

console.log('\nEl orden en que se leen');
{
  const cerca = objetivo({ id: 'cerca', meta: 10 });
  const lejos = objetivo({ id: 'lejos', meta: 30 });
  const hecho = objetivo({ id: 'hecho', meta: 5 });
  const l = [log('e1', [serie(9)])];
  const orden = ordenados([hecho, lejos, cerca], l).map((o) => o.id);
  // Lo conseguido al final: no se esconde, pero no puede tapar lo que queda.
  ok('lo conseguido va al final', orden[2] === 'hecho', orden.join(','));
  // Y entre lo que falta, primero el que se puede caer esta semana.
  ok('y primero el más cerca', orden[0] === 'cerca', orden.join(','));
}

console.log('\nEl resumen de la cabecera');
{
  const l = [log('e1', [serie(9)])];
  const r = resumen([objetivo({ meta: 5 }), objetivo({ id: 'o2', meta: 30 })], l);
  ok('uno de dos', r.total === 2 && r.hechos === 1 && !r.todos);
  ok('sin objetivos no dice que estén todos', !resumen([], l).todos);
}

console.log('\nLa meta que se teclea');
{
  ok('vacío es SIN PONER', metaDeTexto('') === undefined);
  ok('el cero no vale', metaDeTexto('0') === undefined);
  ok('un número normal se lee', metaDeTexto('12') === 12);
  ok('lo que no son cifras se ignora', metaDeTexto('12 reps') === 12);
  ok('un dedo que resbala tiene tope', metaDeTexto('99999') === MAX_META);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
