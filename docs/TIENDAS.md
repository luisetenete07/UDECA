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

## Si un build falla

Los dos primeros fallos que dio esto, por si vuelven:

**iOS: "Provisioning profile doesn't include the Sign In with Apple
capability".** Al añadir "Entrar con Apple", el perfil de aprovisionamiento
tiene que llevar esa capacidad, y quien la añade es EAS hablando con Apple. No
podía: le faltaba el Team ID y lo pedía por pantalla, cosa que en una acción no
existe. Va puesto en el workflow (`EXPO_APPLE_TEAM_ID`, `EXPO_APPLE_TEAM_TYPE`).
Si algún día cambias de cuenta de desarrollador de Apple, hay que cambiarlo
ahí.

**Apple avisa de "ITMS-90863: Macs with Apple silicon support issue".** No es
un rechazo: el build se sube igual y se puede enviar a revisión. Lo que dice es
que la app aparecería también en Macs con Apple silicon (Apple lo activa por
defecto para toda app de iPhone) y ahí no arrancaría, porque React Native usa
librerías que en macOS no existen. La app no está pensada para Mac, así que la
solución es no ofrecerla en Mac:

> App Store Connect → UDECA → **Pricing and Availability** → en la lista de
> plataformas, desmarcar **Mac con Apple silicon**. Se guarda y ya está.

No se arregla desde el código: es un ajuste de la ficha, no del binario. Y
conviene hacerlo antes de publicar: si sale en Mac, quien la instale ahí verá
una app que se cierra al abrirse, y esa reseña cuenta igual que las demás.

**Android: "Gradle build failed with unknown error".** Lo que había detrás era
esto, por si vuelve a asomar:

    :expo-modules-core:lintVitalAnalyzeRelease FAILED
    > Unexpected failure during lint analysis of Logger.kt
      Message: Metaspace
      Stack: OutOfMemoryError...

La JVM de Gradle se quedaba sin memoria para cargar clases mientras Lint
recorría expo-modules-core. Lo arregla `plugins/memoria-de-gradle.js`, que sube
esa memoria al generar el proyecto. Si alguien lo quita de `app.json`, la
comprobación `check-gradle` lo canta antes de compilar.

Detrás de ese había un segundo, tapado por el primero:

    :app:lintVitalRelease FAILED
    > "NSPhotoLibraryUsageDescription" is translated here but not found in
      default locale [ExtraTranslation]

Los textos de permiso traducidos (`locales/es.json`, `locales/en.json`) iban en
la raíz del fichero, y así se los lleva **también** Android, que los escribe en
`values-b+en/strings.xml`. Como no existen en el idioma por defecto, Lint los da
por errores fatales. Son textos de iOS, así que van anidados bajo una clave
`ios`; entonces iOS los recibe y Android no ve nada. Lo vigila
`check-permisos`.

El detalle de cualquier otro fallo de Gradle no sale en la acción de GitHub,
sale en EAS: abre el enlace `See logs:` que aparece en el registro y mira la
fase **Run gradlew**.

Si no puedes entrar en Expo en ese momento, la acción *Build Android (AAB)*
tiene un interruptor: al lanzarla, marca **"Compilar aquí en vez de en EAS"**.
Tarda más y el .aab que sale no vale para publicar, pero escupe el registro
entero de Gradle en el propio GitHub, con la línea que dice qué falla.

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
