/**
 * El temporizador de descanso suelto: el alumno sin rutina en la app elige
 * cuánto descansar y lo lanza a mano, con la misma cuenta atrás del entreno.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-crono-libre.mjs
 */
import { readFileSync } from 'node:fs';
import { acotar, conPaso, etiquetaDeTiempo, leerTiempo, MAXIMO, MINIMO, mmss, POR_DEFECTO, tiempoGuardado } from '../lib/cronoLibre.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

console.log('\nEl tiempo que elige');
{
  ok('se lee como un reloj', mmss(90) === '1:30' && mmss(45) === '0:45' && mmss(300) === '5:00');
  ok('y en los botones, como se dice', etiquetaDeTiempo(30) === '30 s' && etiquetaDeTiempo(60) === '1 min' && etiquetaDeTiempo(90) === '1:30');
  ok('+ y − van de 15 en 15', conPaso(90, 1) === 105 && conPaso(90, -1) === 75);
  ok('y se ajustan a la marca (desde 50 s: 1:00 o 0:45)', conPaso(50, 1) === 60 && conPaso(50, -1) === 45);
  ok('sin pasarse por abajo ni por arriba', conPaso(MINIMO, -1) === MINIMO && conPaso(MAXIMO, 1) === MAXIMO && acotar(0) === MINIMO);
}

console.log('\nEscribirlo');
{
  ok('"1:20" es un minuto y veinte', leerTiempo('1:20') === 80);
  ok('"1.20" y "1\'20" también', leerTiempo('1.20') === 80 && leerTiempo("1'20") === 80);
  ok('un número solo son segundos', leerTiempo('50') === 50 && leerTiempo('90') === 90);
  ok('lo que no es un tiempo, no', leerTiempo('hola') === null && leerTiempo('1:75') === null && leerTiempo('') === null);
  ok('lo exagerado se queda en el máximo', leerTiempo('9999') === MAXIMO);
}

console.log('\nLo recuerda');
{
  ok('lo guardado vale', tiempoGuardado('120') === 120);
  ok('sin nada, el de por defecto', tiempoGuardado(null) === POR_DEFECTO && tiempoGuardado('x') === POR_DEFECTO);
}

console.log('\nDónde sale');
{
  const c = lee('components/CronoDeDescanso.tsx');
  ok('lanza la cuenta atrás de siempre (sigue al cambiar de pantalla y avisa)', /onPress=\{\(\) => startRest\(segundos\)\}/.test(c));
  ok('y recuerda el último tiempo en el móvil', /AsyncStorage\.setItem\(CLAVE, String\(s\)\)/.test(c));
  const w = lee('app/(client)/workout.tsx');
  const sinRutina = w.slice(w.indexOf('if (!routine || routine.days.length === 0) {'), w.indexOf('// ---------- Resumen post-entreno'));
  ok('en Entreno, sin rutina: el temporizador y su cuenta atrás dentro', /<RestTimer key=\{activeRest\.id\} rest=\{activeRest\} enLinea \/>/.test(sinRutina) && /<CronoDeDescanso \/>/.test(sinRutina) && sinRutina.indexOf('<RestTimer') < sinRutina.indexOf('<CronoDeDescanso'));
  const d = lee('app/(client)/dashboard.tsx');
  ok('y en el inicio, solo si no tiene rutina', /\{!loading && !routine \? \(\s*<FadeIn delay=\{80\}>\s*<CronoDeDescanso \/>/.test(d));
}

console.log(fallos === 0 ? '\n✔ Temporizador de descanso suelto' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
