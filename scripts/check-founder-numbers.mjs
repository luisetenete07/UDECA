/*
 * Comprobación del reparto de números de fundador
 * (payments-webhook/api/_alta.js).
 *
 * Aquí un fallo no se arregla con un despliegue: un número repartido no se
 * puede quitar, y dos personas con el mismo "entrenador nº 1" es un problema
 * que dura para siempre. Por eso la decisión de qué número toca vive en una
 * función sin efectos y se comprueba aparte, sin Firestore de por medio.
 *
 *   node scripts/check-founder-numbers.mjs
 */
import { siguienteNumeroDeFundador } from '../payments-webhook/api/_fundadores.js';

let fallos = 0;
function comprueba(nombre, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (ok) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre} — esperaba ${JSON.stringify(esperado)} y salió ${JSON.stringify(obtenido)}`);
    fallos++;
  }
}

console.log('Números de fundador:');

// La campaña arranca cerrada: sin `abierta: true` no se reparte nada, y eso es
// lo que impide dar el número 1 antes de tiempo.
comprueba('campaña cerrada: no se reparte', siguienteNumeroDeFundador({}, 'trainer'), null);
comprueba(
  'campaña cerrada explícitamente: tampoco',
  siguienteNumeroDeFundador({ abierta: false, siguienteEntrenador: 5 }, 'trainer'),
  null
);

// Series independientes: el primer entrenador y el primer atleta son los dos
// el número 1, que es justo lo que se buscaba al separarlas.
comprueba(
  'primer entrenador: nº 1',
  siguienteNumeroDeFundador({ abierta: true }, 'trainer'),
  { numero: 1, campo: 'siguienteEntrenador' }
);
comprueba(
  'primer atleta: nº 1 también',
  siguienteNumeroDeFundador({ abierta: true }, 'athlete'),
  { numero: 1, campo: 'siguienteAtleta' }
);
comprueba(
  'cada serie avanza sola',
  siguienteNumeroDeFundador({ abierta: true, siguienteEntrenador: 9, siguienteAtleta: 2 }, 'athlete'),
  { numero: 2, campo: 'siguienteAtleta' }
);

// Lo que impide reutilizar un número: si la campaña ya repartió con el contador
// único de antes, una serie nueva NO empieza en 1, sino donde aquel se quedó.
comprueba(
  'con números ya repartidos, la serie nueva no vuelve a empezar',
  siguienteNumeroDeFundador({ abierta: true, siguiente: 8 }, 'trainer'),
  { numero: 8, campo: 'siguienteEntrenador' }
);
comprueba(
  'y el contador viejo deja de mandar en cuanto la serie existe',
  siguienteNumeroDeFundador({ abierta: true, siguiente: 8, siguienteEntrenador: 12 }, 'trainer'),
  { numero: 12, campo: 'siguienteEntrenador' }
);

// El tope se aplica a cada serie por separado.
comprueba(
  'pasado el tope, no se reparte',
  siguienteNumeroDeFundador({ abierta: true, limite: 50, siguienteAtleta: 51 }, 'athlete'),
  null
);
comprueba(
  'justo en el tope, sí',
  siguienteNumeroDeFundador({ abierta: true, limite: 50, siguienteAtleta: 50 }, 'athlete'),
  { numero: 50, campo: 'siguienteAtleta' }
);

// El alumno no paga alta y por tanto no tiene serie: pedirla no puede colarse
// en la del entrenador.
comprueba('el alumno no tiene serie', siguienteNumeroDeFundador({ abierta: true }, 'client'), null);
comprueba('un rol desconocido tampoco', siguienteNumeroDeFundador({ abierta: true }, undefined), null);

if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallida(s).`);
  process.exit(1);
}
console.log('\nTodo correcto.');
