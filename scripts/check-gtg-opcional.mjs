/**
 * Rutina diaria (GTG): lo opcional y el registro de lo que va por tiempo.
 *
 *  - El entrenador marca un ejercicio entero como opcional, o deja series
 *    opcionales ("3 series + 2 opcionales"). Se marcan igual, pero no hacen
 *    falta para dar el día por hecho, ni cuentan en el historial ni en los
 *    avisos.
 *  - Lo que va por tiempo ("20-30 min de pino") se registra en MINUTOS: en
 *    Progreso y en la ficha del entrenador sale el rato de cada día, no
 *    "1 hecha". Y si todo va por tiempo, arriba en la tarjeta, minutos.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-gtg-opcional.mjs
 */
import { readFileSync } from 'node:fs';
import {
  conSeriesDeHoy,
  marcasDeLaRutina,
  marcasDelEjercicio,
  marcasOpcionales,
  paraElHistorial,
  progresoDiario,
  seriesOpcionalesDe,
  textoDelEjercicio,
  textoDiario,
  tiempoDeHoy,
  todoPorTiempo,
} from '../lib/rutinaDiaria.ts';
import { minutosDiariosPorDia, resumenDeSeries, seriesDiariasPorDia } from '../lib/historialGtg.ts';
import { inicioDelDia, masDias } from '../lib/fechas.ts';
import { setIdioma } from '../lib/idioma.ts';

setIdioma('es');
let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const HOY = Date.now();
const hoy = inicioDelDia(HOY);
const dia = (hechos, extra = {}) => ({ id: 'd', clientId: 'u', date: HOY, hechos, updatedAt: HOY, ...extra });

const fondos = { id: 'f', nombre: 'Fondos', objetivo: '', series: 3, seriesOpcionales: 2 };
const munecas = { id: 'm', nombre: 'Muñecas', objetivo: '2 min' };
const extra = { id: 'x', nombre: 'Movilidad extra', objetivo: '', opcional: true };
const pino = { id: 'p', nombre: 'Pino', objetivo: '', minutos: { min: 20, max: 30 } };
const rutina = (ejercicios) => ({ id: 'u', trainerId: 't', clientId: 'u', activa: true, nombre: 'GTG', ejercicios, updatedAt: 0 });

console.log('\nSeries opcionales: "3 series + 2 opcionales"');
{
  const m = marcasDelEjercicio(fondos, null, HOY);
  ok('cinco casillas, cuentan las tres primeras', igual(m.todas, ['f#1', 'f#2', 'f#3', 'f#4', 'f#5']) && igual(m.cuentan, ['f#1', 'f#2', 'f#3']));
  ok('se lee así', textoDelEjercicio(fondos) === '3 series + 2 opcionales', textoDelEjercicio(fondos));
  ok('y en singular', textoDelEjercicio({ ...fondos, seriesOpcionales: 1 }) === '3 series + 1 opcional');
  ok('una serie y una opcional son dos casillas', igual(marcasDelEjercicio({ ...fondos, series: 1, seriesOpcionales: 1 }).todas, ['f#1', 'f#2']));
  ok('sin series, no hay opcionales', seriesOpcionalesDe({ seriesOpcionales: 2 }) === 0);
  ok('ni por tiempo', seriesOpcionalesDe({ series: 3, seriesOpcionales: 2, minutos: { min: 20 } }) === 0);
  const r = rutina([fondos]);
  const tres = progresoDiario(r, dia(['f#1', 'f#2', 'f#3']));
  ok('con las tres que cuentan, el día está hecho', tres.completa && tres.hechos === 3 && tres.total === 3);
  const cinco = progresoDiario(r, dia(['f#1', 'f#2', 'f#3', 'f#4', 'f#5']));
  ok('haciendo las opcionales no sale "5 de 3"', cinco.hechos === 3 && cinco.total === 3 && cinco.opcionales === 2);
  const soloOpc = progresoDiario(r, dia(['f#4', 'f#5']));
  ok('y las opcionales solas no lo dan por hecho', !soloOpc.completa && soloOpc.hechos === 0);
  const mas = conSeriesDeHoy(r, dia(['f#1', 'f#2']), 'f', 4);
  ok('una serie más hoy: las opcionales siguen detrás', igual(marcasDelEjercicio(fondos, dia(mas.hechos, { series: mas.series })).todas.length, 6) && mas.hechos.length === 2);
}

console.log('\nEjercicio opcional');
{
  const r = rutina([munecas, extra]);
  ok('no cuenta para el día', igual(marcasDeLaRutina(r), ['m']) && igual(marcasOpcionales(r), ['x']));
  ok('con lo obligatorio hecho, día hecho', progresoDiario(r, dia(['m'])).completa);
  ok('hacerlo suma aparte', progresoDiario(r, dia(['m', 'x'])).opcionales === 1 && progresoDiario(r, dia(['m', 'x'])).hechos === 1);
  const todo = progresoDiario(rutina([extra]), dia([]));
  ok('todo opcional: sin "0 de 0", lo que caiga', todo.total === 0 && textoDiario(todo) === 'Todo opcional: lo que caiga suma.');
  ok('y con series, ninguna cuenta', marcasDelEjercicio({ ...fondos, opcional: true }).cuentan.length === 0);
}

console.log('\nPor tiempo: el registro en minutos');
{
  const r = rutina([pino, munecas]);
  ok('para el historial, sin lo de tiempo', igual(paraElHistorial(r, dia(['p', 'm'])), { total: 1, cuenta: 1 }));
  ok('ni lo opcional', igual(paraElHistorial(rutina([munecas, extra]), dia(['m', 'x'])), { total: 1, cuenta: 1 }));
  const dias = [
    { id: 'a', clientId: 'u', date: masDias(hoy, -1), hechos: ['p'], minutos: { p: 24.5 }, total: 1, cuenta: 0 },
    { id: 'b', clientId: 'u', date: masDias(hoy, -2), hechos: [], minutos: { p: 12 } },
    { id: 'c', clientId: 'u', date: masDias(hoy, -3), hechos: ['p'] },
  ];
  const min = minutosDiariosPorDia(dias, pino, 14, HOY);
  ok('ayer: 24 min, cumplido (llega a 20)', min[12].hechas === 24 && min[12].objetivo === 20 && min[12].cumplido);
  ok('anteayer: 12 min, a medias', min[11].hechas === 12 && !min[11].cumplido);
  ok('marcado a mano sin crono: cumplido aunque no haya minutos', min[10].hechas === 0 && min[10].cumplido);
  const res = resumenDeSeries(min);
  ok('la semana en minutos: 36 en 3 días, 2 cumplidos', res.semana === 36 && res.dias === 3 && res.cumplidos === 2, JSON.stringify(res));
  const cas = seriesDiariasPorDia(dias, r, 14, HOY);
  ok('las casillas no cuentan el pino como "1 hecha"', cas[12].hechas === 0 && cas[12].objetivo === 1, JSON.stringify(cas[12]));
  ok('ni en los días guardados antes (total con el pino dentro)', seriesDiariasPorDia([{ ...dias[0], cuenta: undefined, total: 2, hechos: ['p'] }], r, 14, HOY)[12].hechas === 0);
}

console.log('\nTodo por tiempo: arriba, minutos');
{
  const dos = rutina([pino, { ...pino, id: 'q', nombre: 'Movilidad', minutos: { min: 10 } }]);
  ok('se reconoce', todoPorTiempo(dos) && !todoPorTiempo(rutina([pino, munecas])));
  const t = tiempoDeHoy(dos, dia([], { minutos: { p: 40 } }), HOY);
  ok('lleva 40 de 30 que se buscan', t.llevan === 40 && t.objetivo === 30);
  ok('pero la barra no se llena: la movilidad está sin hacer', Math.abs(t.ratio - 20 / 30) < 1e-9);
  ok('con el crono en marcha, cuenta lo que lleva', tiempoDeHoy(dos, null, HOY, { id: 'q', minutos: 5 }).llevan === 5);
  ok('lo opcional no entra en lo que se busca', tiempoDeHoy(rutina([{ ...pino, opcional: true }]), null, HOY).objetivo === 0);
}

console.log('\nEn las pantallas');
{
  const tarjeta = lee('components/RutinaDiariaDelDia.tsx');
  ok('las casillas salen de marcasDelEjercicio', /const \{ todas: marcas, cuentan \} = marcasDelEjercicio\(e, dia\);/.test(tarjeta));
  ok('las opcionales, con su estilo', /const opcional = !e\.opcional && i >= cuentan\.length;/.test(tarjeta) && /serieOpcional:/.test(tarjeta));
  ok('el ejercicio opcional lleva su etiqueta', /e\.opcional \? <Text style=\{styles\.etiquetaOpcional\}>Opcional<\/Text>/.test(tarjeta));
  ok('todo por tiempo: arriba, minutos', /enMinutos \?/.test(tarjeta) && /minutosEnteros\(tiempo\.llevan\)/.test(tarjeta));
  ok('se guarda para el historial sin tiempo ni opcionales', (tarjeta.match(/\.\.\.paraElHistorial\(rutina, nuevo\),/g) ?? []).length === 3);
  ok('todo opcional: sin avisos', /if \(pr\.total === 0\) \{\s*cancelarAvisosGtg\(\)/.test(tarjeta));
  ok('y se guarda la cuenta', /cuenta: extra\.cuenta/.test(lee('lib/firestore/rutinaDiaria.ts')));
  const editor = lee('components/RutinaDiariaEditor.tsx');
  ok('el entrenador pone las opcionales', /seriesOpcionales: seriesDeTexto\(t\)/.test(editor) && />opcionales<\/Text>/.test(editor));
  ok('y marca un ejercicio entero como opcional', /alternarOpcional\(e\.id\)/.test(editor) && /opcional: e\.opcional \? undefined : true/.test(editor));
  ok('pasar a tiempo quita las opcionales', /series: undefined, seriesOpcionales: undefined/.test(editor));
  const progreso = lee('components/SeriesDelGtg.tsx');
  ok('Progreso y la ficha: lo de tiempo, en minutos y por ejercicio', /minutosDiariosPorDia\(diasDiaria, e, DIAS\)/.test(progreso) && /unidad="minutos"/.test(progreso));
  ok('"min en los últimos 7 días"', /'min en los últimos 7 días'/.test(progreso));
}

console.log(fallos === 0 ? '\n✔ GTG: opcionales y minutos' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
