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

> **Cómo saber de qué tipo es un identificador que ya tienes**, sin entrar a
> Google Cloud. Se le pregunta a Google: se pide una autorización usando el
> esquema propio de las apps instaladas y se mira el error.
>
> ```bash
> ID=EL-QUE-SEA.apps.googleusercontent.com
> curl -sL -o /dev/null -w "%{url_effective}\n" \
>   "https://accounts.google.com/o/oauth2/v2/auth?client_id=$ID&response_type=code&scope=openid&redirect_uri=com.googleusercontent.apps.${ID%.apps.googleusercontent.com}:/oauthredirect"
> ```
>
> Si la respuesta lleva `authError=`, descodifícalo (es base64) y lo dirá:
> *"Custom scheme URIs are not allowed for 'WEB' client type"* significa que es
> el de **web**. Si no hay error, es de **app instalada** (iOS o Android).

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

> ### Y ENCIENDE EL ESQUEMA DE URI PERSONALIZADO
>
> Esto no está en ninguna guía y tumba el botón de Google en Android entero.
>
> Desde 2022, los clientes de Android nuevos nacen con el **esquema de URI
> personalizado desactivado**. Y la app vuelve de Google justo por ahí
> (`entrenadores.app:/oauthredirect`). Sin encenderlo, Google contesta:
>
> ```
> invalid_request · Custom URI scheme is not enabled for your Android client.
> ```
>
> Se enciende en **Google Cloud → Credenciales → tu cliente de Android →
> Configuración avanzada → "Habilitar esquema de URI personalizado"** → guardar.
> Tarda unos minutos en surtir efecto.
>
> Para comprobar si está encendido, sin instalar nada:
>
> ```bash
> ID=TU-CLIENTE-ANDROID.apps.googleusercontent.com
> curl -sL -o /dev/null -w "%{url_effective}\n" \
>   "https://accounts.google.com/o/oauth2/v2/auth?client_id=$ID&response_type=code&scope=openid&redirect_uri=entrenadores.app%3A%2Foauthredirect"
> ```
>
> Si la dirección final trae `authError=`, descodifica ese texto (es base64) y
> te dirá qué falla. Sin `authError`, está bien.

> **Cuando publiques en Play Store, hay una SEGUNDA huella.** Google Play
> vuelve a firmar la app con su propio certificado ("Play App Signing"), así
> que la huella que ve Google al entrar deja de ser la de EAS. Se coge en
> **Play Console → tu app → Configuración → Integridad de la aplicación →
> Firma de apps**, apartado "Certificado de la clave de firma de apps", y se
> añade **otro** cliente de Android en Google Cloud con esa SHA-1 y el mismo
> paquete. Si no lo haces, el botón de Google funcionará en tus pruebas y
> dejará de funcionar en la versión de la tienda. Es el fallo más típico de
> todo esto.

### 2.4 · Qué haces con los tres identificadores

Un identificador de cliente es un texto largo con esta pinta:

```
1042172841881-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.apps.googleusercontent.com
```

No es un secreto: viaja dentro de la app y cualquiera puede leerlo. Lo que
protege la cuenta es el paquete y la huella declarados junto al cliente. Por
eso puede estar en `eas.json`, que sí está en el repositorio.

Van en **dos sitios**, porque se usan en momentos distintos.

#### a) En `eas.json` — para los builds de tienda

Los huecos **ya están puestos**, en los dos perfiles (`preview` y
`production`). Solo tienes que pegar cada valor entre las comillas:

```json
"EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "1042172841881-xxxx.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "1042172841881-yyyy.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "1042172841881-zzzz.apps.googleusercontent.com"
```

Cuidado con dos cosas al pegar: que **no se te quede una coma de más** al final
del último, y que lo pegues en **los dos perfiles**. Si solo lo pones en
`production`, el APK de pruebas (`preview`) saldrá sin botón de Google y
parecerá que no funciona.

Para comprobar que el archivo sigue siendo válido:

```bash
node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8')); console.log('eas.json correcto')"
```

#### b) En un archivo `.env` — para probar en tu ordenador

Ese archivo **no está en el repositorio a propósito** (`.gitignore` lo excluye)
y lo creas tú, en la carpeta del proyecto, al lado de `package.json`. Copia
`.env.example`, renómbralo a `.env` y rellénalo:

```bash
cp .env.example .env
```

Y dentro, además de las de Firebase, las tres de Google:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1042172841881-xxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=1042172841881-yyyy.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=1042172841881-zzzz.apps.googleusercontent.com
```

Ahí van **sin comillas y sin espacios** alrededor del `=`. Es un formato
distinto al de `eas.json` y es el fallo más común: `EXPO_PUBLIC_..= "abc"`
guarda literalmente `"abc"` con las comillas dentro, y entonces Google
responde que el cliente no existe.

#### c) Dónde NO van

En ningún archivo de `lib/`. La app los lee sola de las variables de entorno
(`lib/googleAuth.ts` → `IDS_DE_GOOGLE`); no hay que tocar código para esto.

#### d) Qué pasa si te falta alguno

Nada se rompe, y esa es la idea: sin identificador para una plataforma, **el
botón de Google no aparece en ella** en vez de aparecer y fallar al pulsarlo.
Así que si haces un build y no ves el botón, lo que falta es el identificador
de esa plataforma — o el de web, que hace falta para las tres.

#### e) Al cambiarlos hay que volver a compilar

Las variables `EXPO_PUBLIC_*` se meten **dentro del paquete** al compilar; no
se leen al arrancar. Cambiar `eas.json` y no hacer un build nuevo no cambia
nada en el móvil que ya tienes instalado.

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
