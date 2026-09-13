# Los tres sitios de UDECA

A partir de ahora el dominio se reparte en tres, cada uno con su trabajo:

| Dirección | Qué es | Dónde vive | Carpeta |
|---|---|---|---|
| `www.udeca.app` | La web pública: planes, descargas y quiénes somos | Vercel | `web/` |
| `app.udeca.app` | La app (la que usas para probar hasta que salga en las tiendas) | GitHub Pages | el proyecto Expo |
| `acceso.udeca.app` | La puerta a la comunidad privada de Telegram | Vercel | `acceso/` |

El motivo del reparto: la web pública tiene que cargar en un segundo y hablarle
a quien todavía no nos conoce; la app es un programa de 3 MB que solo interesa a
quien ya está dentro. Mezclarlas obligaba a que un visitante se descargara la
app entera para leer los precios.

---

## 1 · Lo que tienes que hacer tú (una sola vez)

### 1.1 · DNS (en tu proveedor del dominio)

| Tipo | Nombre | Valor |
|---|---|---|
| CNAME | `app` | `luisetenete07.github.io` |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `acceso` | `cname.vercel-dns.com` |
| A | `@` (raíz) | `76.76.21.21` (Vercel, para que `udeca.app` lleve a `www`) |

> El registro de `www` **cambia**: antes apuntaba a GitHub Pages y ahora va a
> Vercel. Mientras el DNS se propaga (de minutos a un par de horas) `www` puede
> estar intermitente. La app no se queda sin sitio en ningún momento: en cuanto
> `app.udeca.app` resuelva, está ahí.

### 1.2 · Publicar la web pública en Vercel

```bash
cd web
npx vercel            # crea el proyecto (elige "udeca-web")
npx vercel --prod
```

En **Vercel → udeca-web → Settings → Domains** añade `www.udeca.app` y
`udeca.app` (este último como redirección a `www`).

### 1.3 · Publicar la comunidad en Vercel

```bash
cd acceso
npx vercel            # proyecto "udeca-acceso"
npx vercel --prod
```

Dominio: `acceso.udeca.app`.

### 1.4 · El enlace de Telegram

En el proyecto de Vercel que ya tienes con los webhooks (`udeca`, el de
`payments-webhook/`), añade **una** variable de entorno:

| Variable | Valor |
|---|---|
| `TELEGRAM_INVITE_URL` | El enlace de invitación a tu grupo privado (`https://t.me/+…`) |

> El enlace **no se escribe en este repositorio**, que es público: se pega en
> Vercel y ya está. Si estuviera aquí, cualquiera lo leería en GitHub y la
> puerta de la comunidad dejaría de tener sentido.

Y vuelve a desplegar ese proyecto (`cd payments-webhook && npx vercel --prod`).

**Por qué ahí y no en la web de la comunidad:** ese proyecto ya tiene la clave
de servicio de Firebase configurada, así que no hay que volver a pegarla. La
página de la comunidad solo llama a `https://udeca.vercel.app/api/lead`.

### 1.5 · GitHub Pages

En **Settings → Pages** del repositorio, el dominio personalizado pasa a ser
`app.udeca.app`. El despliegue ya escribe ese `CNAME` solo en cada push, así que
normalmente basta con esperar al primer despliegue y comprobarlo.

---

## 1.6 · Las dos páginas que miran las tiendas

En `web/` viven dos páginas que no son marketing y que hay que tratar con más
cuidado que el resto:

| Fichero | Se publica en | Para qué |
|---|---|---|
| `web/privacidad.html` | `app.udeca.app/privacidad` y `www.udeca.app/privacidad` | La política de privacidad que se declara en Play y en App Store |
| `web/eliminar-cuenta.html` | `app.udeca.app/eliminar-cuenta` y `www.udeca.app/eliminar-cuenta` | La página de borrado de cuenta que exige la declaración de seguridad de los datos |

**En las tiendas van las de `app.udeca.app`**, y el motivo es sencillo: esa la
publica la acción de GitHub en cada push, sin que nadie tenga que acordarse. La
web pública va por Vercel y se lanza a mano, y el día que se olvide, la tienda
encuentra un 404 y bloquea el envío. Ya pasó.

Están aquí y no dentro de la app **a propósito**. Google las comprueba con un
revisor automático que pide el HTML, no ejecuta JavaScript y no tiene sesión: una
pantalla de la app le devuelve una página en blanco y da el envío por rechazado.
Aquí el texto viaja en el propio fichero.

Cuatro reglas al tocarlas:

1. **Sin `<script>`.** Si el texto lo pinta un script, no existe para quien lo
   comprueba.
2. **Sin nada de fuera:** ni `styles.css`, ni fuentes de Google, ni imágenes. El
   estilo va dentro del propio fichero. Se sirven desde dos sitios distintos, y
   una ruta que exista en uno y no en el otro deja la página sin formato justo
   donde la mira la tienda.
3. **La de borrado tiene que servir a quien ya no tiene la app.** Por eso hay un
   correo además del botón de dentro de la app.
4. **El mismo texto está en `app/privacy-policy.tsx` y `app/delete-account.tsx`**,
   que es lo que se lee desde dentro. Si cambia uno, cambia el otro: son el mismo
   documento.

Lo vigila `scripts/check-legales.mjs`, que corre en cada push y comprueba también
que el despliegue de la app las siga copiando.

La web pública sigue yendo por Vercel y a mano (`cd web && npx vercel --prod`),
pero ya no es lo que sostiene las tiendas: es solo la copia bonita, dentro del
sitio de captación.

---

## 2 · Qué se cambia cuando algo esté listo

Todo lo configurable de la web pública está en **`web/config.js`**, en un solo
sitio y en castellano:

- `pagos.altaAtleta` y `pagos.altaCoach` — los dos Payment Links del **primer
  año** (pago único): 17 € el atleta y 27 € el entrenador, uno por rol para
  saber quién entra.

  **Los mismos dos enlaces van también en la app**, en
  `lib/enlacesDeCobro.ts` → `ATHLETE_ENTRY_LINK` y `COACH_ENTRY_LINK`. La web
  los usa para quien llega de fuera y la app para quien se registró sin pasar
  por ella; si cambias uno, cambia el otro (`scripts/check-stripe.mjs` se queja
  si se separan). Mientras estén vacíos, el muro de la app ofrece escribir un
  correo en vez de dejar al usuario sin salida, y la web manda a
  `/proximamente`.

  Si alguno hubiera que retirarlo, se deja en `/proximamente` y nunca con el
  enlace de otro importe: esa página explica que el cobro no está abierto, y un
  enlace equivocado cobraría otra cosa sin dar ningún error.

  Lo que viene después (180 €/año del entrenador sin tope de alumnos, 96 €/año
  del atleta al renovar) se cobra desde la app con `COACH_PAYMENT_LINK` /
  `ATHLETE_ANNUAL_LINK`.

- **Los precios escritos en `web/index.html`** salen de `lib/precios.ts`, que es
  donde están de verdad. El titular es el precio **por mes** y el total del año
  va debajo, en pequeño pero visible. `scripts/check-precios.mjs` comprueba que
  las dos copias digan lo mismo y que las cuentas cuadren: es la comprobación
  que evita que la página anuncie un precio y la pasarela cobre otro.
- `descargas.appStore` y `descargas.playStore` — déjalos vacíos hasta que la
  ficha exista. Vacío = **la insignia de esa tienda desaparece de la web**, y no
  se queda apagada ni con un "próximamente" encima: la insignia oficial promete
  algo muy concreto —"está en esta tienda, pulsa y la tienes"— y una que no
  lleva a ninguna parte hace dudar de la página entera. Con enlace vuelve sola.
- `comunidad`, `instagram`, `contacto`.

### `web/vercel.json`: por qué no lleva comentarios

Porque tumban la web entera, y en silencio.

Vercel valida ese fichero de forma estricta y **rechaza cualquier propiedad que
no reconozca**. Una clave `"//"` con un comentario dentro —el truco que sí
funciona en `package.json`— hace que el despliegue falle en un segundo, antes de
compilar nada. Y lo peor no es el fallo: es que la web pública se queda
congelada en la versión anterior mientras en GitHub todo sale en verde. No hay
nada roto que mirar, la página sigue abriendo; solo que es la de antes. Así
estuvo días, con los precios nuevos y las insignias de las tiendas sin publicar.

Lo vigila `scripts/check-legales.mjs`. Los comentarios van aquí.

**Los alias de las páginas legales** (los `redirects` de ese fichero): Google
Play y App Store guardan la URL que se les dio y la comprueban solas, sin
avisar. Si un día esa dirección deja de responder, la app se queda sin poder
enviarse a revisión y el aviso llega en forma de rechazo. Por eso cualquier
forma razonable de escribirlas lleva al mismo sitio: en español o en inglés, con
guion o sin él, y también las rutas que tenían dentro de la app
(`/privacy-policy`, `/delete-account`), que es donde apuntaban antes. Son
redirecciones permanentes (308) porque la dirección buena es una sola: la que se
declara en las tiendas.

### Las insignias de las tiendas

Están en `web/assets/badge-app-store.svg` y `web/assets/badge-google-play.svg`,
y son **el artwork oficial de cada tienda, sin retocar**: la de Apple viene de
`developer.apple.com/assets/elements/badges/`, y la de Google es su insignia
oficial en inglés.

No se recolorean, no se recortan y no se les cambia el texto: las dos guías de
marca lo prohíben, y es una de las condiciones que aceptas al publicar la app.
Si algún día quieres las versiones en castellano ("Consíguelo en el App Store"
/ "Disponible en Google Play"), se bajan de la web de cada tienda y se dejan en
esos mismos dos nombres de archivo — no hay que tocar ni el HTML ni el CSS.

Un detalle que parece un error y no lo es: en `styles.css` la de Google va a
72 px y la de Apple a 48. El archivo de Google trae dentro su margen de respeto
obligatorio y el de Apple no, así que su cápsula solo ocupa el 67 % de la caja;
a la misma altura se vería un tercio más pequeña. `scripts/check-web-tiendas.mjs`
vigila que nadie las "cuadre" igualándolas, que es justo lo que las descuadra.

En Stripe, en cada Payment Link, pon como página de confirmación
**`https://app.udeca.app/gracias`** (con `app.`, no `www.`: ver docs/COBROS.md).
Es la que le explica al cliente que tiene que registrarse **con el mismo correo
del pago**, que es lo que vincula la suscripción con su cuenta.

---

## 3 · Cómo funciona el embudo de Instagram

1. En el perfil (y en los CTA de los vídeos) pones `acceso.udeca.app`.
   Si quieres medir de qué vídeo viene cada uno, añade `?utm_source=reel-planchas`.
2. La página pide nombre y correo. Nada más: cada campo de más es gente que se cae.
3. Al enviar, el servidor guarda el contacto en Firestore (colección `leads`) y
   **entonces** devuelve el enlace del grupo.
4. El enlace no está en el código de la página, así que la puerta es real.

### Abrir la comunidad (o por qué dice que "todavía no está abierta")

Ese mensaje sale cuando el servidor no tiene enlace del grupo. Sin enlace no
guarda el contacto a propósito: pedirle el correo a alguien para no darle nada
a cambio es la peor primera impresión posible.

Hay **dos formas** de dárselo, y basta con una:

1. **Firestore (inmediata, sin desplegar).** En la consola de Firebase, crea la
   colección `config`, dentro el documento `comunidad`, y en él un campo de
   texto `telegramInviteUrl` con el enlace de invitación. Funciona en la
   siguiente petición. Las reglas cierran esa colección a cal y canto: no se
   puede leer desde la app ni desde el navegador.
2. **Variable de entorno en Vercel.** `TELEGRAM_INVITE_URL` en el proyecto de
   los webhooks (el de `udeca.vercel.app`, que es donde vive `/api/lead`), en el
   entorno **Production**. Aquí está el fallo más común: **las variables solo
   entran en vigor al volver a desplegar**. Después de añadirla, Deployments →
   el último → Redeploy.

Si están las dos, manda la de Vercel.

**Para saber en qué estado está**, abre esto en el navegador:

```
https://udeca.vercel.app/api/lead
```

Responde algo así, sin enseñar nunca el enlace:

```json
{ "abierta": true, "enlaceEnVercel": false, "credencialesFirebase": true }
```

- `abierta: false` → no hay enlace por ninguna de las dos vías.
- `abierta: true` pero `enlaceEnVercel: false` → está funcionando por Firestore.
- `credencialesFirebase: false` → falta `FIREBASE_SERVICE_ACCOUNT` y no se puede
  guardar ningún contacto.

El enlace de Telegram **no está en el repositorio y no debe estarlo**: este
repositorio es público, y ahí dentro la puerta la abriría cualquiera.

### La lista de correos

Los contactos de la comunidad **no se mezclan con las cuentas de UDECA**. Viven
en su propia colección, `leads`, separada de `users`: quien deja el correo en
una página de captación no es un usuario de la app, y juntarlos acaba con
alguien mandando una campaña a sus propios alumnos.

Cada contacto queda con nombre, correo, origen, campaña, número de visitas y el
consentimiento con su fecha (lo que exige el RGPD para poder escribirles
después). Nadie puede leer ni escribir esa colección desde la app o el
navegador: las reglas la cierran por completo y solo entra el servidor.

**Descargar la lista** (para importarla en Mailchimp, Brevo, MailerLite…):

```
https://udeca.vercel.app/api/leads-export?key=TU_CLAVE
```

Devuelve un CSV con una fila por contacto, listo para abrir en Excel o subir a
la herramienta de correo. Añadiendo `&format=json` sale en JSON.

La clave es la variable `LEADS_EXPORT_KEY` del proyecto de los webhooks. Si no
la pones, vale la `CRON_SECRET` que ya tienes; es mejor darle una propia, para
que una filtración no se lleve las dos cosas a la vez. Sin clave válida, el
endpoint no devuelve nada: es la lista entera de correos de tu comunidad.

**Darse de baja:** por ahora se hace a mano (borrando el documento en la consola
de Firebase). En cuanto empieces a mandar campañas de verdad, la herramienta de
correo se encarga de las bajas y esta lista pasa a ser solo el origen.

---

## 4 · Probar en local

```bash
# Web pública
npx serve web -l 4600

# Comunidad (el formulario llamará al endpoint real de Vercel)
npx serve acceso -l 4601
```

Los dos puertos (`4600` y `4601`) están en la lista de orígenes permitidos del
endpoint, así que el formulario funciona en local sin tocar nada.
