/**
 * Los precios de UDECA, y solo los precios.
 *
 * POR QUÉ ESTÁN EN SU PROPIO FICHERO
 *
 * Por lo mismo que `planBase.ts` y `enlacesDeCobro.ts`: `subscription.ts` lee
 * `Platform.OS` en cuanto se carga, así que cualquier cosa que lo importe
 * arrastra React Native entera y no se puede ejecutar en Node pelado. Eso
 * dejaba sin comprobar los cuatro números que la web copia a mano en su HTML
 * —y una copia que nadie compara es una copia que un día dice otra cosa.
 *
 * Aquí no se importa nada, así que `scripts/check-precios.mjs` los lee de
 * verdad y comprueba que la web diga exactamente estos.
 *
 * Se reexporta todo desde `lib/subscription.ts`, así que nada de lo que ya los
 * importaba de allí tiene que cambiar.
 */

/**
 * LOS PRECIOS, EN UN SOLO SITIO.
 *
 * EL MODELO, EN DOS FRASES
 *
 *  - Hay UNA suscripción anual por rol: 240 € el entrenador, 60 € el atleta.
 *  - El primer año vale la mitad: 120 € y 30 €. Después se renueva sola al
 *    precio de siempre, y se cancela cuando se quiera.
 *
 * UN SOLO PRODUCTO POR ROL, Y ESO ES LO IMPORTANTE
 *
 * Antes había cuatro: un alta barata de entrada (27 € / 17 €) y una cuota
 * distinta para después (180 € / 96 €). Eso tenía dos fallos, y el segundo era
 * caro.
 *
 * El primero: un entrenador con doce alumnos llegaba a la web, leía "27 €,
 * hasta 5 alumnos" y se iba, porque lo que él necesitaba no estaba a la venta.
 * El mejor cliente posible, filtrado en la puerta por el escaparate.
 *
 * El segundo: 27 € y luego 180 € es un salto de casi siete veces, decidido de
 * nuevo doce meses después, con la tarjeta otra vez en la mano. Una renovación
 * así no ocurre. Todo el negocio colgaba de un momento diseñado para fallar.
 *
 * Ahora es una suscripción, se renueva sola y el salto es de 2×. Y como lo que
 * se compra no lleva cuenta de alumnos, el tope de cinco desaparece solo: el
 * plan anual es lo que mira `planIlimitado` en lib/planBase.ts.
 *
 * POR QUÉ LA MITAD Y NO UN 85 %
 *
 * Un descuento de entrada tiene que ser lo bastante grande para mover a
 * alguien y lo bastante pequeño para que la renovación no se sienta como una
 * compra nueva. Al 85 % la segunda factura es un desconocido llamando a la
 * puerta. A la mitad es lo que se había contado desde el principio.
 *
 * Y la mitad se dice en una frase que vale para los dos roles —"el primer año,
 * a mitad de precio"—, sin tener que explicar dos ofertas distintas.
 *
 * TODOS LOS MENSUALES SALEN EXACTOS
 *
 * 10,00 / 20,00 / 2,50 / 5,00. No es coquetería: 17/12 daba 1,4166… que se
 * enseñaba como 1,42, y un precio con un redondeo raro parece un error de la
 * web justo en la pantalla donde alguien decide pagar.
 *
 * DÓNDE SE ENSEÑAN Y DÓNDE NO
 *
 * En la WEB, siempre por mes y con el total anual y el precio de renovación
 * debajo: 10 €/mes se compara con lo que cuesta una hora de entrenador, y
 * 120 € de golpe no se compara con nada. Pero el total y la renovación van
 * SIEMPRE visibles, porque enseñar el mensual y cobrar el anual sin decirlo es
 * lo que hace que la gente pida la devolución y se vaya.
 *
 * En la APP, nunca (ver el bloque de "LA APP NO DICE PRECIOS" más abajo).
 */

/** Entrenador: lo que se paga la primera vez (la mitad de la cuota). */
export const COACH_FIRST_YEAR_EUR = 120;

/** Atleta: lo que se paga la primera vez (la mitad de la cuota). */
export const ATHLETE_FIRST_YEAR_EUR = 30;

/**
 * Entrenador: la cuota anual. 20,00 € al mes.
 *
 * Es el precio del producto, no "el precio de después": la suscripción es ésta
 * desde el primer día, con la primera factura a mitad.
 *
 * Para un entrenador con doce alumnos a 40 € al mes son unos 5.760 € al año de
 * facturación: esto es el 4 %. Las herramientas equivalentes cuestan varias
 * veces más. No es un precio ambicioso, es un precio serio — y eso importa
 * cuando lo que se le pide a alguien es que te confíe su cartera de clientes.
 */
export const ANNUAL_PRICE_EUR = 240;

/**
 * Atleta: la cuota anual. 5,00 € al mes.
 *
 * MÁS BARATO QUE ANTES, Y A PROPÓSITO.
 *
 * El atleta autoentrenado es lo más commoditizado que hay: compite con
 * Freeletics, con Thenx y con quinientas más. Por precio ahí no se gana dinero
 * y por funciones tampoco, con un solo desarrollador.
 *
 * Pero no es el negocio: es la puerta. Un atleta que se atasca en la muscle-up
 * es exactamente el futuro alumno de un entrenador de UDECA, y ya está dentro,
 * con su historial y su progreso. Y hay un segundo efecto que vale más: más
 * atletas es más gente en el tablón y en el ranking, y una app viva es lo que
 * hace que los alumnos de un coach no se caigan — que es lo que hace que el
 * coach renueve.
 *
 * O sea que este precio está pagando la retención del entrenador. Es de
 * alcance, no de margen; el coste marginal de un atleta más son céntimos.
 *
 * Por abajo tiene suelo: a 5 € al mes sigue siendo una decisión. Más barato
 * dejaría de significar compromiso, y quien no decide nada tampoco entrena.
 */
export const ATHLETE_ANNUAL_EUR = 60;

/**
 * Lo que sale al mes cada precio.
 *
 * CALCULADO, NUNCA ESCRITO A MANO. Un mensual escrito aparte se queda viejo el
 * día que cambie el anual, y entonces la web promete un número y la pasarela
 * cobra otro. Se redondean a dos decimales porque 27/12 son 2,25 exactos pero
 * 17/12 son 1,4166…, y en un escaparate eso es 1,42.
 */
const alMes = (anual: number): number => Math.round((anual / 12) * 100) / 100;

export const COACH_FIRST_YEAR_MONTHLY_EUR = alMes(COACH_FIRST_YEAR_EUR);
export const ATHLETE_FIRST_YEAR_MONTHLY_EUR = alMes(ATHLETE_FIRST_YEAR_EUR);
export const COACH_MONTHLY_EQUIV_EUR = alMes(ANNUAL_PRICE_EUR);
export const ATHLETE_MONTHLY_EQUIV_EUR = alMes(ATHLETE_ANNUAL_EUR);

/**
 * Lo que se ahorra el primer año frente a lo que costará después.
 *
 * CALCULADO, NUNCA ESCRITO A MANO, por lo mismo de siempre: es una proporción
 * entre dos precios, y mientras los dos cambien juntos sigue siendo verdad.
 * Escribir "85 %" a mano sería una cifra que se queda vieja en la versión que
 * el usuario no ha actualizado.
 */
export const AHORRO_PRIMER_ANO_COACH_PCT = Math.round(
  (1 - COACH_FIRST_YEAR_EUR / ANNUAL_PRICE_EUR) * 100
);
export const AHORRO_PRIMER_ANO_ATLETA_PCT = Math.round(
  (1 - ATHLETE_FIRST_YEAR_EUR / ATHLETE_ANNUAL_EUR) * 100
);
