/**
 * La marca con la que se dibujan las tarjetas que se comparten (lib/brandCards.ts).
 *
 * Esas tarjetas se pintan fuera de React —en un lienzo, o en un WebView en el
 * móvil— y no pueden preguntarle al contexto de la sesión. Así que la sesión
 * (lib/auth-context.tsx) deja aquí la marca y el logo de quien mira, y las
 * tarjetas los leen al dibujar.
 *
 * `marca` vacía = la de UDECA, con su "Universidad de Calistenia" de siempre.
 */
export interface MarcaActual {
  marca: string;
  logo: string | null;
}

let actual: MarcaActual = { marca: '', logo: null };

export function fijarMarcaActual(m: MarcaActual): void {
  actual = m;
}

export function marcaActual(): MarcaActual {
  return actual;
}
