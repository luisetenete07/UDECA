import React from 'react';
import { Text as TextoDeRN, type TextProps } from 'react-native';
import { t, useIdioma  } from '../lib/idioma';
import { traducir } from '../lib/i18n';

/**
 * El `Text` de la app. Traduce solo.
 *
 * POR QUÉ ESTO Y NO `t('...')` EN CADA SITIO. La app tiene novecientas frases
 * repartidas por ciento treinta pantallas. Envolverlas una a una es tocar
 * ciento treinta ficheros, y sobre todo es un trabajo que hay que volver a
 * hacer con cada frase nueva: basta que alguien escriba un `<Text>` sin
 * envolver para que esa frase se quede en español para siempre, y nadie se
 * entera porque en español se ve perfecta. Un fallo que solo notan los
 * usuarios que no hablan tu idioma es un fallo que no se corrige nunca.
 *
 * Haciéndolo aquí, escribir `<Text>Mi entrenamiento</Text>` ya está traducido.
 * Traducir pasa a ser SOLO añadir la frase al diccionario (lib/i18n.ts), que
 * es donde tiene que estar la decisión.
 *
 * POR QUÉ ES SEGURO. La clave del diccionario es la propia frase en español:
 * lo que no está en él sale tal cual. Así que un nombre de persona, el título
 * de un curso que ha escrito el entrenador o una cifra NUNCA se traducen —no
 * están en el diccionario y no van a estarlo—. No hay forma de que esto
 * "traduzca de más".
 *
 * Y solo se toca el texto SUELTO: `<Text>Hola {nombre}</Text>` llega aquí como
 * dos trozos, y el que se busca en el diccionario es "Hola ", no el nombre.
 */
/**
 * Hasta dónde puede crecer la letra del sistema.
 *
 * En iOS y en Android se puede subir el tamaño de texto en los ajustes del
 * teléfono, y React Native lo aplica a TODO por defecto, sin tope. Con el
 * ajuste al máximo, un texto de 15 puntos se pinta a 52: un botón de 52 de alto
 * con la palabra "Borrador" dentro pasa a enseñar "Borrado" y una "r" debajo, y
 * los selectores se salen de su caja.
 *
 * No se apaga: alguien que necesita la letra grande la necesita de verdad, y
 * dejar la app clavada al tamaño de siempre es dejarla fuera. Lo que se hace es
 * poner un techo. Hasta 1,3 la app crece y sigue cuadrando; por encima, lo que
 * se rompe no es solo la estética —los textos empiezan a taparse unos a otros y
 * a salirse de los botones, y entonces no se puede usar tampoco.
 *
 * Va aquí, en el `Text` de la app, por lo mismo que la traducción: ponerlo
 * pantalla por pantalla es un trabajo que hay que repetir con cada texto nuevo,
 * y basta que a uno se le olvide para que esa pantalla se rompa. Quien de
 * verdad necesite otro techo lo pasa por prop, que gana a este.
 */
export const TOPE_DE_LETRA = 1.3;

export function Text({ children, ...resto }: TextProps) {
  const idioma = useIdioma();
  return (
    <TextoDeRN maxFontSizeMultiplier={TOPE_DE_LETRA} {...resto}>
      {idioma === 'en' ? traduceHijos(children, idioma) : children}
    </TextoDeRN>
  );
}

/**
 * Traduce los trozos de texto y deja lo demás como está.
 *
 * Se recorre el array porque una frase con un dato dentro llega partida:
 * `['Te quedan ', 3, ' días']`. Cada trozo se busca por su cuenta y el que no
 * esté en el diccionario se queda igual, que es lo que hace que esto no pueda
 * estropear nada.
 */
function traduceHijos(hijos: React.ReactNode, idioma: 'es' | 'en'): React.ReactNode {
  if (typeof hijos === 'string') return traducir(hijos, idioma);
  if (Array.isArray(hijos)) {
    return hijos.map((h, i) =>
      typeof h === 'string' ? (
        // `Fragment` con clave: sin ella, React avisa por cada trozo de cada
        // frase de la app.
        <React.Fragment key={i}>{traducir(h, idioma)}</React.Fragment>
      ) : (
        h
      )
    );
  }
  return hijos;
}
