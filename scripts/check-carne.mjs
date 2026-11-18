/*
 * El carné de miembro (lib/carne.ts).
 *
 * Lo que hay que proteger: que los tres tipos de carné se distingan de verdad,
 * que es justo para lo que existe la tarjeta, y que ninguno lleve ya un número
 * de fundador: esa campaña era de la app de muchos entrenadores.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-carne.mjs
 */
import { datosDelCarne, rotuloDelRol, tipoDeCarne } from '../lib/carne.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const DIA = 24 * 60 * 60 * 1000;
const perfil = (extra = {}) => ({
  uid: 'u',
  email: 'a@b.c',
  name: 'Luis Tena',
  role: 'client',
  createdAt: Date.parse('2026-05-04T10:00:00Z'),
  ...extra,
});

console.log('\nQué tipo de carné le toca a cada uno');
{
  comprueba('el entrenador', tipoDeCarne(perfil({ role: 'trainer' })) === 'coach');
  // El atleta que se entrenaba solo ya no existe: una cuenta antigua de ese
  // tipo no se queda sin carné, lleva el de alumno.
  comprueba('una cuenta antigua de atleta, alumno', tipoDeCarne(perfil({ role: 'athlete' })) === 'alumno');
  comprueba('el alumno', tipoDeCarne(perfil()) === 'alumno');
  comprueba(
    'quien está por los cursos y no entrena',
    tipoDeCarne(perfil(), { conCursos: true, conPlan: false }) === 'formacion'
  );
  comprueba(
    'si además entrena, es alumno',
    tipoDeCarne(perfil(), { conCursos: true, conPlan: true }) === 'alumno'
  );
  // El carné del entrenador no lo sustituye ninguna otra cosa: puede vender y
  // seguir cursos, y sigue siendo el que forma a otros.
  comprueba(
    'el entrenador con cursos sigue siendo entrenador',
    tipoDeCarne(perfil({ role: 'trainer' }), { conCursos: true, conPlan: false }) === 'coach'
  );
  comprueba('sin perfil, no se inventa nada raro', tipoDeCarne(null) === 'alumno');
}

console.log('\nLos tres se distinguen');
{
  const de = (p, o) => datosDelCarne(p, o);
  const coach = de(perfil({ role: 'trainer' }));
  const alumno = de(perfil());
  const form = de(perfil(), { conCursos: true });
  const todos = [coach, alumno, form];

  comprueba('cada uno con su título', new Set(todos.map((c) => c.titulo)).size === 3);
  comprueba('cada uno con su monograma', new Set(todos.map((c) => c.monograma)).size === 3);
  comprueba('cada uno con su color', new Set(todos.map((c) => c.acento)).size === 3);
  comprueba('y con su frase', new Set(todos.map((c) => c.lema)).size === 3);
  comprueba('los colores son todos del mismo oro', todos.every((c) => /^#[0-9A-F]{6}$/i.test(c.acento)));
  comprueba('el título va en mayúsculas', todos.every((c) => c.titulo === c.titulo.toUpperCase()));
  comprueba('el nombre, tal cual', coach.nombre === 'Luis Tena');
  comprueba('sin nombre no queda un hueco', de(perfil({ name: '   ' })).nombre === 'Miembro');
  comprueba('dice desde cuándo', /2026/.test(alumno.desde ?? ''), alumno.desde);
  comprueba('sin perfil, no hay carné', datosDelCarne(null) === null);
}

console.log('\nSin números de fundador');
{
  // Las cuentas que lo tenían guardado siguen con el dato en Firestore, pero la
  // tarjeta ya no lo enseña.
  const conNumero = datosDelCarne(perfil({ role: 'trainer', founderNumber: 7 }));
  comprueba('aunque la cuenta lo tenga guardado, no se imprime', !('fundador' in conNumero));
}

console.log('\nEl rótulo de arriba a la izquierda dice qué eres');
{
  // Ponía "Entrenador" a todo el mundo: un alumno abría la app y lo primero
  // que leía era un cargo que no es el suyo.
  comprueba('el entrenador, Entrenador', rotuloDelRol({ role: 'trainer' }) === 'Entrenador',
    rotuloDelRol({ role: 'trainer' }));
  comprueba('el alumno, Alumno', rotuloDelRol({ role: 'client' }) === 'Alumno',
    rotuloDelRol({ role: 'client' }));
  comprueba('sin perfil no dice Entrenador', rotuloDelRol(null) !== 'Entrenador',
    rotuloDelRol(null));
  comprueba('y nunca se queda vacío', rotuloDelRol(null).length > 0 && rotuloDelRol(undefined).length > 0);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
