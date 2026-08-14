# Subir UDECA a las tiendas

Los tres formatos —web, Play Store y App Store— salen del **mismo código**.
No hay que preparar nada a mano: están montados como acciones de GitHub, así
que se lanzan con un clic desde el navegador y compilan en la nube. No hace
falta Mac, ni Android Studio, ni Xcode.

Aquí está solo lo que hay que hacer. El porqué de cada decisión está en los
comentarios de los ficheros correspondientes.

---

## 1. La web (app.udeca.app)

**No hay que hacer nada.** Cada vez que se sube código a la rama de desarrollo,
la acción `Deploy app to GitHub Pages` compila la app y la publica sola.

Comprobar que ha ido bien: pestaña **Actions** del repositorio → el último
`Deploy app to GitHub Pages` en verde. Tarda unos cinco minutos.

Si hace falta relanzarla sin subir código: Actions → *Deploy app to GitHub
Pages* → **Run workflow**.

---

## 2. Play Store (Android)

1. Actions → **Build Android (AAB)** → *Run workflow*.
2. Espera (entre 15 y 30 minutos). Al terminar, EAS deja el enlace de descarga
   del `.aab` en el registro de la acción y también en
   [expo.dev](https://expo.dev) → proyecto `udeca` → *Builds*.
3. Descarga el `.aab` y súbelo en Play Console → *Producción* → *Crear nueva
   versión*.

La primera versión de una app **hay que subirla a mano** aunque queramos
automatizarlo después: Google no acepta la primera por API. A partir de la
segunda se puede automatizar con una cuenta de servicio.

---

## 3. App Store (iPhone)

1. Actions → **Build iOS (App Store)** → *Run workflow*.
2. Espera. Esta acción compila **y sube sola** el build a App Store Connect: no
   hay que descargar nada.
3. Entra en App Store Connect → *TestFlight* (aparece en 10-15 minutos, tras el
   procesado de Apple) → y de ahí a *Enviar a revisión*.

---

## Lo que hace falta tener puesto una sola vez

Son secretos del repositorio (Settings → Secrets and variables → Actions). Ya
están puestos; esto es por si hay que rehacerlos algún día.

| Secreto | Para qué | De dónde sale |
|---|---|---|
| `EXPO_TOKEN` | Que las acciones puedan compilar en EAS | expo.dev → Account settings → Access tokens |
| `ASC_API_KEY_P8` | Que iOS se firme y se suba sin Mac ni contraseña de Apple | App Store Connect → Users and Access → Integrations → App Store Connect API |

**El `.p8` no se guarda nunca en el repositorio.** La acción lo reconstruye
desde el secreto justo antes de compilar y lo borra al terminar. Si alguna vez
aparece un `asc-key.p8` en un commit, hay que revocar esa clave en App Store
Connect y generar otra: con ella cualquiera puede subir builds a nombre de
UDECA.

---

## Antes de dar a compilar

- **Los tipos y las comprobaciones tienen que estar en verde.** La acción
  `Verificar` lo hace sola en cada push: tipos, módulos nativos, las
  comprobaciones del producto y el empaquetado web. Si está en rojo, el build
  de tienda también saldrá mal, solo que media hora más tarde.
- **Si se ha tocado `app.json`, hay que compilar de nuevo.** Los permisos, los
  iconos y los plugins viven en el proyecto nativo, y ese solo se regenera al
  compilar. Cambiar un texto de permiso y publicar solo la web no cambia nada
  en el móvil.
- **La versión la lleva EAS.** En `eas.json`, el perfil de producción tiene
  `autoIncrement`, así que el número de build sube solo en cada compilación. El
  número que ve el usuario (`version` en `app.json`, hoy `1.0.0`) se sube a
  mano cuando toque.

---

## Un detalle pendiente, para tenerlo presente

El identificador de la app **no es el mismo en las dos tiendas**:

- iPhone: `com.udeca.app`
- Android: `entrenadores.app`

Funciona perfectamente así, pero conviene saberlo: en Play, el identificador no
se puede cambiar una vez publicada la app. Si se quiere unificar a
`com.udeca.app`, hay que hacerlo **antes** de la primera publicación en Play;
después, cambiarlo significa una app nueva, con sus descargas y sus reseñas a
cero.
