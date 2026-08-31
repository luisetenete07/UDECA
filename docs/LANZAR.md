# Lanzar una versión, tú solo

Todo se hace desde el navegador. No hace falta Mac, ni Android Studio, ni Xcode,
ni instalar nada. Este documento se basta a sí mismo: si sigues los pasos en
orden, sale.

---

## 0 · Lo que tienes que saber antes de tocar nada

**La rama.** El código vive en `claude/calisthenics-coaching-app-o72apc`. El
repositorio tiene otras dos ramas (`claude/udeca-redesign-pse2l4`, que es
antigua, y `gh-pages`, que es la web ya publicada), y **el desplegable de "Run
workflow" te las ofrece todas**. Si eliges la que no es, compilarás código viejo
y no lo notarás hasta tenerlo en el móvil. Es el error más caro de esta lista.

**La versión.** `1.0.1`, en `app.json`. El número de compilación (35, 36, 37…)
lo sube EAS solo en cada build; ese no se toca. El de la versión sí se sube a
mano, y solo cuando quieras obligar a actualizar (ver el paso 5).

**Lo que hay hoy en las tiendas no vale.** La 1.0.1 (35) de iPhone y el `.aab`
con versionCode 22 son del 27 de agosto. No llevan el arreglo del borrado de
cuenta, ni los permisos que Play rechazó, ni nada de lo posterior. **No los
envíes a revisión.**

---

## 1 · Comprobar que Expo deja compilar

Las compilaciones se agotaron el 28 de agosto y el plan gratuito se reinicia el
día 1 de cada mes. Para saber si ya puedes:

> [expo.dev](https://expo.dev) → tu cuenta (`luistenafits-team`) → **Settings →
> Billing**

Si pone que quedan builds, adelante. Si no, o esperas al día 1 o subes de plan
ahí mismo. No hay tercera vía: iOS solo se puede compilar en un Mac, y EAS es
nuestro Mac.

---

## 2 · Compilar

En GitHub, pestaña **Actions** (arriba, junto a "Code").

### Android

1. En la lista de la izquierda: **Build Android (AAB)**.
2. Botón **Run workflow** (arriba a la derecha).
3. **Use workflow from** → elige **`claude/calisthenics-coaching-app-o72apc`**.
   No lo des por hecho: mira que ponga eso.
4. Deja el interruptor de "Compilar aquí" **apagado**. Ese es solo para ver
   errores; el `.aab` que saca no vale para publicar.
5. **Run workflow**.

### iPhone

Lo mismo con **Build iOS (App Store)**, eligiendo otra vez la rama.

Las dos tardan entre 10 y 45 minutos según la cola de Expo. Mientras salen, en
la ejecución verás los pasos en verde; el largo se llama "Compilar en EAS".

**Si una falla**, abre la ejecución y lee el final del registro. Casi siempre
dice una de estas dos cosas:

- `You've reached your included build credits` → no es un fallo del código, es
  el tope de Expo. Vuelve al paso 1.
- `Gradle build failed` → el detalle no está en GitHub, está en Expo: abre el
  enlace `See logs:` del registro y mira la fase **Run gradlew**.

---

## 3 · Android: subir el `.aab` a Play Console

El `.aab` lo guarda Expo. Tienes dos formas de bajarlo; la segunda es más corta.

**Desde Expo:** [expo.dev](https://expo.dev) → proyecto `udeca` → **Builds** →
la primera de Android → **Download**.

**Desde GitHub:** Actions → **Bajar el ultimo .aab** → *Run workflow* (con la
rama correcta) → cuando termine, abre la ejecución y baja el adjunto de la
sección **Artifacts**. Ojo: **viene dentro de un `.zip`**. Descomprímelo y sube
el `udeca.aab` de dentro, no el zip.

Ya en **Play Console**:

1. **Producción** → **Crear nueva versión**.
2. Sube el `.aab`. El `versionCode` sube solo, así que entra por encima del
   anterior sin tocar nada.
3. Notas de la versión.
4. **Guardar** → **Revisar versión** → **Iniciar lanzamiento**.

---

## 4 · iPhone: elegir la compilación y enviar

Aquí no hay que descargar nada: la acción **sube el `.ipa` sola** a App Store
Connect. Solo hay que esperar a que Apple lo procese (de 10 a 30 minutos) y
elegirlo.

En [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → UDECA:

1. **Distribución** → **App para iOS → 1.0.1**.
2. Baja al bloque **Compilación** → **+** → elige la que acaba de subir (la del
   número más alto).
3. Comprueba que la ficha sigue completa: capturas, descripción, notas del
   revisor, y **"Se requiere iniciar sesión" DESMARCADA** (UDECA entra con
   Google y Apple; no hay usuario ni contraseña que dar).
4. **Añadir para revisión** → **Enviar**.

Si la compilación no aparece en el desplegable: o Apple sigue procesándola
(**TestFlight** te lo dice), o falta el cuestionario de cifrado. Si te lo
pregunta: **no**, la app no usa cifrado más allá del HTTPS de siempre.

---

## 5 · Cuando ya esté publicada en las dos, y NO antes

Para sacar a todo el mundo de las versiones viejas:

> [console.firebase.google.com](https://console.firebase.google.com) → tu
> proyecto → **Firestore Database** → pestaña **Datos** → colección `config` →
> documento **`version`** → campo **`minima`**, tipo **string**, valor
> **`1.0.1`**

Hace efecto en cuanto alguien abre la app. Quien tenga una versión anterior ve
un muro que solo deja ir a la tienda.

**El orden importa y no se deshace bien.** Si lo pones antes de que la descarga
exista, la gente ve un muro que la manda a una tienda donde todavía está la
versión vieja, y se queda fuera de la app hasta que aparezca la nueva. Primero
publicar, comprobar que se descarga, y entonces tocar Firestore.

---

## 6 · La web

No hay que hacer nada. Cada vez que se sube código a la rama de desarrollo, la
acción `Deploy app to GitHub Pages` compila y publica sola en `app.udeca.app`.
Se comprueba en Actions: el último `Deploy app to GitHub Pages` en verde.

---

## Resumen en seis líneas

1. ¿Expo deja compilar? → expo.dev → Billing.
2. Actions → Build Android y Build iOS → **rama correcta** → Run workflow.
3. Android: baja el `.aab`, descomprime, súbelo a Play Console.
4. iPhone: en App Store Connect elige la compilación y envía.
5. Publicadas las dos → `config/version.minima` = `1.0.1` en Firestore.
6. La web se publica sola.
