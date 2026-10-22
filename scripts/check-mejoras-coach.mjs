/**
 * Las mejoras del entrenador de la tanda de octubre.
 *
 *  7. Bandeja "Por revisar" en lugar de "Actividad reciente".
 *  8. Sugerencia de progresión en el editor de rutinas.
 *  9. Aplicar una rutina a varios alumnos a la vez.
 * 10. "Ver como el alumno" antes de guardar.
 * 11. La biblioteca se comparte con un código.
 * 12. Ajustes y gestión del alumno, en una sola sección.
 * 13. Colores de categoría: solo la paleta.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-mejoras-coach.mjs
 */
import { readFileSync } from 'node:fs';
import { bandeja, conRevisado, idEnLaBandeja, loQueDestaca, MAX_REVISADOS, porRevisar } from '../lib/bandeja.ts';
import { objetivoSubido, sugerenciaDeProgresion, topeDelObjetivo } from '../lib/progresion.ts';
import { LARGO_DEL_CODIGO, normalizarCodigo, nuevoCodigo, queLeFaltan } from '../lib/codigoBiblioteca.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const lee = (f) => readFileSync(f, 'utf8');
const DIA = 86_400_000;
const AHORA = Date.UTC(2026, 9, 15, 12);
const serie = (reps, completed = true) => ({ reps: String(reps), completed });
const log = (id, dias, exercises, extra = {}) => ({
  id, clientId: 'c1', date: AHORA - dias * DIA, createdAt: AHORA - dias * DIA, dayName: 'Día', exercises, ...extra,
});

console.log('\n7. Bandeja "Por revisar"');
{
  const logs = [log('a', 1, []), log('b', 3, []), log('viejo', 20, [])];
  ok('salen los nuevos, del más reciente', porRevisar(logs, {}, AHORA).map((l) => l.id).join() === 'a,b');
  ok('lo abierto ya no sale', porRevisar(logs, { revisados: ['a'] }, AHORA).map((l) => l.id).join() === 'b');
  ok('"marcar todo" vacía la bandeja', porRevisar(logs, { revisadoHasta: AHORA }, AHORA).length === 0);
  ok('lo de hace más de dos semanas no es "por revisar"', !porRevisar(logs, {}, AHORA).some((l) => l.id === 'viejo'));
  const muchos = Array.from({ length: MAX_REVISADOS + 5 }, (_, i) => `x${i}`);
  ok('la lista de vistos no crece sin fin', conRevisado(muchos, 'nuevo').length === MAX_REVISADOS && conRevisado(muchos, 'nuevo')[0] === 'nuevo');
  const ex = (o) => ({ exerciseId: 'e', name: 'Dominadas', measure: 'reps', ...o });
  const antes = log('h', 9, [ex({ sets: [serie(8)] })]);
  const hoy = log('n', 1, [
    ex({ sets: [serie(10), serie(5, false)], notes: 'Me molestó el hombro', rir: 0 }),
    { exerciseId: 'f', name: 'Fondos', saltado: true, sets: [serie(0, false)] },
  ]);
  const d = loQueDestaca(hoy, [antes, hoy]).map((x) => x.texto);
  ok('dice si hubo récord', d.includes('1 récord'), d.join(' | '));
  ok('si dejó una nota', d.includes('Ha dejado una nota'));
  ok('las series sin hacer', d.includes('1 serie sin hacer'));
  ok('lo saltado', d.includes('Saltó Fondos'));
  ok('y lo que fue al fallo', d.includes('1 al fallo'));
  const dash = lee('app/(trainer)/dashboard.tsx');
  ok('está en el inicio del entrenador', /Por revisar<\/Text>/.test(dash) && !/title="Actividad reciente"/.test(dash));
  ok('abrir uno lo marca como visto', /conRevisado\(visto\.revisados, id\)/.test(dash) && /abrirRevisando\(log\.id,/.test(dash));
}

console.log('\n7b. Las llamadas de los alumnos, también en "Por revisar"');
{
  const act = (id, tipo, horas, extra = {}) => ({
    id, trainerId: 't', clientId: 'c1', tipo, inicio: AHORA + 2 * DIA, cuando: AHORA - horas * 3_600_000, ...extra,
  });
  const logs = [log('a', 1, []), log('b', 3, [])];
  const actividad = [act('r1', 'reservada', 2), act('c1', 'cancelada', 30), act('vieja', 'reservada', 20 * 24)];
  const b = bandeja(logs, actividad, {}, AHORA);
  ok('cada reserva y cada cancelación es una entrada nueva',
    b.filter((x) => x.clase === 'llamada').map((x) => x.actividad.tipo).join() === 'reservada,cancelada');
  ok('mezcladas con los entrenos, de la más nueva a la más vieja',
    b.map((x) => (x.clase === 'llamada' ? x.actividad.id : x.log.id)).join() === 'r1,a,c1,b', b.map((x) => x.id).join());
  ok('lo de hace más de dos semanas, no', !b.some((x) => x.id === 'llamada:vieja'));
  ok('abierta, deja de salir', !bandeja(logs, actividad, { revisados: [idEnLaBandeja({ id: 'r1' })] }, AHORA).some((x) => x.id === 'llamada:r1'));
  ok('"Todo visto" también se las lleva', bandeja(logs, actividad, { revisadoHasta: AHORA }, AHORA).length === 0);
  // El id de una llamada no puede chocar con el de un entreno que se llame igual.
  ok('una llamada y un entreno con el mismo id no se pisan',
    bandeja([log('x', 1, [])], [act('x', 'reservada', 1)], { revisados: ['x'] }, AHORA).map((i) => i.id).join() === 'llamada:x');

  const dash = lee('app/(trainer)/dashboard.tsx');
  ok('el inicio del entrenador las carga', /getActividadDeLlamadas\(profile\.uid, masDias\(hoy, -DIAS_DE_BANDEJA\)\)/.test(dash));
  ok('y las pinta en la bandeja', /bandeja\(logs, actividadLlamadas, visto\)/.test(dash) && /Ha cancelado una llamada/.test(dash) && /Ha reservado una llamada/.test(dash));
  ok('abrir una lleva a las llamadas', /abrirRevisando\(item\.id, '\/\(trainer\)\/llamadas'\)/.test(dash));

  const fs = lee('lib/firestore/llamadas.ts');
  ok('reservar lo apunta', /apuntarActividad\('reservada', l\)/.test(fs));
  ok('cancelar el alumno lo apunta', /if \(delAlumno\) apuntarActividad\('cancelada', delAlumno\)/.test(fs));
  ok('con la hora del servidor', /cuando: serverTimestamp\(\)/.test(fs));
  ok('el alumno cancela con lo suyo', /await cancelarLlamada\(l\.id, l\);/.test(lee('app/(client)/llamadas.tsx')));
  // Lo que cancela el entrenador no le llega a su propia bandeja.
  ok('lo que cancela el entrenador no se le apunta a él', /await cancelarLlamada\(l\.id\);/.test(lee('app/(trainer)/llamadas.tsx')));
  const borrar = lee('lib/firestore/eraseAccount.ts');
  ok('al borrar la cuenta se va también',
    /coleccion: 'actividadLlamadas', campo: 'clientId'/.test(borrar) && /coleccion: 'actividadLlamadas', campo: 'trainerId'/.test(borrar));
  ok('con su índice', /"collectionGroup": "actividadLlamadas"[\s\S]{0,160}"fieldPath": "cuando"/.test(lee('firestore.indexes.json')));
}

console.log('\n8. Sugerencia de progresión');
{
  ok('el tope del objetivo', topeDelObjetivo('8') === 8 && topeDelObjetivo('8-10') === 10 && topeDelObjetivo('') === null);
  ok('el objetivo subido', objetivoSubido('8', 1) === '9' && objetivoSubido('8-10', 1) === '9-11' && objetivoSubido('máx', 1) === null);
  const plan = { exerciseId: 'e', reps: '8', sets: 3 };
  const cumple = (id, dias, rir) => log(id, dias, [{ exerciseId: 'e', name: 'X', rir, sets: [serie(8), serie(9), serie(8)] }]);
  const s = sugerenciaDeProgresion([cumple('a', 2), cumple('b', 5)], plan);
  ok('dos sesiones de sobra: subir una rep', s?.reps === '9', s?.texto);
  ok('con una sola, aún no', sugerenciaDeProgresion([cumple('a', 2)], plan) === null);
  ok('si fue al fallo, no', sugerenciaDeProgresion([cumple('a', 2, 0), cumple('b', 5)], plan) === null);
  const corta = log('c', 1, [{ exerciseId: 'e', name: 'X', sets: [serie(8), serie(6), serie(8)] }]);
  ok('si una serie no llega, no', sugerenciaDeProgresion([corta, cumple('b', 5)], plan) === null);
  ok('isométrico: +5 s', sugerenciaDeProgresion([cumple('a', 2), cumple('b', 5)], { ...plan, measure: 'seconds' })?.reps === '13');
  ok('lastrado: se aconseja, no se toca', sugerenciaDeProgresion([cumple('a', 2), cumple('b', 5)], { ...plan, load: 'weighted' })?.reps === undefined);
  ok('sale en la ficha del ejercicio, con "Aplicar"', /sugerenciaDeProgresion\(logsDelAlumno, ex\)/.test(lee('app/(trainer)/clients/[id]/routine.tsx')));
}

console.log('\n9 y 10. Aplicar a varios y ver como el alumno');
{
  const r = lee('app/(trainer)/clients/[id]/routine.tsx');
  ok('"Ver como el alumno" en el editor', /<VistaDelAlumno/.test(r) && /Ver como el alumno/.test(r));
  ok('"Aplicar a otros" en el editor', /<AplicarAVarios/.test(r));
  ok('cada alumno recibe su copia con ids nuevos', /days: dias\.map\(\(d\) => \(\{\s*\.\.\.d,\s*id: nuevoId\(\)/.test(r));
  ok('y su ciclo empieza hoy', /cycleStartDate: schedule === 'cycle' \? inicioDelDia\(Date\.now\(\)\) : undefined/.test(r));
  ok('la vista agrupa las superseries como el alumno', /bloqueDe\(dia\.exercises, i\)/.test(lee('components/VistaDelAlumno.tsx')));
}

console.log('\n11. La biblioteca, por código');
{
  const c = nuevoCodigo();
  ok('seis caracteres, sin los que se confunden', c.length === LARGO_DEL_CODIGO && !/[01IOL]/.test(c), c);
  ok('lo escrito se limpia', normalizarCodigo(' ab-c 12x ') === 'ABC12X');
  ok('añadir solo los que faltan', queLeFaltan([{ name: 'Dominadas' }], [{ name: 'dominadas ' }, { name: 'Fondos' }]).map((e) => e.name).join() === 'Fondos');
  const pantalla = lee('app/(trainer)/exercises/index.tsx');
  ok('"Compartir mi biblioteca" e "Importar con un código"', /Compartir mi biblioteca/.test(pantalla) && /Importar con un código/.test(pantalla));
  ok('fuera el texto para pegar', !/Pegar plantilla/.test(pantalla));
  const reglas = lee('firestore.rules');
  ok('las reglas dejan leer con el código pero no listar', /match \/bibliotecas\/\{codigo\} \{\s*allow get: if request\.auth != null;/.test(reglas));
  ok('y se borran con la cuenta', /coleccion: 'bibliotecas'/.test(lee('lib/firestore/eraseAccount.ts')));
}

console.log('\n12 y 13. Ficha del alumno y colores');
{
  const f = lee('app/(trainer)/clients/[id]/index.tsx');
  ok('"Gestión del alumno" ya no es una sección aparte', !/title="Gestión del alumno"/.test(f) && /styles\.zonaSalida/.test(f));
  ok('+1 mes, del mismo color que los demás', /variant="secondary"\s*compacto\s*onPress=\{\(\) => fijarPeriodo\(alargar/.test(f));
  ok('colores de categoría: solo la paleta', !/normalizeHex|customColor/.test(lee('app/(trainer)/exercises/index.tsx')));
}

console.log(fallos === 0 ? '\n✔ Las siete mejoras del entrenador, en su sitio' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
