/*
 * Comprobación del avance en cursos (lib/courseProgress.ts).
 *
 * Lo delicado no es contar: es decidir QUÉ cuenta. Una lección anunciada y sin
 * subir no la puede ver nadie, y una marca vieja de una lección borrada no
 * puede seguir sumando. Si cualquiera de las dos cosas cuela, el entrenador ve
 * un porcentaje que no significa nada y decide sobre él igualmente.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-course-progress.mjs
 */
import {
  diasDeAlta,
  estadoDeCurso,
  leccionesContables,
  resumenDeGrupo,
  resumenPorAlumno,
} from '../lib/courseProgress.ts';

const DIA = 24 * 60 * 60 * 1000;
let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else { console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`); fallos++; }
}

const leccion = (id, extra = {}) => ({ id, title: id, videoUrl: `https://v/${id}`, ...extra });

/** Curso con tres lecciones con vídeo, una sin subir y una bloqueada 30 días. */
const curso = {
  id: 'c1',
  trainerId: 't',
  title: 'Planche desde cero',
  published: true,
  createdAt: 0,
  updatedAt: 0,
  sections: [
    { id: 's1', title: 'Base', lessons: [leccion('l1'), leccion('l2')] },
    {
      id: 's2',
      title: 'Avanzado',
      lessons: [
        leccion('l3'),
        { id: 'l4', title: 'Pronto', videoUrl: '' },
        leccion('l5', { unlockAfterDays: 30 }),
      ],
    },
  ],
};

console.log('\nQué cuenta y qué no');
comprueba(
  'la lección sin vídeo no entra en el total',
  leccionesContables(curso).length === 4,
  `contables=${leccionesContables(curso).map((l) => l.id).join(',')}`
);
comprueba(
  'la bloqueada por antigüedad SÍ entra: es parte del curso',
  leccionesContables(curso).some((l) => l.id === 'l5')
);

console.log('\nEstado de un curso');
const vacio = estadoDeCurso(curso, undefined, 999);
comprueba('sin marcas, cero hecho', vacio.hechas === 0 && vacio.ratio === 0);
comprueba('sin marcas no está empezado ni terminado', !vacio.empezado && !vacio.terminado);
comprueba('lo siguiente es la primera lección', vacio.siguiente?.id === 'l1');

const medias = estadoDeCurso(curso, ['l1', 'l2'], 999);
comprueba('dos de cuatro es la mitad', medias.hechas === 2 && medias.ratio === 0.5);
comprueba('empezado pero sin terminar', medias.empezado && !medias.terminado);
comprueba('lo siguiente salta la que no tiene vídeo', medias.siguiente?.id === 'l3');

const todo = estadoDeCurso(curso, ['l1', 'l2', 'l3', 'l5'], 999);
comprueba('las cuatro contables lo dan por terminado', todo.terminado && todo.ratio === 1);
comprueba('terminado ya no propone siguiente', todo.siguiente === null);

console.log('\nLo que no puede colar');
const conBorrada = estadoDeCurso(curso, ['l1', 'l2', 'l3', 'l5', 'borrada-hace-un-mes'], 999);
comprueba(
  'una marca de una lección que ya no existe no suma',
  conBorrada.hechas === 4 && conBorrada.ratio === 1,
  `hechas=${conBorrada.hechas} ratio=${conBorrada.ratio}`
);
const conSinSubir = estadoDeCurso(curso, ['l1', 'l2', 'l3', 'l4', 'l5'], 999);
comprueba(
  'marcar la que está "Pronto" tampoco sube el porcentaje',
  conSinSubir.ratio === 1 && conSinSubir.hechas === 4
);
const vacioTotal = estadoDeCurso(
  { ...curso, sections: [] },
  ['l1'],
  999
);
comprueba(
  'un curso sin lecciones no sale terminado',
  vacioTotal.ratio === 0 && !vacioTotal.terminado
);

console.log('\nCandados por antigüedad');
const nuevo = estadoDeCurso(curso, ['l1', 'l2', 'l3'], 10);
comprueba('a los 10 días, l5 sigue bloqueada y no se propone', nuevo.siguiente === null);
comprueba(
  'pero l5 sigue contando en el total: 3 de 4',
  nuevo.total === 4 && nuevo.hechas === 3
);
const veterano = estadoDeCurso(curso, ['l1', 'l2', 'l3'], 40);
comprueba('a los 40 días ya se propone l5', veterano.siguiente?.id === 'l5');
comprueba(
  'los días de alta se cuentan desde createdAt',
  diasDeAlta(Date.now() - 30 * DIA) === 30
);

console.log('\nEl grupo, como lo ve el entrenador');
const alumnos = [
  { uid: 'a', name: 'Ana', createdAt: Date.now() - 200 * DIA },
  { uid: 'b', name: 'Beto', createdAt: Date.now() - 200 * DIA },
  { uid: 'c', name: 'Cris', createdAt: Date.now() - 200 * DIA },
];
const vistas = {
  a: { c1: ['l1', 'l2', 'l3', 'l5'] },
  b: { c1: ['l1'] },
  // Cris no ha abierto nada.
};
const porAlumno = resumenPorAlumno([curso], alumnos, vistas);
comprueba('ordena por quien menos lleva', porAlumno.map((x) => x.uid).join(',') === 'c,b,a');
comprueba('Ana lo tiene terminado', porAlumno.find((x) => x.uid === 'a').terminados === 1);
comprueba('Cris sale como sin empezar', porAlumno.find((x) => x.uid === 'c').sinEmpezar === true);
comprueba(
  'Beto va por la cuarta parte',
  porAlumno.find((x) => x.uid === 'b').ratio === 0.25
);

const grupo = resumenDeGrupo([curso], porAlumno);
comprueba('cuenta las lecciones publicadas', grupo.leccionesPublicadas === 4);
comprueba('uno sin empezar, uno terminado', grupo.sinEmpezar === 1 && grupo.terminado === 1);
comprueba(
  'la media es la del grupo entero',
  Math.abs(grupo.media - (1 + 0.25 + 0) / 3) < 1e-9,
  `media=${grupo.media}`
);
comprueba(
  'entre los rezagados va Beto, no Cris ni Ana',
  grupo.rezagados.length === 1 && grupo.rezagados[0].uid === 'b'
);

const sinCursos = resumenDeGrupo([], resumenPorAlumno([], alumnos, {}));
comprueba(
  'sin cursos publicados no se inventa nada',
  sinCursos.leccionesPublicadas === 0 && sinCursos.media === 0 && sinCursos.terminado === 0
);

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
