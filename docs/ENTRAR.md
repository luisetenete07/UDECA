# Entrar con Google y con Apple

Guía de configuración con los datos de UDECA ya puestos. El código ya está
hecho; esto es lo que hay que dejar preparado **fuera** de la app: en Firebase,
en Google Cloud y en Apple.

Tus datos, para no tener que buscarlos:

| Qué | Valor |
|---|---|
| Proyecto de Firebase | `udeca-luistenafit` |
| Dominio de Firebase | `udeca-luistenafit.firebaseapp.com` |
| Paquete de Android | `entrenadores.app` |
| Bundle de iOS | `com.udeca.app` |
| La app en web | `https://app.udeca.app` |

---

## Paso 1 · Activar los proveedores en Firebase (5 minutos)

Firebase Console → tu proyecto → **Authentication** → pestaña **Sign-in method**.

1. **Add new provider → Google → Enable.**
   - "Project support email": pon tu correo.
   - Guarda.
   - **Esto es importante:** al guardar, Google crea solo un cliente OAuth
     llamado *"Web client (auto created by Google Service)"*. Ese es el que vas
     a necesitar en el paso 2 como cliente **web**. No hace falta crearlo a
     mano.

2. **Add new provider → Apple → Enable.**
   - Para que funcione **solo en iPhone**, con esto basta: activarlo y guardar.
   - Para que funcione **también en la web** hacen falta los datos del paso 3
     (Services ID y clave). Puedes dejarlo para después: el botón de Apple en
     iPhone ya funcionará.

---

## Paso 2 · Los tres identificadores de Google (15 minutos)

Solo hacen falta para **móvil**. En web los resuelve Firebase solo.

Ve a **Google Cloud Console** → https://console.cloud.google.com/apis/credentials
y arriba a la izquierda **elige el proyecto `udeca-luistenafit`** (es el mismo
que el de Firebase; si no lo ves, quita el filtro de organización).

Verás una lista, **"ID de cliente de OAuth 2.0"**.

### 2.1 · El de WEB (ya existe, solo hay que copiarlo)

En la lista busca **"Web client (auto created by Google Service)"** — lo creó
Firebase en el paso 1.

- Púlsalo y copia el **ID de cliente**. Es un texto largo que acaba en
  `.apps.googleusercontent.com`.
- Ese valor va en `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

> No te lo saltes aunque estés configurando solo el móvil: en Android e iOS,
> el token que se le pide a Google se pide **a nombre del cliente web**. Sin él
> no funciona ninguno de los dos.

Mientras estás dentro, en ese mismo cliente añade:

- **Orígenes autorizados de JavaScript:**
  - `https://app.udeca.app`
  - `https://udeca-luistenafit.firebaseapp.com`
  - `http://localhost:8081` (para probar en tu ordenador)
- **URIs de redirección autorizados:**
  - `https://udeca-luistenafit.firebaseapp.com/__/auth/handler`
  - `https://app.udeca.app/__/auth/handler`

Guarda.

### 2.2 · El de iOS (hay que crearlo)

**+ CREAR CREDENCIALES** → **ID de cliente de OAuth** → Tipo de aplicación:
**iOS**.

- Nombre: `UDECA iOS`
- **ID de paquete**: `com.udeca.app`
- Crear.

Copia el **ID de cliente** → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

### 2.3 · El de Android (hay que crearlo, y necesita la huella SHA-1)

Android exige la **huella del certificado con el que se firma la app**. Como
firma EAS por ti, hay que pedírsela a EAS. En tu ordenador, dentro del
proyecto:

```bash
npx eas-cli credentials
```

Elige **Android** → **production** → **Keystore: Manage everything...** y te
enseñará algo así:

```
SHA1 Fingerprint: A1:B2:C3:D4:...:F0
```

Cópiala entera, con los dos puntos.

> Si aún no has hecho ningún build de Android, EAS te ofrecerá **generar** el
> keystore ahí mismo. Dile que sí: es el que se usará siempre, y si algún día
> lo pierdes no podrás actualizar la app en Play Store. EAS lo guarda por ti.

Ahora, en Google Cloud: **+ CREAR CREDENCIALES** → **ID de cliente de OAuth** →
Tipo de aplicación: **Android**.

- Nombre: `UDECA Android`
- **Nombre del paquete**: `entrenadores.app`
- **Huella digital del certificado SHA-1**: la que acabas de copiar.
- Crear.

Copia el **ID de cliente** → `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

> **Cuando publiques en Play Store, hay una SEGUNDA huella.** Google Play
> vuelve a firmar la app con su propio certificado ("Play App Signing"), así
> que la huella que ve Google al entrar deja de ser la de EAS. Se coge en
> **Play Console → tu app → Configuración → Integridad de la aplicación →
> Firma de apps**, apartado "Certificado de la clave de firma de apps", y se
> añade **otro** cliente de Android en Google Cloud con esa SHA-1 y el mismo
> paquete. Si no lo haces, el botón de Google funcionará en tus pruebas y
> dejará de funcionar en la versión de la tienda. Es el fallo más típico de
> todo esto.

### 2.4 · Dónde se pegan los tres

En **dos sitios**, porque se usan en momentos distintos:

1. En tu `.env` local (para probar): las tres líneas `EXPO_PUBLIC_GOOGLE_*`.
2. En `eas.json`, dentro de `build.preview.env` y `build.production.env`
   (para que viajen en los builds de tienda), junto a las de Firebase que ya
   están ahí.

No son secretos: viajan dentro de la app y se pueden leer. Lo que protege la
cuenta es el paquete y la huella declarados junto al cliente.

---

## Paso 3 · Apple (solo si quieres el botón también en la web)

En **https://developer.apple.com/account** → Certificates, Identifiers &
Profiles.

1. **Identifiers** → tu App ID `com.udeca.app` → marca **Sign in with Apple** →
   Save. *(Con esto ya funciona en iPhone.)*
2. **Identifiers** → **+** → **Services IDs**:
   - Description: `UDECA Web`
   - Identifier: `com.udeca.app.web` (no puede ser igual que el del App ID)
   - Continue → Register.
   - Entra en él → marca **Sign in with Apple** → **Configure**:
     - Primary App ID: `com.udeca.app`
     - Domains: `udeca-luistenafit.firebaseapp.com`
     - Return URLs: `https://udeca-luistenafit.firebaseapp.com/__/auth/handler`
   - Save.
3. **Keys** → **+** → nombre `UDECA Apple Sign In` → marca **Sign in with
   Apple** → Configure → Primary App ID `com.udeca.app` → Continue → Register.
   - **Descarga el archivo `.p8`. Solo se puede descargar UNA vez.**
   - Apunta el **Key ID** (10 caracteres).
4. Apunta tu **Team ID** (arriba a la derecha en la cuenta de Apple Developer).
5. Vuelve a **Firebase → Authentication → Apple** y rellena:
   - Services ID: `com.udeca.app.web`
   - Apple Team ID: el tuyo
   - Key ID: el del paso 3
   - Private key: el contenido del `.p8`

> El `.p8` es una credencial. No va al repositorio ni se pega en un chat: se
> sube solo al formulario de Firebase.

---

## Paso 4 · Comprobar que va

1. **En el ordenador:** `npx expo start --web`, botón "Continuar con Google".
   Debe abrir la ventana de Google y volver dentro.
2. **En el móvil:** hace falta un build nuevo (`expo-apple-authentication` es
   código nativo, no basta con una actualización por aire).
   ```bash
   npx eas-cli build --profile preview --platform android
   ```
   Instala el APK y prueba los dos botones.

---

## Qué pasa con las cuentas que ya existen

Una cuenta de Firebase **no es un correo, es un identificador (uid)**, y todo
lo que la app guarda de alguien cuelga de ese uid. Quien ya tenga cuenta con
contraseña y pulse "Entrar con Google" **no se enlaza solo**: Firebase lo
rechaza. La app recoge ese caso y le pide la contraseña una última vez para
enganchar Google a esa misma cuenta (ver `lib/enlazarCuenta.ts`). Mismo uid,
mismos datos, y a partir de ahí Google para siempre.

Con Apple hay un caso que no tiene arreglo técnico: si la persona elige
**"Ocultar mi correo"**, Apple da una dirección de rebote que nunca coincidirá
con su correo de antes, y esa cuenta nace vacía. Por eso el rescate se hace por
Google.
