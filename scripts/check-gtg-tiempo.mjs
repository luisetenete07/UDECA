/**
 * GTG por tiempo: "20-30 min de pino" en vez de "5 series de pino".
 *
 * En la rutina diaria, cada ejercicio se cuenta por series O por tiempo. Con
 * tiempo, el entrenador pone unos minutos o un margen; el alumno los va
 * sumando a lo largo del día y, al llegar al mínimo, el ejercicio queda hecho.
 * Para medirlo, un crono: Empezar, practicar, Parar, y ese rato se suma.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-gtg-tiempo.mjs
 */
import { readFileSync } from 'node:fs';
import {
  conMinutosDeHoy,
  cronoVigente,
  cuentaTiempo,
  MAX_TANDA_MIN,
  minutosDelCrono,
  minutosEnteros,
  textoDelCrono,
  deLaBiblioteca,
  marcasDeLaRutina,
  MAX_MINUTOS,
  minutosDeHoy,
  minutosDeTexto,
  progresoDiario,
  seriesDelDia,
  textoDelEjercicio,
} from '../lib/rutinaDiaria.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const AHORA = new Date(2026, 9, 26, 12).getTime();
const AYER = AHORA - 86_400_000;

console.log('\nLo que escribe el entrenador');
{
  ok('"20" y "30": un margen', igual(minutosDeTexto('20', '30'), { min: 20, max: 30 }));
  ok('"20-30" en una casilla, también', igual(minutosDeTexto('20-30'), { min: 20, max: 30 }));
  ok('solo "20": un tiempo fijo', igual(minutosDeTexto('20'), { min: 20 }));
  ok('al revés se ordena', igual(minutosDeTexto('30', '20'), { min: 20, max: 30 }));
  ok('de 20 a 20 es un tiempo fijo', igual(minutosDeTexto('20', '20'), { min: 20 }));
  ok('vacío o cero, sin poner', minutosDeTexto('') === undefined && minutosDeTexto('0', '') === undefined);
  ok('un número absurdo se corta', minutosDeTexto('9999').min === MAX_MINUTOS);
}

const pino = { id: 'pino', nombre: 'Pino', objetivo: 'contra pared', minutos: { min: 20, max: 30 } };
const munecas = { id: 'mun', nombre: 'Muñecas', objetivo: '', series: 3 };
const rutina = { id: 'u', trainerId: 't', clientId: 'u', activa: true, nombre: 'GTG', ejercicios: [pino, munecas], updatedAt: 0 };

console.log('\nCómo se ve y cómo cuenta');
{
  ok('"20-30 min · contra pared"', textoDelEjercicio(pino) === '20-30 min · contra pared', textoDelEjercicio(pino));
  ok('las series siguen igual', textoDelEjercicio(munecas) === '3 series');
  ok('por tiempo es UNA cosa que hacer, no varias', igual(marcasDeLaRutina(rutina, null, AHORA), ['pino', 'mun#1', 'mun#2', 'mun#3']));
  // Si hoy tocó series y el entrenador lo pasó a minutos, no quedan casillas sueltas.
  ok('aunque hoy hubiera tocado series antes del cambio', seriesDelDia(pino, { date: AHORA, hechos: [], series: { pino: 5 } }, AHORA) === 1);
  ok('cuenta por tiempo solo con minutos de verdad', cuentaTiempo(pino) && !cuentaTiempo(munecas) && !cuentaTiempo({ minutos: { min: 0 } }));
  const bib = deLaBiblioteca({ id: 'e', name: 'Pino' }, 'x', { minutos: { min: 20, max: 30 }, series: 5 });
  ok('de la biblioteca: con minutos, sin series', igual(bib.minutos, { min: 20, max: 30 }) && bib.series === undefined);
}

console.log('\nEl alumno suma minutos');
{
  const r1 = conMinutosDeHoy(rutina, null, 'pino', 10, AHORA);
  ok('10 min: se apuntan, aún sin hacer', r1.minutos.pino === 10 && !r1.hechos.includes('pino'));
  const d1 = { date: AHORA, hechos: r1.hechos, minutos: r1.minutos };
  ok('y se leen', minutosDeHoy(pino, d1, AHORA) === 10);
  const r2 = conMinutosDeHoy(rutina, d1, 'pino', 20, AHORA);
  ok('al llegar al mínimo (20), hecho solo', r2.hechos.includes('pino'));
  const d2 = { date: AHORA, hechos: r2.hechos, minutos: r2.minutos };
  ok('y cuenta en el progreso del día', progresoDiario(rutina, d2, AHORA).hechos === 1);
  const r3 = conMinutosDeHoy(rutina, d2, 'pino', 15, AHORA);
  ok('si corrige y deja de llegar, se desmarca', !r3.hechos.includes('pino') && r3.minutos.pino === 15);
  const aMano = { date: AHORA, hechos: ['pino'], minutos: { pino: 5 } };
  ok('marcado a mano sin llegar: sumar un rato no le quita la marca', conMinutosDeHoy(rutina, aMano, 'pino', 10, AHORA).hechos.includes('pino'));
  ok('a cero, el ejercicio sale de los minutos', !('pino' in conMinutosDeHoy(rutina, d1, 'pino', 0, AHORA).minutos));
  ok('nunca negativo', conMinutosDeHoy(rutina, null, 'pino', -5, AHORA).minutos.pino === undefined);
  ok('lo de ayer no cuenta hoy', minutosDeHoy(pino, { date: AYER, hechos: [], minutos: { pino: 25 } }, AHORA) === 0);
  ok('en uno por series no hace nada', igual(conMinutosDeHoy(rutina, null, 'mun', 10, AHORA), { minutos: {}, hechos: [] }));
}

console.log('\nEl crono');
{
  const DESDE = AHORA - (7 * 60 + 40) * 1000;
  ok('7 min y 40 s son eso, no 8', Math.abs(minutosDelCrono(DESDE, AHORA) - (7 + 40 / 60)) < 1e-9);
  ok('y se suman al segundo', Math.abs(conMinutosDeHoy(rutina, null, 'pino', 7 + 40 / 60, AHORA).minutos.pino - (7 + 40 / 60)) < 1e-9);
  ok('se lee "7:40"', textoDelCrono(7 + 40 / 60) === '7:40' && textoDelCrono(0) === '0:00');
  ok('con horas, "1:02:05"', textoDelCrono(62 + 5 / 60) === '1:02:05');
  ok('en la línea, minutos enteros', minutosEnteros(19.99) === 19 && minutosEnteros(20) === 20);
  ok('uno olvidado no se come la tarde', minutosDelCrono(AHORA - 5 * 3600_000, AHORA) === MAX_TANDA_MIN);
  ok('ni cuenta hacia atrás', minutosDelCrono(AHORA + 60_000, AHORA) === 0);
  const c = { uid: 'u', id: 'pino', desde: AHORA - 60_000 };
  ok('el guardado vale si es de hoy, suyo y de algo por tiempo', cronoVigente(c, 'u', rutina, AHORA) === c);
  ok('de otro alumno, no', cronoVigente(c, 'otro', rutina, AHORA) === null);
  ok('de ayer, no', cronoVigente({ ...c, desde: AYER }, 'u', rutina, AHORA) === null);
  ok('de un ejercicio que ya no va por tiempo, no', cronoVigente({ ...c, id: 'mun' }, 'u', rutina, AHORA) === null);
}

console.log('\nEn las pantallas');
{
  const editor = lee('components/RutinaDiariaEditor.tsx');
  ok('el entrenador elige "Series" o "Tiempo"', /\['series', 'Series'\],\s*\['tiempo', 'Tiempo'\]/.test(editor));
  ok('en cada ejercicio y al añadir uno', (editor.match(/<SelectorDeCuenta /g) ?? []).length === 2);
  ok('con tiempo, "de [20] a [30] min"', /<CamposDeMinutos/.test(editor) && />a<\/Text>/.test(editor) && />min<\/Text>/.test(editor));
  ok('cambiar de modo quita lo del otro', /modo === 'tiempo' \? \{ \.\.\.e, series: undefined \} : \{ \.\.\.e, minutos: undefined \}/.test(editor));
  const tarjeta = lee('components/RutinaDiariaDelDia.tsx');
  ok('el alumno: Empezar y Parar, y "−5"/"+5" para corregir', />Empezar</.test(tarjeta) && />Parar</.test(tarjeta) && />−5</.test(tarjeta) && />\+5</.test(tarjeta));
  ok('"12 de 20-30 min", contando lo que lleva el crono', /porTiempo && totalMin >= 1\s*\? frase`\$\{minutosEnteros\(totalMin\)\} de \$\{detalle\}`/.test(tarjeta) && /const totalMin = llevaMin \+ tanda;/.test(tarjeta));
  ok('al parar, el rato se suma a lo de hoy', /sumarMinutos\(crono\.id, minutosDeHoy\(e, dia\) \+ tanda\)/.test(tarjeta));
  ok('el crono se guarda en el móvil y se recupera al volver', /AsyncStorage\.setItem\(CLAVE_CRONO, JSON\.stringify\(nuevo\)\)/.test(tarjeta) && /cronoVigente\(guardado, uid, rutina\)/.test(tarjeta));
  ok('y mientras corre, la pantalla no se apaga', /\{crono \? <PantallaEncendida \/> : null\}/.test(tarjeta) && /useKeepAwake\(/.test(tarjeta));
  ok('marcar o cambiar series no pierde los minutos de hoy', (tarjeta.match(/dia\?\.minutos && esMismoDia\(dia\.date, Date\.now\(\)\) \? \{ minutos: dia\.minutos \}/g) ?? []).length === 2);
  const guardado = lee('lib/firestore/rutinaDiaria.ts');
  ok('los minutos de hoy se guardan con el día', /\.\.\.\(extra\?\.minutos \? \{ minutos: extra\.minutos \} : \{\}\)/.test(guardado));
}

console.log(fallos === 0 ? '\n✔ GTG por series o por tiempo' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
