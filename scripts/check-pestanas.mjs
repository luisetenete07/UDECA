/**
 * Cada cosa en su sitio: las pestañas del alumno y la ficha del coach.
 *
 *  - Al alumno no se le enseñan pestañas vacías ("Cursos" sin cursos, "Social"
 *    sin compañeros), y si no se sabe, se enseñan.
 *  - La ficha del alumno va en tres pestañas, con el coaching en Resumen.
 *  - La clasificación del grupo vive en Clientes, no en el perfil del coach.
 *
 *   node scripts/check-pestanas.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const lee = (f) => readFileSync(f, 'utf8');

console.log('\nLas pestañas del alumno');
{
  const l = lee('app/(client)/_layout.tsx');
  ok('"Cursos" se esconde sin cursos', /name="courses"\s*options=\{\{\s*href: pestanas\?\.cursos === false \? null : undefined,/.test(l));
  ok('"Social" se esconde sin compañeros', /name="social"\s*options=\{\{\s*href: pestanas\?\.social === false \? null : undefined,/.test(l));
  ok('los compañeros son otros, no él', /filas\.some\(\(f\) => f\.uid !== uid\)/.test(l));
  ok('si la consulta falla, se enseñan', (l.match(/\.catch\(\(\) => true\)/g) ?? []).length === 2);
  ok('y se vuelve a mirar al volver a la app', /if \(s === 'active'\) mirar\(\);/.test(l));
}

console.log('\nLa ficha del alumno, en pestañas');
{
  const f = lee('app/(trainer)/clients/[id]/index.tsx');
  ok('Resumen · Entreno · Nutrición', /valor: 'resumen'[\s\S]{0,200}valor: 'entreno'[\s\S]{0,200}valor: 'nutricion'/.test(f));
  const resumen = f.indexOf("{pestana === 'resumen' ? (");
  const entreno = f.indexOf("{pestana === 'entreno' ? (");
  const nutri = f.indexOf("{pestana === 'nutricion' ? (");
  const dentro = (txt, desde, hasta) => {
    const i = f.indexOf(txt);
    return i > desde && i < hasta;
  };
  ok('el coaching, en Resumen', dentro('<PeriodoDeCoaching', resumen, entreno));
  ok('la rutina y el historial, en Entreno', dentro('Rutina asignada', entreno, nutri) && dentro('id="alumno-historial"', entreno, nutri));
  ok('el plan y el peso, en Nutrición', dentro('id="alumno-nutricion"', nutri, f.length) && dentro('id="alumno-peso"', nutri, f.length));
  ok('la pestaña se recuerda de un alumno a otro', /let ultimaPestana: Pestana/.test(f) && /ultimaPestana = p;/.test(f));
}

console.log('\nLa clasificación, en Clientes');
{
  ok('Clientes la enseña', /<ClasificacionDelGrupo trainerId=\{profile\.uid\} \/>/.test(lee('app/(trainer)/clients/index.tsx')));
  ok('y el perfil ya no', !/subscribeSocialLeaderboard|coach-clasificacion/.test(lee('app/(trainer)/profile.tsx')));
}

console.log(fallos === 0 ? '\n✔ Cada cosa en su sitio' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
