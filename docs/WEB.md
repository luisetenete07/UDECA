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

## 2 · Qué se cambia cuando algo esté listo

Todo lo configurable de la web pública está en **`web/config.js`**, en un solo
sitio y en castellano:

- `pagos.altaAtleta` y `pagos.altaCoach` — los dos Payment Links del **alta de
  1 €** (pago único), uno por rol para saber quién se da de alta.

  **Los mismos dos enlaces van también en la app**, en
  `lib/subscription.ts` → `ATHLETE_ENTRY_LINK` y `COACH_ENTRY_LINK`. La web los
  usa para quien llega de fuera y la app para quien se registró sin pasar por
  ella; si cambias uno, cambia el otro. Mientras estén vacíos, el muro de la app
  ofrece escribir un correo en vez de dejar al usuario sin salida.

  Lo que viene después (180 €/año del entrenador, 10 €/mes del atleta) se cobra
  desde la app con `COACH_PAYMENT_LINK` / `ATHLETE_PAYMENT_LINK`, que ahora
  apuntan a los de **prueba**: al pasar a producción, pega los `live`.
- `descargas.appStore`, `descargas.playStore`, `descargas.apkPc` — déjalos
  vacíos hasta que la ficha exista. Vacío = la tarjeta se queda en
  "Próximamente" y no lleva a un 404; con enlace = pasa sola a "Disponible".
- `comunidad`, `instagram`, `contacto`.

En Stripe, en cada Payment Link, pon como página de confirmación
`https://www.udeca.app/gracias`. Es la que le explica al cliente que tiene que
registrarse **con el mismo correo del pago**, que es lo que vincula la
suscripción con su cuenta.

---

## 3 · Cómo funciona el embudo de Instagram

1. En el perfil (y en los CTA de los vídeos) pones `acceso.udeca.app`.
   Si quieres medir de qué vídeo viene cada uno, añade `?utm_source=reel-planchas`.
2. La página pide nombre y correo. Nada más: cada campo de más es gente que se cae.
3. Al enviar, el servidor guarda el contacto en Firestore (colección `leads`) y
   **entonces** devuelve el enlace del grupo.
4. El enlace no está en el código de la página, así que la puerta es real.

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
