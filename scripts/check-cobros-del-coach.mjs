/*
 * La sección de cobros del inicio del entrenador.
 *
 * Tres cosas nuevas que, si se rompen, no dan error: el ojo que tapa los
 * importes, los cobros de quien todavía no está en la app, y el borrado de la
 * ficha de un pagador.
 *
 * EL OJO ES EL MÁS TRAICIONERO. Tapar la cifra grande y dejar destapada la del
 * resumen plegado —o la cuota del próximo cobro— no es taparlo a medias: es no
 * taparlo, porque quien mira por encima del hombro ve lo que se ha dejado.
 * Nadie se entera de eso hasta que pasa delante de un alumno.
 *
 * La lógica vive suelta en lib/cobrosExternos.ts, lib/cobros.ts y
 * lib/ocultarIngresos.ts. La pantalla se lee como texto: arrastra React Native.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-cobros-del-coach.mjs
 */
import { readFileSync } from 'node:fs';
import { repartoDelMes } from '../lib/cobros.ts';
import {
  LARGO_DEL_NOMBRE,
  PREFIJO_EXTERNO,
  cobroValido,
  esPagadorExterno,
  idDePagadorExterno,
  importeEscrito,
  limpiarNombreDePagador,
  nombreDelPagador,
} from '../lib/cobrosExternos.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(ruta, 'utf8');
const sinComentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\nLo cobrado frente a lo que tocaba');
{
  const r = repartoDelMes(45, 45);
  ok('suma las dos partes', r.total === 90);
  ok('y saca la proporción', r.porcentaje === 0.5, String(r.porcentaje));
  // Sin nada cobrado ni pendiente, cero. NUNCA NaN: un NaN en un `width: '%'`
  // no deja una barra a cero, deja una barra rota.
  ok('sin datos, cero y no NaN', repartoDelMes(0, 0).porcentaje === 0);
  ok('y un negativo no cuenta', repartoDelMes(-10, 50).cobrado === 0);
  ok('todo cobrado es el 100%', repartoDelMes(80, 0).porcentaje === 1);
}

console.log('\nCobros de quien no está en la app');
{
  ok('el nombre se limpia', limpiarNombreDePagador('  Ana   Gil  ') === 'Ana Gil');
  ok(`y se corta a ${LARGO_DEL_NOMBRE}`, limpiarNombreDePagador('x'.repeat(99)).length === LARGO_DEL_NOMBRE);

  // DETERMINISTA: los tres cobros de Ana tienen que caer en UNA ficha. Con un
  // id al azar por cobro, Ana saldría tres veces en el histórico y la lista
  // dejaría de servir para lo que sirve.
  ok('el mismo nombre da el mismo id', idDePagadorExterno('Ana Gil') === idDePagadorExterno('  ana   gil '));
  ok('sin tildes, el mismo', idDePagadorExterno('José') === idDePagadorExterno('Jose'));
  ok('y dos personas distintas, distinto', idDePagadorExterno('Ana') !== idDePagadorExterno('Luis'));
  ok('lleva el prefijo', idDePagadorExterno('Ana').startsWith(PREFIJO_EXTERNO));
  // Los uid de Firebase no llevan dos puntos: no hay forma de que choquen.
  ok('y se distingue de un alumno de verdad', esPagadorExterno(idDePagadorExterno('Ana')) && !esPagadorExterno('cWEr01L8a0Kk'));

  // MANDA EL PERFIL si existe: si esa persona acabó entrando en la app y se
  // cambió el nombre, el histórico dice el de ahora, no el de hace seis meses.
  ok('el nombre lo manda el perfil', nombreDelPagador({ clientId: 'x', clientName: 'Viejo' }, { name: 'Nuevo' }) === 'Nuevo');
  ok('y sin perfil, el guardado', nombreDelPagador({ clientId: 'x', clientName: 'Ana Gil' }, null) === 'Ana Gil');
  ok('y sin nada, algo legible', nombreDelPagador({ clientId: 'x' }, null) === 'Cliente');

  // La coma del teclado español. Rechazar "12,50" sería culpar al usuario del
  // teclado que tiene.
  ok('la coma vale como decimal', importeEscrito('35,50') === 35.5);
  ok('y el punto también', importeEscrito('35.50') === 35.5);
  ok('un cobro de 0 € no es un cobro', !cobroValido('Ana', 0));
  ok('ni uno sin nombre', !cobroValido('   ', 20));
  ok('uno bueno sí', cobroValido('Ana', 35.5));
}

console.log('\nEl ojo no se deja nada sin tapar');
{
  const panel = sinComentar(lee('app/(trainer)/dashboard.tsx'));
  ok('hay ojo', /name=\{ocultos \? 'eye-off-outline' : 'eye-outline'\}/.test(panel));
  ok('y se recuerda en el aparato', /guardarIngresosOcultos\(siguiente\)/.test(panel));
  /*
   * EL HOOK, ARRIBA DEL TODO. En esta pantalla hay un `return` para el
   * esqueleto de carga, y un `useEffect` por debajo se ejecuta unas veces sí y
   * otras no: React cuenta los hooks y revienta la pantalla entera con el
   * error 310. Pasó al escribir esto.
   */
  const hastaElReturn = panel.slice(0, panel.indexOf('if (loading) {'));
  ok('y su hook va antes del return de carga', /ingresosOcultos\(\)\.then\(setOcultos\)/.test(hastaElReturn));

  // Los cuatro sitios donde hay un importe. Que falte uno es no tapar nada.
  ok('tapa la cifra grande', /ocultos \? \(\s*<Text style=\{styles\.cobroCifra\}>•••/.test(panel));
  ok('tapa lo pendiente y lo previsto', (panel.match(/euros\(cobros\./g) || []).length >= 2);
  ok('tapa el resumen de la tarjeta plegada', /ocultos\s*\?\s*frase`\$\{cobros\.aReclamar\.length\} pendiente/.test(panel));
  ok('y la cuota del próximo cobro', /importeVisible\(cobros\.proximoCobro\.monthlyFeeEur, ocultos\)/.test(panel));
}

console.log('\nRegistrar y borrar, donde se usan');
{
  const panel = lee('app/(trainer)/dashboard.tsx');
  ok('se puede registrar un cobro de fuera', /registrarCobroExterno/.test(panel));
  ok('con el nombre guardado dentro del pago', /clientName: nombre/.test(panel));
  ok('y se puede borrar la ficha entera', /borrarFichaDeCobros/.test(panel));
  // El aviso tiene que decir qué NO se borra: alguien que lee "borrar" sobre
  // el nombre de un alumno suyo puede pensar que lo echa del grupo.
  ok(
    'avisando de que no borra a nadie del grupo',
    /no borra a nadie de tu grupo/.test(panel)
  );
  ok(
    'y el borrado va por pagador, no de uno en uno',
    /deletePaymentsOfPayer\(profile\.uid, clientId\)/.test(panel)
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
