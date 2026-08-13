/*
 * Clases VIP (lib/vip.ts).
 *
 * Lo que se protege aquí son dos fallos que no dan error:
 *
 *  1. QUE LO VIP SE COLE. Si el filtro no se aplicara en algún camino, un
 *     alumno que paga el plan normal vería —y abriría— contenido del plan de
 *     arriba. El entrenador no se entera nunca, porque a él le sale bien.
 *  2. QUE EL AVANCE SE QUEDE CLAVADO. Si lo VIP se ocultara al pintar pero
 *     siguiera contando para el total, ese alumno se quedaría en un 60 % que
 *     no puede subir jamás y parecería que es él quien no avanza.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-vip.mjs
 */
import { cursoParaMi, cursosParaMi, cuantasVip, esVip, leccionParaMi, tieneAlgoVip, visibleParaMi } from '../lib/vip.ts';
import { estadoDeCurso, leccionesContables } from '../lib/courseProgress.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

const curso = {
  id: 'c1',
  trainerId: 't',
  title: 'Dominadas',
  published: true,
  createdAt: 0,
  updatedAt: 0,
  sections: [
    {
      id: 's1',
      title: 'Base',
      lessons: [
        { id: 'l1', title: 'Abierta', videoUrl: 'v1' },
        { id: 'l2', title: 'Solo VIP', videoUrl: 'v2', vip: true },
        {
          id: 'l3',
          title: 'Abierta con minis',
          videoUrl: 'v3',
          minis: [
            { id: 'm1', title: 'Mini abierta', videoUrl: 'v4' },
            { id: 'm2', title: 'Mini VIP', videoUrl: 'v5', vip: true },
          ],
        },
        {
          id: 'l4',
          title: 'Contenedor de minis VIP',
          minis: [{ id: 'm3', title: 'Mini VIP', videoUrl: 'v6', vip: true }],
        },
      ],
    },
    {
      id: 's2',
      title: 'Sección entera VIP',
      lessons: [{ id: 'l5', title: 'VIP', videoUrl: 'v7', vip: true }],
    },
  ],
};

console.log('\nQuién es VIP');
{
  comprueba('con la casilla puesta, sí', esVip({ vip: true }));
  comprueba('sin ella, no', !esVip({ vip: false }) && !esVip({}));
  comprueba('sin perfil, no', !esVip(null) && !esVip(undefined));
  // Un alumno no puede ser VIP "por descuido": tiene que estar marcado.
  comprueba('lo abierto lo ve cualquiera', visibleParaMi({}, false));
  comprueba('lo VIP solo el VIP', !visibleParaMi({ vip: true }, false) && visibleParaMi({ vip: true }, true));
}

console.log('\nEl VIP lo ve todo, tal cual');
{
  const suyo = cursoParaMi(curso, true);
  comprueba('no se le quita nada', JSON.stringify(suyo) === JSON.stringify(curso));
  comprueba('y cuenta todo', leccionesContables(suyo).length === leccionesContables(curso).length);
}

console.log('\nEl que no es VIP no ve lo VIP');
{
  const suyo = cursoParaMi(curso, false);
  const ids = suyo.sections.flatMap((s) => s.lessons.flatMap((l) => [l.id, ...(l.minis ?? []).map((m) => m.id)]));
  comprueba('la lección VIP no está', !ids.includes('l2'), ids.join(','));
  comprueba('la mini VIP tampoco', !ids.includes('m2'), ids.join(','));
  comprueba('lo abierto sigue estando', ids.includes('l1') && ids.includes('l3') && ids.includes('m1'));
  // Una lección sin vídeo cuyas minis eran todas VIP no lleva a ninguna parte.
  comprueba('el contenedor que se queda vacío desaparece', !ids.includes('l4'), ids.join(','));
  comprueba('y la sección entera VIP también', suyo.sections.length === 1, String(suyo.sections.length));
}

console.log('\nEl avance no se queda clavado');
{
  // ESTE es el fallo caro: ocultar sin dejar de contar. El alumno lo ve todo
  // lo suyo, lo marca todo, y se queda en un 60 % que no puede subir nunca.
  const suyo = cursoParaMi(curso, false);
  const contables = leccionesContables(suyo).map((c) => c.id);
  const e = estadoDeCurso(suyo, contables);
  comprueba('marcándolo todo, llega al 100 %', e.ratio === 1, `${e.hechas}/${e.total}`);
  comprueba('y sale como terminado', e.terminado);
  comprueba('lo VIP no entra en el total', !contables.includes('l2') && !contables.includes('m2'),
    contables.join(','));

  const delVip = estadoDeCurso(curso, contables);
  comprueba('al VIP le siguen faltando las suyas', delVip.ratio < 1, `${delVip.hechas}/${delVip.total}`);
}

console.log('\nUna lección suelta');
{
  comprueba('la VIP se cae entera', leccionParaMi({ id: 'x', title: 'x', videoUrl: 'v', vip: true }, false) === null);
  const podada = leccionParaMi(curso.sections[0].lessons[2], false);
  comprueba('la abierta pierde solo sus minis VIP', podada.minis.length === 1 && podada.minis[0].id === 'm1');
  comprueba('sin minis no se inventa una lista', leccionParaMi({ id: 'y', title: 'y', videoUrl: 'v' }, false).minis.length === 0);
}

console.log('\nLa lista de cursos');
{
  const soloVip = {
    ...curso,
    id: 'c2',
    sections: [{ id: 's', title: 's', lessons: [{ id: 'z', title: 'z', videoUrl: 'v', vip: true }] }],
  };
  const vistos = cursosParaMi([curso, soloVip], false).map((c) => c.id);
  comprueba('un curso entero VIP no se enseña', !vistos.includes('c2'), vistos.join(','));
  comprueba('el mixto sí', vistos.includes('c1'));
  comprueba('al VIP se le enseñan los dos', cursosParaMi([curso, soloVip], true).length === 2);
}

console.log('\nLo que ve el entrenador');
{
  comprueba('sabe que el curso tiene algo VIP', tieneAlgoVip(curso));
  comprueba('y cuántas son', cuantasVip(curso) === 4, String(cuantasVip(curso)));
  const abierto = { ...curso, sections: [{ id: 's', title: 's', lessons: [{ id: 'a', title: 'a', videoUrl: 'v' }] }] };
  comprueba('un curso sin nada VIP lo dice', !tieneAlgoVip(abierto) && cuantasVip(abierto) === 0);
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
