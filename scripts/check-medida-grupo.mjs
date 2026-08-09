/*
 * La medida por grupo de ejercicios (lib/medidaDeGrupo.ts).
 *
 * Lo que se protege aquí es que el entrenador no tenga que acordarse dos
 * veces. Un isométrico que aparece pidiendo repeticiones no se puede arreglar
 * en mitad del entreno, así que las dos cosas que tienen que estar clavadas
 * son: que el grupo manda sobre el ejercicio, y que un grupo renombrado no
 * pierde su medida por el camino.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-medida-grupo.mjs
 */
import {
  claveGrupo,
  conMedidaDeGrupo,
  ejerciciosADesactualizar,
  grupoRenombrado,
  medidaDelGrupo,
  medidaEfectiva,
  sinMedidaDeGrupo,
} from '../lib/medidaDeGrupo.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const ej = (n, cat, sub, measure) => ({
  id: n,
  trainerId: 't',
  name: n,
  muscleGroup: cat,
  subgroup: sub,
  ...(measure ? { measure } : {}),
});

console.log('\nLa clave distingue grupos con el mismo nombre');
{
  comprueba(
    'Aguantes de Planche no es Aguantes de Front',
    claveGrupo('Planche', 'Aguantes') !== claveGrupo('Front', 'Aguantes')
  );
  const mapa = conMedidaDeGrupo(
    conMedidaDeGrupo({}, 'Planche', 'Aguantes', 'seconds'),
    'Front',
    'Aguantes',
    'reps'
  );
  comprueba('cada una guarda la suya', medidaDelGrupo(mapa, 'Planche', 'Aguantes') === 'seconds');
  comprueba('y no se pisan', medidaDelGrupo(mapa, 'Front', 'Aguantes') === 'reps');
}

console.log('\nEl grupo manda sobre el ejercicio');
{
  const mapa = conMedidaDeGrupo({}, 'Planche', 'Aguantes', 'seconds');
  comprueba(
    'un ejercicio sin medida hereda la del grupo',
    medidaEfectiva(ej('a', 'Planche', 'Aguantes'), mapa) === 'seconds'
  );
  comprueba(
    'y uno que traía otra también: el grupo es quien decide',
    medidaEfectiva(ej('b', 'Planche', 'Aguantes', 'reps'), mapa) === 'seconds'
  );
  comprueba(
    'fuera del grupo, la suya',
    medidaEfectiva(ej('c', 'Planche', 'Flexiones', 'combo'), mapa) === 'combo'
  );
  comprueba(
    'sin subgrupo, la suya',
    medidaEfectiva(ej('d', 'Planche', '', 'repsDual'), mapa) === 'repsDual'
  );
  comprueba(
    'sin nada de nada, repeticiones',
    medidaEfectiva(ej('e', 'Planche', ''), mapa) === 'reps'
  );
  comprueba(
    'una medida inventada no cuela',
    medidaEfectiva(ej('f', 'Planche', '', 'kilometros'), mapa) === 'reps'
  );
}

console.log('\nQué ejercicios hay que reescribir al cambiar el grupo');
{
  const lista = [
    ej('a', 'Planche', 'Aguantes', 'reps'),
    ej('b', 'Planche', 'Aguantes', 'seconds'),
    ej('c', 'Planche', 'Aguantes'),
    ej('d', 'Planche', 'Flexiones', 'reps'),
    ej('e', 'Front', 'Aguantes', 'reps'),
  ];
  const cambian = ejerciciosADesactualizar(lista, 'Planche', 'Aguantes', 'seconds');
  comprueba('solo los del grupo', cambian.every((e) => ['a', 'c'].includes(e.id)));
  comprueba(
    'el que ya estaba en segundos no se reescribe',
    !cambian.some((e) => e.id === 'b'),
    JSON.stringify(cambian.map((e) => e.id))
  );
  comprueba('ni los de otro subgrupo', !cambian.some((e) => e.id === 'd'));
  comprueba('ni los de otra categoría', !cambian.some((e) => e.id === 'e'));
  comprueba('son dos', cambian.length === 2, String(cambian.length));
  comprueba(
    'sin subgrupo no se toca nada',
    ejerciciosADesactualizar(lista, 'Planche', '', 'seconds').length === 0
  );
}

console.log('\nRenombrar un grupo no pierde su medida');
{
  // Si se perdiera, el entrenador no vería nada raro hoy —los ejercicios ya
  // tienen su medida escrita— y el fallo saldría semanas después, cuando
  // añadiera uno nuevo y le pidiera repeticiones.
  const mapa = conMedidaDeGrupo({}, 'Planche', 'Aguantes', 'seconds');
  const tras = grupoRenombrado(mapa, 'Planche', 'Aguantes', 'Isométricos');
  comprueba('el nombre nuevo la tiene', medidaDelGrupo(tras, 'Planche', 'Isométricos') === 'seconds');
  comprueba('el viejo ya no está', medidaDelGrupo(tras, 'Planche', 'Aguantes') === undefined);
  comprueba(
    'renombrar un grupo sin medida no inventa ninguna',
    Object.keys(grupoRenombrado({}, 'Planche', 'A', 'B')).length === 0
  );
}

console.log('\nSoltar el grupo');
{
  const mapa = conMedidaDeGrupo({}, 'Planche', 'Aguantes', 'seconds');
  const tras = sinMedidaDeGrupo(mapa, 'Planche', 'Aguantes');
  comprueba('deja de imponer', medidaDelGrupo(tras, 'Planche', 'Aguantes') === undefined);
  comprueba(
    'y los ejercicios se quedan con lo que tenían',
    medidaEfectiva(ej('a', 'Planche', 'Aguantes', 'seconds'), tras) === 'seconds'
  );
  comprueba('no toca los demás grupos', Object.keys(sinMedidaDeGrupo(mapa, 'Planche', 'Otro')).length === 1);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
