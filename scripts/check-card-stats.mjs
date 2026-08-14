/*
 * Comprobación de qué sale en la tarjeta (lib/cardStats.ts).
 *
 * Es una pantalla para enseñar, así que el fallo caro no es un cálculo mal
 * hecho: es que salga una cifra que avergüence. "0 entrenamientos" o "Nº 2 de
 * 2" son verdad y no deberían aparecer nunca.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-card-stats.mjs
 */
import {
  numeroFundador,
  tarjetaDeAtleta,
  tarjetaDeEntrenador,
  textoDesde,
} from '../lib/cardStats.ts';
import { setIdioma } from '../lib/idioma.ts';

// Fuera de la app el idioma sale del sistema, y el de este entorno es inglés:
// sin fijarlo, las fechas de estas comprobaciones saldrían en inglés y el
// resultado dependería de dónde se ejecuten.
setIdioma('es');

const DIA = 24 * 60 * 60 * 1000;
const MES = 30.4 * DIA;
const AHORA = new Date(2026, 7, 6, 12, 0, 0).getTime();
let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else { console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`); fallos++; }
}
const etiquetas = (l) => l.map((x) => x.etiqueta).join(' | ');
const valorDe = (l, et) => l.find((x) => x.etiqueta === et)?.valor;

console.log('\nEl número de fundador');
comprueba('siempre a cuatro cifras', numeroFundador(7) === '#0007');
comprueba('y no se recorta si tiene más', numeroFundador(12345) === '#12345');

console.log('\nEntrenador');
const coachNuevo = tarjetaDeEntrenador(
  { createdAt: AHORA - 3 * DIA, alumnos: 0, entrenosDirigidos: 0 },
  AHORA
);
comprueba(
  'recién llegado y sin alumnos: no enseña ceros',
  coachNuevo.length === 1 && coachNuevo[0].valor === 'UDECA',
  etiquetas(coachNuevo)
);
const coachPocos = tarjetaDeEntrenador(
  { createdAt: AHORA - 10 * DIA, alumnos: 2, entrenosDirigidos: 4 },
  AHORA
);
comprueba(
  'con 4 entrenos dirigidos, esa cifra aún no cuenta',
  valorDe(coachPocos, 'Entrenos dirigidos') === undefined,
  etiquetas(coachPocos)
);
comprueba('pero 2 alumnos sí', valorDe(coachPocos, 'Alumnos a tu cargo') === '2');
comprueba('y menos de un mes no sale como "En UDECA"', valorDe(coachPocos, 'En UDECA') === undefined);

const coachHecho = tarjetaDeEntrenador(
  {
    founderNumber: 7,
    createdAt: AHORA - 8 * MES,
    alumnos: 1,
    entrenosDirigidos: 1240,
  },
  AHORA
);
comprueba('el fundador manda y va el primero', coachHecho[0].valor === '#0007');
comprueba('un alumno en singular', valorDe(coachHecho, 'Alumno a tu cargo') === '1');
// En español un número de cuatro cifras va SIN punto (1240) y se agrupa a
// partir de cinco (12.400). Es la regla de la RAE y la que aplica el idioma
// por su cuenta; escribir "1.240" a mano sería meter un error.
comprueba('cuatro cifras, sin punto', valorDe(coachHecho, 'Entrenos dirigidos') === '1240');
comprueba(
  'cinco cifras, con punto',
  valorDe(
    tarjetaDeEntrenador({ alumnos: 3, entrenosDirigidos: 12400 }, AHORA),
    'Entrenos dirigidos'
  ) === '12.400'
);
comprueba('ocho meses', valorDe(coachHecho, 'En UDECA') === '8 meses');

console.log('\nAtleta y alumno');
const novato = tarjetaDeAtleta(
  { createdAt: AHORA - DIA, entrenos: 0, racha: 0 },
  AHORA
);
comprueba(
  'sin entrenos no enseña un cero: invita',
  novato.length === 1 && novato[0].valor === 'Tu primer entreno',
  etiquetas(novato)
);
const casi = tarjetaDeAtleta(
  { createdAt: AHORA - 20 * DIA, entrenos: 1, racha: 2 },
  AHORA
);
comprueba('un entrenamiento, en singular', valorDe(casi, 'Entrenamiento') === '1');
comprueba('dos días seguidos todavía no son racha', valorDe(casi, 'Días seguidos') === undefined);
const conRacha = tarjetaDeAtleta(
  { createdAt: AHORA - 20 * DIA, entrenos: 9, racha: 3 },
  AHORA
);
comprueba('tres días seguidos ya sí', valorDe(conRacha, 'Días seguidos') === '3');

console.log('\nEl puesto solo cuando hay contra quién');
const dosDeDos = tarjetaDeAtleta(
  { createdAt: AHORA - 5 * MES, entrenos: 40, racha: 5, puesto: 2, deCuantos: 2 },
  AHORA
);
comprueba(
  'en un grupo de dos no se enseña el puesto',
  !dosDeDos.some((x) => x.valor.startsWith('Nº')),
  etiquetas(dosDeDos)
);
const enGrupo = tarjetaDeAtleta(
  { createdAt: AHORA - 5 * MES, entrenos: 40, racha: 5, puesto: 3, deCuantos: 8 },
  AHORA
);
comprueba('en un grupo de ocho sí', valorDe(enGrupo, 'De 8 en tu grupo') === 'Nº 3');
const sinPuesto = tarjetaDeAtleta(
  { createdAt: AHORA - 5 * MES, entrenos: 40, racha: 5, deCuantos: 8 },
  AHORA
);
comprueba(
  'sin puesto conocido tampoco se inventa',
  !sinPuesto.some((x) => x.valor.startsWith('Nº'))
);

console.log('\nLa placa del nombre');
comprueba(
  'la fecha va con mayúscula inicial y sin capitalizar todo',
  textoDesde(new Date(2026, 4, 12).getTime()) === 'Mayo de 2026',
  String(textoDesde(new Date(2026, 4, 12).getTime()))
);
comprueba('sin fecha, no hay texto', textoDesde(undefined) === undefined);

console.log('\nCon el número ya impreso en la tarjeta');
const sinFund = tarjetaDeEntrenador(
  { founderNumber: 7, createdAt: AHORA - 8 * MES, alumnos: 4, entrenosDirigidos: 300 },
  AHORA,
  { conFundador: false }
);
comprueba(
  'el número sale de la rotación: ya está impreso, no compite',
  !sinFund.some((x) => x.valor.startsWith('#')),
  etiquetas(sinFund)
);
comprueba('pero el resto de cifras siguen', sinFund.length === 3, etiquetas(sinFund));
const atletaSinFund = tarjetaDeAtleta(
  { founderNumber: 43, createdAt: AHORA - 5 * MES, entrenos: 40, racha: 5 },
  AHORA,
  { conFundador: false }
);
comprueba(
  'igual en el atleta',
  !atletaSinFund.some((x) => x.valor.startsWith('#')),
  etiquetas(atletaSinFund)
);
comprueba(
  'y por defecto sigue saliendo, como antes',
  tarjetaDeEntrenador({ founderNumber: 7, alumnos: 1, entrenosDirigidos: 0 }, AHORA)[0].valor === '#0007'
);

console.log('\nNunca se queda vacía');
comprueba(
  'entrenador sin nada, una cifra',
  tarjetaDeEntrenador({ alumnos: 0, entrenosDirigidos: 0 }, AHORA).length >= 1
);
comprueba(
  'atleta sin nada, una cifra',
  tarjetaDeAtleta({ entrenos: 0, racha: 0 }, AHORA).length >= 1
);

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
