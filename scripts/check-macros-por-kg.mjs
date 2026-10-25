/**
 * Macros por kg de peso (lib/macrosPorKg.ts).
 *
 * Lo que se protege: que lo que escribe el entrenador ("1,6-2,2") se lea
 * bien, que los gramos salgan del peso y que las calorías salgan de los
 * macros. Un error aquí no da ningún fallo visible: da una dieta equivocada.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-macros-por-kg.mjs
 */
import { readFileSync } from 'node:fs';
import {
  CARBOS_POR_OBJETIVO,
  POR_DEFECTO,
  calcularPorKg,
  gramos,
  leerRango,
  medio,
  pesoValido,
  textoDeGramos,
  textoDeRango,
} from '../lib/macrosPorKg.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nLo que escribe el entrenador');
{
  ok('un número con coma', igual(leerRango('1,8'), { min: 1.8 }));
  ok('un número con punto', igual(leerRango('1.8'), { min: 1.8 }));
  ok('un rango', igual(leerRango('1,6-2,2'), { min: 1.6, max: 2.2 }));
  ok('un rango con espacios y guion largo', igual(leerRango('1,6 – 2,2'), { min: 1.6, max: 2.2 }));
  ok('un rango con "a"', igual(leerRango('1,6 a 2,2'), { min: 1.6, max: 2.2 }));
  ok('al revés se da la vuelta', igual(leerRango('2,2-1,6'), { min: 1.6, max: 2.2 }));
  ok('dos iguales es un valor', igual(leerRango('2-2'), { min: 2 }));
  ok('vacío no vale', leerRango('') === null);
  ok('una palabra no vale', leerRango('mucha') === null);
  // 180 por 1,8: el error típico de escribir gramos donde van g/kg.
  ok('un disparate (180 g/kg) no vale', leerRango('180') === null);
  ok('tres números no valen', leerRango('1-2-3') === null);
  ok('se vuelve a escribir igual', textoDeRango({ min: 1.6, max: 2.2 }) === '1,6-2,2' && textoDeRango({ min: 0.1 }) === '0,1');
}

console.log('\nDe g/kg a gramos');
{
  ok('un valor por el peso', igual(gramos({ min: 2 }, 72), { min: 144 }));
  ok('un rango por el peso', igual(gramos({ min: 1.6, max: 2.2 }, 72), { min: 115, max: 158 }));
  ok('el punto medio', Math.abs(medio({ min: 1.6, max: 2.2 }) - 1.9) < 1e-9 && medio({ min: 2 }) === 2);
  ok('en texto', textoDeGramos({ min: 1.6, max: 2.2 }, 72) === '115-158 g');
  ok('peso razonable', pesoValido(72) && !pesoValido(0) && !pesoValido(7.2) && !pesoValido(720));
}

console.log('\nEl plan del día');
{
  const r = calcularPorKg({
    pesoKg: 80,
    objetivo: 'mantenimiento',
    proteina: { min: 1.6, max: 2.2 },
    grasas: { min: 0.8, max: 1 },
    carbos: { min: 3, max: 4 },
    creatina: { min: 0.1 },
  });
  ok('proteína en el punto medio (1,9 × 80)', r.proteinG === 152, String(r.proteinG));
  ok('grasas (0,9 × 80)', r.fatG === 72, String(r.fatG));
  ok('carbohidratos (3,5 × 80)', r.carbsG === 280, String(r.carbsG));
  ok('creatina (0,1 × 80)', r.creatinaG === 8);
  ok('las calorías salen de los macros', r.dailyCalories === 152 * 4 + 280 * 4 + 72 * 9, String(r.dailyCalories));
  ok('y su rango, del mínimo al máximo', r.kcalMin < r.dailyCalories && r.dailyCalories < r.kcalMax);
  const sinCreatina = calcularPorKg({ pesoKg: 80, objetivo: 'volumen', proteina: { min: 2 }, grasas: { min: 1 }, carbos: { min: 5 } });
  ok('sin creatina, no hay creatina', sinCreatina.creatinaG === undefined && !('creatinaG' in sinCreatina));
  ok('con valores sueltos, sin rango de calorías', sinCreatina.kcalMin === sinCreatina.kcalMax);
}

console.log('\nLos carbohidratos van con el objetivo');
{
  ok('más en volumen que en mantenimiento, y más que en definición',
    medio(CARBOS_POR_OBJETIVO.volumen) > medio(CARBOS_POR_OBJETIVO.mantenimiento) &&
      medio(CARBOS_POR_OBJETIVO.mantenimiento) > medio(CARBOS_POR_OBJETIVO.definicion));
  ok('lo de entrada es razonable', medio(POR_DEFECTO.proteina) >= 1.6 && medio(POR_DEFECTO.proteina) <= 2.2);
}

console.log('\nY la app lo usa');
{
  const editor = readFileSync('app/(trainer)/clients/[id]/nutrition.tsx', 'utf8');
  ok('el entrenador elige por kg o en gramos', /'Por kg de peso'/.test(editor) && /'En gramos'/.test(editor));
  ok('calcula con el último peso del alumno', /getWeightLogsForClient\(clientId, profile\?\.uid\)/.test(editor));
  ok('al elegir objetivo se proponen sus carbohidratos', /setCarbosKg\(textoDeRango\(CARBOS_POR_OBJETIVO\[o\]\)\)/.test(editor));
  ok('guarda el criterio y los gramos que salen', /porKg,/.test(editor) && /dailyCalories: calculo\.dailyCalories/.test(editor));
  ok('al pasar a gramos se borra lo de por kilo', /\['porKg', 'creatinaG'\]/.test(editor));
  const panel = readFileSync('components/PanelDeNutricion.tsx', 'utf8');
  ok('el alumno ve el criterio de su entrenador', /plan\?\.porKg \? <CriterioPorKg porKg=\{plan\.porKg\} \/>/.test(panel));
}

console.log(fallos === 0 ? '\n✔ Los macros por kg salen bien' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
