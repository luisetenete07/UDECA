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

console.log('\nMini clases dentro de una lección');
{
  // Una lección puede ser solo un contenedor: sin vídeo propio y con tres mini
  // clases dentro. Lo que cuenta entonces son las tres, no cuatro ni una.
  const curso = {
    id: 'c',
    title: 'Con minis',
    sections: [
      {
        id: 's',
        title: 'Bloque',
        lessons: [
          { id: 'l1', title: 'Con vídeo y dos minis', videoUrl: 'v', minis: [
            { id: 'm1', title: 'Mini 1', videoUrl: 'v' },
            { id: 'm2', title: 'Mini 2', videoUrl: 'v' },
          ]},
          { id: 'l2', title: 'Solo contenedor', minis: [
            { id: 'm3', title: 'Mini 3', videoUrl: 'v' },
          ]},
          { id: 'l3', title: 'Anunciada, sin subir' },
        ],
      },
    ],
  };
  const contables = leccionesContables(curso).map((c) => c.id);
  comprueba('la lección con vídeo cuenta', contables.includes('l1'));
  comprueba('sus dos minis también', contables.includes('m1') && contables.includes('m2'));
  comprueba('la mini del contenedor cuenta', contables.includes('m3'));
  comprueba(
    'el contenedor SIN vídeo no cuenta: no hay nada que ver en él',
    !contables.includes('l2')
  );
  comprueba('ni la lección anunciada y vacía', !contables.includes('l3'));
  comprueba('son cuatro', contables.length === 4, contables.join());

  const e = estadoDeCurso(curso, ['l1', 'm1']);
  comprueba('dos de cuatro', e.hechas === 2 && e.total === 4, `${e.hechas}/${e.total}`);
  comprueba('lo siguiente es la mini 2', e.siguiente?.id === 'm2', String(e.siguiente?.id));
  comprueba('no está terminado', !e.terminado);
  comprueba(
    'viéndolo todo, terminado',
    estadoDeCurso(curso, ['l1', 'm1', 'm2', 'm3']).terminado
  );
  comprueba(
    'una mini sin vídeo no suma aunque esté marcada',
    estadoDeCurso(
      { ...curso, sections: [{ ...curso.sections[0], lessons: [
        { id: 'x', title: 'x', videoUrl: 'v', minis: [{ id: 'vacia', title: 'Pronto' }] },
      ]}]},
      ['x', 'vacia']
    ).total === 1
  );
}

console.log('\nEl candado de la lección alcanza a sus mini clases');
{
  // Si la lección no se ve todavía, sus mini clases tampoco: si no, el candado
  // no serviría de nada y el alumno vería por dentro lo que no puede ver por
  // fuera.
  const curso = {
    id: 'c',
    title: 'Con candado',
    sections: [
      {
        id: 's',
        title: 'Bloque',
        lessons: [
          { id: 'libre', title: 'Desde el día uno', videoUrl: 'v' },
          { id: 'tarde', title: 'A los 30 días', videoUrl: 'v', unlockAfterDays: 30, minis: [
            { id: 'mtarde', title: 'Mini de dentro', videoUrl: 'v' },
          ]},
        ],
      },
    ],
  };
  const nuevo = estadoDeCurso(curso, [], 3);
  comprueba('recién llegado: lo siguiente es la libre', nuevo.siguiente?.id === 'libre');
  const conLaLibreVista = estadoDeCurso(curso, ['libre'], 3);
  comprueba(
    'y con esa vista no le proponemos nada más',
    conLaLibreVista.siguiente === null,
    String(conLaLibreVista.siguiente?.id)
  );
  comprueba(
    'la mini bloqueada NO se cuela como siguiente',
    conLaLibreVista.siguiente?.id !== 'mtarde'
  );
  comprueba(
    'pero sigue contando para el total: llegará sola',
    conLaLibreVista.total === 3,
    String(conLaLibreVista.total)
  );
  const veterano = estadoDeCurso(curso, ['libre'], 40);
  comprueba('a los 40 días ya toca la lección con candado', veterano.siguiente?.id === 'tarde');
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
