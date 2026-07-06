/**
 * Frases motivacionales de UDECA. Se muestra una al día (rota por fecha,
 * igual para todos los miembros ese día).
 */
const QUOTES = [
  'La disciplina pesa gramos; el arrepentimiento, toneladas.',
  'No cuentes los días. Haz que los días cuenten.',
  'El cuerpo logra lo que la mente cree.',
  'Cada repetición te acerca a quien quieres ser.',
  'La constancia vence al talento cuando el talento no es constante.',
  'Hoy es un buen día para ser mejor que ayer.',
  'El dolor de hoy es la fuerza de mañana.',
  'No pares cuando estés cansado. Para cuando hayas terminado.',
  'Los campeones entrenan; los demás buscan excusas.',
  'Tu único rival es quien fuiste ayer.',
  'La calistenia no se trata del cuerpo: se trata de dominarte.',
  'Pequeños pasos diarios construyen resultados gigantes.',
  'La fuerza no viene de ganar. Viene de no rendirse.',
  'Si fuera fácil, cualquiera lo haría.',
  'Entrena en silencio. Que tus resultados hagan el ruido.',
  'El mejor proyecto en el que trabajarás jamás eres tú.',
  'No se trata de tener tiempo, sino de crear el hábito.',
  'Caer está permitido. Levantarse es obligatorio.',
  'Un año de excusas o un año de progreso: tú eliges.',
  'La motivación te arranca; el hábito te mantiene.',
  'Cuando quieras rendirte, recuerda por qué empezaste.',
  'Cada día que entrenas, ganas la batalla más importante.',
  'El éxito es la suma de esfuerzos pequeños repetidos cada día.',
  'Tu futuro yo te está mirando a través de los ojos del presente.',
  'No existe el fracaso: o ganas o aprendes.',
  'Hazlo con miedo, pero hazlo.',
  'La barra no sabe de excusas.',
  'Domina tu cuerpo y dominarás tu mente.',
];

export function quoteOfTheDay(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
