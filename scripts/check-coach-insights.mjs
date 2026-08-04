/*
 * Comprobación de "quién mejora y quién empeora" (lib/coachInsights.ts).
 *
 * Lo delicado es NO cantar ruido: una semana mala la tiene cualquiera, y un
 * aviso que el entrenador considera exagerado le quita valor a todos los demás.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-coach-insights.mjs
 */
import { destacados, tendenciaDeAlumnos } from '../lib/coachInsights.ts';

const DIA = 24 * 60 * 60 * 1000;
let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else { console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`); fallos++; }
}

const lunesDe = (ts) => {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const AHORA = new Date(2026, 7, 5, 12, 0, 0).getTime();
const FIN = lunesDe(AHORA) + 7 * DIA;
const INI_AHORA = FIN - 14 * DIA;
const INI_ANTES = INI_AHORA - 14 * DIA;

/** Un entreno con N series completadas. */
const entreno = (clientId, fecha, series) => ({
  id: `${clientId}${fecha}`, trainerId: 't', clientId, routineId: 'r', routineName: 'R',
  dayName: 'X', date: fecha, createdAt: fecha,
  exercises: [{
    exerciseId: 'e', name: 'E', measure: 'reps',
    sets: Array.from({ length: series }, () => ({ reps: '8', weight: '0', completed: true })),
  }],
});

const alumno = (uid, name) => ({ uid, name, role: 'client', email: `${uid}@x.y`, createdAt: 0 });

const clientes = [
  alumno('sube', 'Sube'), alumno('baja', 'Baja'),
  alumno('igual', 'Igual'), alumno('nuevo', 'Nuevo'), alumno('nada', 'Nada'),
];

const logs = [
  // Sube: 12 series antes, 24 ahora.
  entreno('sube', INI_ANTES + DIA, 12), entreno('sube', INI_AHORA + DIA, 24),
  // Baja: 30 antes, 12 ahora.
  entreno('baja', INI_ANTES + DIA, 30), entreno('baja', INI_AHORA + DIA, 12),
  // Igual: 20 y 21.
  entreno('igual', INI_ANTES + DIA, 20), entreno('igual', INI_AHORA + DIA, 21),
  // Nuevo: no había nada antes y ahora entrena.
  entreno('nuevo', INI_AHORA + 2 * DIA, 16),
  // Nada: dos series sueltas, por debajo de la base mínima.
  entreno('nada', INI_ANTES + DIA, 2), entreno('nada', INI_AHORA + DIA, 3),
];

console.log('\n1) La tendencia de cada uno');
const t = tendenciaDeAlumnos(clientes, logs, AHORA);
const de = (uid) => t.find((x) => x.uid === uid);

comprueba('el que dobla series, sube', de('sube').tendencia === 'sube');
comprueba('el que baja a menos de la mitad, baja', de('baja').tendencia === 'baja');
comprueba('un 5 % arriba es estable, no una mejora', de('igual').tendencia === 'estable',
  `${de('igual').tendencia} (${de('igual').cambio.toFixed(2)})`);
comprueba('quien empieza de cero, sube', de('nuevo').tendencia === 'sube');
comprueba('con dos series no se opina', de('nada').tendencia === 'sin-datos');

console.log('\n2) Los números que se enseñan');
comprueba('cuenta las series de ahora', de('baja').seriesAhora === 12);
comprueba('y las de antes', de('baja').seriesAntes === 30);
comprueba('el cambio es -60 %', Math.round(de('baja').cambio * 100) === -60,
  String(Math.round(de('baja').cambio * 100)));
comprueba('cuenta las sesiones', de('sube').sesionesAhora === 1 && de('sube').sesionesAntes === 1);

console.log('\n3) El orden y el reparto');
comprueba('quien más baja va primero', t[0].uid === 'baja');
const d = destacados(t);
comprueba('en "bajan" solo está el que baja', d.bajan.length === 1 && d.bajan[0].uid === 'baja');
comprueba('en "suben" están los dos que suben', d.suben.length === 2);
// A igualdad de porcentaje (los dos doblan) desempata el volumen: 24 series
// pesan más que 16.
comprueba('a igualdad de subida manda el volumen', d.suben[0].uid === 'sube', d.suben[0].uid);
comprueba('el estable no sale en ninguna lista',
  !d.bajan.concat(d.suben).some((x) => x.uid === 'igual'));

console.log('\n4) Una semana mala no es una tendencia');
// Entrenaba bien y esta semana ha fallado, pero la anterior fue normal.
const puntual = [
  entreno('sube', INI_ANTES + DIA, 20), entreno('sube', INI_ANTES + 8 * DIA, 20),
  entreno('sube', INI_AHORA + DIA, 20), // segunda semana en blanco
];
const p = tendenciaDeAlumnos([alumno('sube', 'Sube')], puntual, AHORA)[0];
comprueba('40 → 20 sí es una bajada real', p.tendencia === 'baja', `${p.cambio.toFixed(2)}`);

const suave = [
  entreno('x', INI_ANTES + DIA, 20), entreno('x', INI_ANTES + 8 * DIA, 20),
  entreno('x', INI_AHORA + DIA, 20), entreno('x', INI_AHORA + 8 * DIA, 18),
];
const s = tendenciaDeAlumnos([alumno('x', 'X')], suave, AHORA)[0];
comprueba('40 → 38 no se avisa', s.tendencia === 'estable', `${s.cambio.toFixed(2)}`);

console.log(fallos === 0 ? '\nTodo correcto ✔\n' : `\n${fallos} fallo(s) ✖\n`);
process.exit(fallos === 0 ? 0 : 1);
