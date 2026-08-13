/*
 * El carné de miembro (lib/carne.ts).
 *
 * Lo que hay que proteger: que una tarjeta que se comparte no diga "fundador"
 * de quien ahora mismo no está dentro (el número no se pierde, pero mientras
 * tanto no se enseña), y que los cuatro tipos de cuenta se distingan de
 * verdad, que es justo para lo que existe la tarjeta.
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
  comprueba('el atleta', tipoDeCarne(perfil({ role: 'athlete' })) === 'atleta');
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

console.log('\nLos cuatro se distinguen');
{
  const de = (p, o) => datosDelCarne(p, o);
  const coach = de(perfil({ role: 'trainer' }));
  const atleta = de(perfil({ role: 'athlete' }));
  const alumno = de(perfil());
  const form = de(perfil(), { conCursos: true });
  const todos = [coach, atleta, alumno, form];

  comprueba('cada uno con su título', new Set(todos.map((c) => c.titulo)).size === 4);
  comprueba('cada uno con su monograma', new Set(todos.map((c) => c.monograma)).size === 4);
  comprueba('cada uno con su color', new Set(todos.map((c) => c.acento)).size === 4);
  comprueba('y con su frase', new Set(todos.map((c) => c.lema)).size === 4);
  comprueba('los colores son todos del mismo oro', todos.every((c) => /^#[0-9A-F]{6}$/i.test(c.acento)));
  comprueba('el título va en mayúsculas', todos.every((c) => c.titulo === c.titulo.toUpperCase()));
  comprueba('el nombre, tal cual', coach.nombre === 'Luis Tena');
  comprueba('sin nombre no queda un hueco', de(perfil({ name: '   ' })).nombre === 'Miembro');
  comprueba('dice desde cuándo', /2026/.test(alumno.desde ?? ''), alumno.desde);
  comprueba('sin perfil, no hay carné', datosDelCarne(null) === null);
}

console.log('\nEl número de fundador solo se enseña encendido');
{
  const ahora = Date.now();
  // Alumno de un coach: entra gratis, así que su insignia no se apaga nunca.
  const alumnoFundador = datosDelCarne(perfil({ founderNumber: 28, trainerId: 't' }), { ahora });
  comprueba('el alumno fundador lo lleva', alumnoFundador.fundador === '#0028', alumnoFundador.fundador);
  comprueba('con cuatro cifras', /^#\d{4}$/.test(alumnoFundador.fundador));

  const atletaAlDia = datosDelCarne(
    perfil({ role: 'athlete', founderNumber: 7, subscriptionUntil: ahora + 30 * DIA }),
    { ahora }
  );
  comprueba('el atleta al día también', atletaAlDia.fundador === '#0007');

  // Caducado: el número sigue siendo suyo, pero una tarjeta que se comparte no
  // puede decir "fundador" de quien ahora mismo no está dentro.
  const atletaCaducado = datosDelCarne(
    perfil({ role: 'athlete', founderNumber: 7, subscriptionUntil: ahora - 5 * DIA }),
    { ahora }
  );
  comprueba('caducado, no se imprime', atletaCaducado.fundador === undefined, atletaCaducado.fundador);
  comprueba('pero sigue teniendo su carné', atletaCaducado.titulo === 'ATLETA');

  comprueba('quien no es fundador, sin número', datosDelCarne(perfil()).fundador === undefined);
  comprueba('un número de cero no cuenta', datosDelCarne(perfil({ founderNumber: 0 })).fundador === undefined);
}

console.log('\nEl rótulo de arriba a la izquierda dice qué eres');
{
  // Ponía "Entrenador" a todo el mundo: un alumno abría la app y lo primero
  // que leía era un cargo que no es el suyo.
  comprueba('el entrenador, Entrenador', rotuloDelRol({ role: 'trainer' }) === 'Entrenador',
    rotuloDelRol({ role: 'trainer' }));
  comprueba('el atleta, Atleta', rotuloDelRol({ role: 'athlete' }) === 'Atleta',
    rotuloDelRol({ role: 'athlete' }));
  comprueba('el alumno, Alumno', rotuloDelRol({ role: 'client' }) === 'Alumno',
    rotuloDelRol({ role: 'client' }));
  comprueba('sin perfil no dice Entrenador', rotuloDelRol(null) !== 'Entrenador',
    rotuloDelRol(null));
  comprueba('y nunca se queda vacío', rotuloDelRol(null).length > 0 && rotuloDelRol(undefined).length > 0);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
