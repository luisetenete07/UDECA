/*
 * Los precios: los de verdad están en lib/precios.ts y la web tiene que decir
 * esos mismos.
 *
 * POR QUÉ ESTO EXISTE
 *
 * El precio vive en DOS sitios que no pueden importarse entre sí: las
 * constantes de la app —que es lo que usan el servidor y los avisos— y el HTML
 * de la web, escrito a mano porque es una página estática sin compilar. El día
 * que se cambie uno y no el otro no falla nada: la página sigue cargando, el
 * botón sigue abriendo Stripe, y lo único que pasa es que alguien lee un precio
 * y se le cobra otro. Eso no se descubre probando; se descubre cuando alguien
 * pide que se le devuelva el dinero.
 *
 * Y hay una cuenta más que se rompe sola: el titular de la web es el precio POR
 * MES y el total del año va en pequeño debajo. Son dos cifras que tienen que
 * cuadrar entre sí, y la de arriba sale de dividir la de abajo. Cambiar el
 * total y olvidar el mensual deja la página anunciando un descuento que no
 * existe.
 *
 * QUÉ SE COMPRUEBA
 *
 *  1. Que los cuatro precios del modelo estén escritos y en el orden que tiene
 *     sentido (el primer año por debajo de la renovación).
 *  2. Que la web diga exactamente esas cifras, con su equivalente mensual bien
 *     calculado.
 *  3. Que no quede ni rastro de los precios viejos (1 € de alta, 28 días de
 *     prueba, 10 €/mes del atleta).
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-precios.mjs
 */
import { readFileSync } from 'node:fs';
import {
  AHORRO_PRIMER_ANO_ATLETA_PCT,
  AHORRO_PRIMER_ANO_COACH_PCT,
  ANNUAL_PRICE_EUR,
  ATHLETE_ANNUAL_EUR,
  ATHLETE_FIRST_YEAR_EUR,
  ATHLETE_FIRST_YEAR_MONTHLY_EUR,
  ATHLETE_MONTHLY_EQUIV_EUR,
  COACH_FIRST_YEAR_EUR,
  COACH_FIRST_YEAR_MONTHLY_EUR,
  COACH_MONTHLY_EQUIV_EUR,
} from '../lib/precios.ts';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const lee = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const web = lee('web/index.html');

/**
 * Un importe como lo escribe la web: coma decimal, y con DOS cifras cuando hay
 * céntimos.
 *
 * Lo de las dos cifras no es un detalle: esto escribía "2,5 €" y la web —bien—
 * pone "2,50 €", así que el guardián daba por ausente un precio que estaba
 * puesto y correcto. Un precio con un solo decimal no se escribe así en ningún
 * escaparate; el que estaba mal era el comprobador.
 */
const euros = (n) => `${(Number.isInteger(n) ? String(n) : n.toFixed(2)).replace('.', ',')} €`;

// =========================================================================
console.log('\n1 · Los cuatro precios del modelo');
// =========================================================================
ok('el primer año del entrenador son 120 €', COACH_FIRST_YEAR_EUR === 120, String(COACH_FIRST_YEAR_EUR));
ok('el primer año del atleta son 30 €', ATHLETE_FIRST_YEAR_EUR === 30, String(ATHLETE_FIRST_YEAR_EUR));
ok('la cuota del entrenador son 240 €', ANNUAL_PRICE_EUR === 240, String(ANNUAL_PRICE_EUR));
ok('la cuota del atleta son 60 €', ATHLETE_ANNUAL_EUR === 60, String(ATHLETE_ANNUAL_EUR));
// EXACTAMENTE la mitad, no "más o menos la mitad". Toda la web lo anuncia con
// una sola frase —"el primer año, a mitad de precio"— y esa frase solo puede
// escribirse si la cuenta sale. Con 119 o con 121 habría que redactar otra.
ok('el primer año del entrenador es la mitad', COACH_FIRST_YEAR_EUR * 2 === ANNUAL_PRICE_EUR);
ok('el primer año del atleta es la mitad', ATHLETE_FIRST_YEAR_EUR * 2 === ATHLETE_ANNUAL_EUR);
// Un profesional no puede pagar casi lo mismo que un consumidor: si esto se
// acerca, el escaparate deja de decir que son dos productos distintos.
ok('el plan de entrenador vale bastante más que el de atleta', ANNUAL_PRICE_EUR >= ATHLETE_ANNUAL_EUR * 3);
// Entrar tiene que costar menos que quedarse: es la promesa entera del primer
// año. Si alguna vez dejara de cumplirse, la web estaría mintiendo sola.
ok('entrar cuesta menos que renovar (entrenador)', COACH_FIRST_YEAR_EUR < ANNUAL_PRICE_EUR);
ok('entrar cuesta menos que renovar (atleta)', ATHLETE_FIRST_YEAR_EUR < ATHLETE_ANNUAL_EUR);

// =========================================================================
console.log('\n2 · El precio por mes sale de dividir el año, no de la cabeza');
// =========================================================================
ok(
  `el primer año del entrenador son ${euros(COACH_FIRST_YEAR_MONTHLY_EUR)} al mes`,
  COACH_FIRST_YEAR_MONTHLY_EUR === Math.round((COACH_FIRST_YEAR_EUR / 12) * 100) / 100,
  String(COACH_FIRST_YEAR_MONTHLY_EUR)
);
ok(
  `el primer año del atleta son ${euros(ATHLETE_FIRST_YEAR_MONTHLY_EUR)} al mes`,
  ATHLETE_FIRST_YEAR_MONTHLY_EUR === Math.round((ATHLETE_FIRST_YEAR_EUR / 12) * 100) / 100,
  String(ATHLETE_FIRST_YEAR_MONTHLY_EUR)
);
// Los dos redondos no son casualidad: 180/12 son 15 y 96/12 son 8 exactos, y
// un titular con decimales se lee peor. Si alguna vez dejan de serlo, la web
// tendrá que escribir "7,92 € al mes" y conviene enterarse aquí.
ok('la cuota del entrenador son 20 € al mes', COACH_MONTHLY_EQUIV_EUR === 20);
ok(
  `la cuota del atleta son ${euros(ATHLETE_MONTHLY_EQUIV_EUR)} al mes`,
  ATHLETE_MONTHLY_EQUIV_EUR === 5 &&
    ATHLETE_MONTHLY_EQUIV_EUR === Math.round((ATHLETE_ANNUAL_EUR / 12) * 100) / 100,
  String(ATHLETE_MONTHLY_EQUIV_EUR)
);
// LOS CUATRO, SIN DECIMALES RAROS. 17/12 daba 1,4166… y la web enseñaba 1,42:
// un precio con un redondeo así parece un fallo de la página justo donde
// alguien decide pagar. Si un precio nuevo rompe esto, se elige otro precio.
for (const [que, n] of [
  ['el primer año del entrenador', COACH_FIRST_YEAR_MONTHLY_EUR],
  ['el primer año del atleta', ATHLETE_FIRST_YEAR_MONTHLY_EUR],
  ['la cuota del entrenador', COACH_MONTHLY_EQUIV_EUR],
  ['la cuota del atleta', ATHLETE_MONTHLY_EQUIV_EUR],
]) {
  ok(`${que} cae en un mensual redondo (${euros(n)})`, Math.round(n * 2) === n * 2, String(n));
}

// =========================================================================
console.log('\n3 · Y la web dice exactamente eso');
// =========================================================================
const enLaWeb = [
  [`${euros(COACH_FIRST_YEAR_MONTHLY_EUR)}`, 'el mensual del primer año del entrenador'],
  [`${euros(ATHLETE_FIRST_YEAR_MONTHLY_EUR)}`, 'el mensual del primer año del atleta'],
  [`${COACH_FIRST_YEAR_EUR} €`, 'el total del primer año del entrenador'],
  [`${ATHLETE_FIRST_YEAR_EUR} €`, 'el total del primer año del atleta'],
  [`${ANNUAL_PRICE_EUR} €`, 'la renovación del entrenador'],
  [`${ATHLETE_ANNUAL_EUR} €`, 'la renovación del atleta'],
  [`${COACH_MONTHLY_EQUIV_EUR} €`, 'el mensual de la renovación del entrenador'],
  [`${euros(ATHLETE_MONTHLY_EQUIV_EUR)}`, 'el mensual de la renovación del atleta'],
];
for (const [texto, que] of enLaWeb) {
  ok(`${que} (${texto})`, web.includes(texto), 'no está escrito en web/index.html');
}

// El ahorro que anuncia la web tiene que ser el que sale de los precios. Es el
// número más fácil de dejar viejo: se escribe una vez y nadie lo recalcula.
{
  const anunciados = [...web.matchAll(/(\d{1,2})\s*%/g)].map((m) => Number(m[1]));
  const validos = new Set([AHORRO_PRIMER_ANO_ATLETA_PCT, AHORRO_PRIMER_ANO_COACH_PCT]);
  const raros = anunciados.filter((n) => !validos.has(n));
  ok(
    `los porcentajes de la web salen de los precios (${[...validos].join(' / ')})`,
    raros.length === 0,
    `sobra(n): ${raros.join(', ')}`
  );
}

// =========================================================================
console.log('\n4 · Y no queda ni rastro de los precios viejos');
// =========================================================================
const VIEJOS = [
  ['1 € de alta', /1\s*€\s*de alta/],
  ['darme de alta por 1 €', /de alta · 1 €/],
  ['los 28 días de prueba', /28 días/],
  ['el tope de cinco alumnos', /(hasta|tope de)\s*5\s*alumnos/i],
  ['la promesa de que no se renueva sola', /sin renovación autom/i],
];
for (const [que, re] of VIEJOS) {
  ok(`sin ${que}`, !re.test(web), 'sigue en web/index.html');
}

// =========================================================================
console.log('\n5 · La renovación se dice ANTES del botón, no después');
// =========================================================================
/*
 * Esto no es estilo, es lo que separa un cobro de una reclamación.
 *
 * La web decía "sin renovación automática" cuando el cobro era único. Ahora se
 * renueva sola, y esa frase pasaría de ser una virtud a ser mentira — la clase
 * de mentira que convierte una renovación normal en una devolución y en una
 * reseña de una estrella. Además, vendiendo a consumidores en la UE hay que
 * informar del precio de renovación antes de cobrar.
 *
 * Se comprueba por tarjeta: dentro de cada `<article class="plan">`, que el
 * precio de renovación aparezca ANTES del botón de pagar.
 */
{
  const tarjetas = [...web.matchAll(/<article class="plan[^"]*"[\s\S]*?<\/article>/g)].map((m) => m[0]);
  ok('hay dos tarjetas de plan', tarjetas.length === 2, String(tarjetas.length));
  for (const tarjeta of tarjetas) {
    const esAtleta = /data-pago="altaAtleta"/.test(tarjeta);
    const quien = esAtleta ? 'atleta' : 'entrenador';
    const cuota = esAtleta ? ATHLETE_ANNUAL_EUR : ANNUAL_PRICE_EUR;
    const antesDelBoton = tarjeta.slice(0, tarjeta.indexOf('data-pago='));
    ok(`${quien}: la cuota (${cuota} €) se dice antes de pulsar`, antesDelBoton.includes(`${cuota} €`));
    ok(`${quien}: y se avisa de que se renueva sola`, /se renueva sola/i.test(tarjeta));
    ok(`${quien}: y de que se puede cancelar`, /cancelas cuando quieras/i.test(tarjeta));
  }
}

// =========================================================================
console.log('\n6 · Y no hay NINGÚN importe que no salga de lib/precios.ts');
// =========================================================================
/*
 * ESTO ES LO QUE FALTABA, Y SE NOTÓ.
 *
 * Los apartados de arriba comprueban que los precios NUEVOS estén escritos en
 * la web. Eso no dice nada de los viejos. Al pasar de 17/27 a 30/120, la
 * portada se quedó con "1,42 €/mes atleta · 2,25 €/mes entrenador" y con "5
 * alumnos incluidos" en las cifras grandes, y el guardián lo dio por bueno:
 * los números nuevos SÍ estaban... más abajo.
 *
 * O sea que lo primero que leía un visitante era la lista de precios anterior.
 * No hay error que salte, no hay página rota: solo una portada que promete un
 * precio y una pasarela que cobra otro, que es exactamente lo que este fichero
 * existe para impedir.
 *
 * Así que ahora se recorren TODOS los importes en euros de la página y cada uno
 * tiene que ser uno de los del modelo, o una cifra que no es un precio (el 0 €
 * de los alumnos). Un precio nuevo que no esté en esta lista salta aquí, y
 * añadirlo obliga a mirarlo.
 */
{
  const PERMITIDOS = new Set(
    [
      COACH_FIRST_YEAR_EUR,
      ATHLETE_FIRST_YEAR_EUR,
      ANNUAL_PRICE_EUR,
      ATHLETE_ANNUAL_EUR,
      COACH_FIRST_YEAR_MONTHLY_EUR,
      ATHLETE_FIRST_YEAR_MONTHLY_EUR,
      COACH_MONTHLY_EQUIV_EUR,
      ATHLETE_MONTHLY_EQUIV_EUR,
      // Lo que pagan los alumnos de un entrenador. No es un precio: es el
      // argumento de venta más fuerte que hay en la página.
      0,
    ].map((n) => euros(n))
  );

  const encontrados = [...web.matchAll(/\d+(?:,\d+)?\s*€/g)].map((m) =>
    m[0].replace(/\s+/g, ' ').trim()
  );
  const intrusos = [...new Set(encontrados)].filter((e) => !PERMITIDOS.has(e));
  ok(
    `los ${new Set(encontrados).size} importes de la web salen de lib/precios.ts`,
    intrusos.length === 0,
    `no es ningún precio del modelo: ${intrusos.join(', ')}`
  );
}

console.log(fallos === 0 ? '\n✔ La web cobra lo que dice y dice lo que cobra' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
