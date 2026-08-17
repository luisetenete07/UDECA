import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from '../lib/auth-context';

/**
 * La puerta por la que vuelve Google.
 *
 * POR QUÉ EXISTE ESTA PANTALLA
 *
 * Al entrar con Google en el móvil, la app abre el navegador y le dice a Google
 * a qué dirección devolver la respuesta. Esa dirección la construye
 * `expo-auth-session`, y en este proyecto sale así:
 *
 *     udeca://oauthredirect?state=...&code=...
 *
 * Cuando Google termina, Android abre la app con ese enlace. Y ahí estaba el
 * problema: el enlace lo recibe TAMBIÉN expo-router, que hace lo que hace
 * siempre con un enlace —buscar la pantalla que le corresponde—. Como no había
 * ninguna pantalla llamada `oauthredirect`, enseñaba su pantalla de ruta
 * desconocida:
 *
 *     Unmatched Route — Page could not be found.
 *
 * El acceso en sí iba bien (el `code` de Google llegaba entero, se ve en la
 * propia pantalla del error), pero el usuario se quedaba mirando un callejón
 * sin salida en inglés.
 *
 * Así que la pantalla existe para que el enlace tenga a dónde llegar. No hace
 * nada por su cuenta: espera a que la sesión termine de abrirse y manda a la
 * raíz, que es quien ya sabe repartir a cada uno a su sitio (`app/index.tsx`:
 * al panel si tiene perfil, a completarlo si entró con Google por primera vez,
 * o a la pantalla de entrar si al final no hubo sesión).
 *
 * EL MARGEN DE ESPERA no es un adorno. Cuando Google devuelve el control, aún
 * queda un viaje: cambiar ese `code` por la identidad y abrir la sesión de
 * Firebase. Durante esos segundos no hay usuario todavía, y mandar a la raíz en
 * ese instante devolvería a la pantalla de entrar a alguien que acaba de entrar
 * bien. Se espera a que aparezca la sesión, con un tope para no dejar a nadie
 * mirando un giro infinito si de verdad falló.
 */
const ESPERA_MAXIMA_MS = 8000;

export default function OAuthRedirect() {
  const { loading, firebaseUser } = useAuth();
  const [seAgotoLaEspera, setSeAgotoLaEspera] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSeAgotoLaEspera(true), ESPERA_MAXIMA_MS);
    return () => clearTimeout(t);
  }, []);

  // En cuanto hay sesión, fuera de aquí: esta pantalla no es un sitio donde
  // quedarse.
  if (!loading && firebaseUser) return <Redirect href="/" />;
  // Y si pasado el margen sigue sin haberla, también: la raíz llevará a la
  // pantalla de entrar, que es un sitio del que se puede salir.
  if (seAgotoLaEspera) return <Redirect href="/" />;

  return <LoadingScreen label="Entrando..." />;
}
