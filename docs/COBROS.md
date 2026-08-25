# Cómo se cobra en UDECA

Un solo documento con las tres cosas que se cobran, quién las paga y —lo que
más problemas da— **dónde se puede enseñar un precio y dónde no**.

---

## 1 · Los tres cobros

| Qué | Cuánto | Quién | Dónde se cobra |
| --- | --- | --- | --- |
| **Alta** | 1 €, una vez | entrenador y atleta | web (`pagos.altaCoach` / `pagos.altaAtleta`) o app (`COACH_ENTRY_LINK` / `ATHLETE_ENTRY_LINK`) |
| **Plan del entrenador** | 180 €/año | entrenador con más de 5 alumnos | app (`COACH_PAYMENT_LINK`) |
| **Plan del atleta** | 10 €/mes | atleta pasados sus 28 días | app (`ATHLETE_PAYMENT_LINK`) |

El **alumno de un entrenador no le paga nada a UDECA**. Lo que le paga a su
entrenador es cosa de los dos: la app solo lleva la cuenta.

### Por qué el alta cuesta un euro

No es para hacer caja: un euro no financia nada. Es para que al entrar quede una
**tarjeta identificada**. Stripe devuelve del pago una huella
(`payment_method.card.fingerprint`) que es la misma para la misma tarjeta aunque
cambien el correo, el nombre, el móvil o la cuenta.

Con eso, el agujero grande del modelo se cierra: un entrenador ya no puede
abrir cinco cuentas de cinco alumnos cada una para no pagar los 180 €. Cuando la
misma tarjeta paga un segundo alta de entrenador, el webhook le pone
`clientSlots: 0` a esa cuenta: entra, pero sin alumnos incluidos. Al que va de
frente no le cuesta ni un paso más, porque ya estaba metiendo la tarjeta.

Los campos que sostienen todo esto (`entryPaidAt`, `payerFingerprint`,
`clientSlots`, `clientCount`) **solo los escribe el servidor**: las reglas de
Firestore se lo prohíben a la propia cuenta, y hay una comprobación por cada uno
en `scripts/check-rules.mjs`. Si eso se rompiera, el euro sería voluntario.

### Quien paga en la web todavía no tiene cuenta

Es el camino normal de udeca.app: se paga primero y se crea la cuenta después.
El pago llega entonces **sin uid**, así que no hay a quién activar.

Sin resolverlo, esa persona se registraba, la app le enseñaba el muro del alta y
le pedía el euro **otra vez**. Cobrar dos veces en el primer minuto es la forma
más rápida de perder a alguien que ya había dicho que sí.

Lo que ocurre ahora:

1. El webhook mira el **correo del pago**. Si ya existe una cuenta con él, la
   activa en el momento.
2. Si no existe, guarda el pago en `entryPayments` (con la huella de la tarjeta,
   que después ya no se puede recuperar) y ahí se queda esperando.
3. Cuando esa persona se registra, el muro del alta llama a
   `api/claim-entry`, que comprueba **con el token de sesión de Firebase** que
   quien reclama el pago es de verdad el dueño de ese correo, y activa la cuenta.
4. Un pago activa **una** cuenta: al reclamarlo queda marcado con el uid.

Por eso la página de gracias insiste tanto en registrarse con el mismo correo:
es lo único que une el pago con la cuenta.

### Al atleta se le avisa antes de que se acabe

A tres días del final y el último día, por notificación
(`payments-webhook/api/cron-daily.js`). La app se lo promete por escrito en la
tarjeta del plan, así que tiene que cumplirse: entrar el día 29 y encontrarse el
muro de pago sin previo aviso convierte a alguien que iba a pagar en alguien que
se va.

El aviso guarda el **hito** enviado (3 o 1) y no la fecha, para que los dos
puedan salir con un día de diferencia sin pisarse, y deja de aplicar solo en
cuanto la persona paga.

Sale por **notificación push y por correo**. Es el único aviso de la tarea
diaria que va por los dos caminos, y con razón: el push solo existe si la
persona tiene la app de móvil instalada y ha dado permiso, y quien usa UDECA
desde el navegador no tendría forma de enterarse. Encontrarse el muro de pago el
último día sin aviso, después de que la app lo prometiera por escrito, convierte a
alguien que iba a pagar en alguien que se va.

El hito se marca aunque no salga ningún aviso (ni push ni correo). Si no, se
reintentaría a diario con quien no tiene ninguno de los dos.

### Cuándo empiezan los 28 días del atleta

Al pagar el alta, no al registrarse (lo escribe `activarAlta` en el webhook).
Si alguien tarda dos días en pagar el euro, no pierde dos días de prueba.

### Quién no ve nunca el muro del alta

- Las cuentas creadas antes de `ENTRY_REQUIRED_FROM` (`lib/subscription.ts`).
  Cambiar las reglas a mitad de partida y dejar fuera a los primeros es la forma
  más rápida de perderlos.
- Los alumnos de un entrenador y los administradores.
- Quien ya tiene una suscripción de pago en marcha.

---

## 2 · iOS: aquí no se vende nada

La norma **3.1.1 de la App Store** obliga a que todo el contenido digital que se
consuma dentro de la app se compre con las compras integradas de Apple, y
prohíbe además **enseñar precios o poner enlaces que lleven a pagar por fuera**.
Una pantalla con "180 €/año" y un botón a Stripe no es discutible: es rechazo.

Por eso existe `CAN_SELL_IN_APP` en `lib/subscription.ts` (`false` en iOS). Con
ella apagada:

- El muro del alta (`components/EntryWall.tsx`) dice solo que la cuenta está sin
  activar. Sin precio, sin botón de pago y sin explicar dónde se paga.
- El muro de suscripción (`components/Paywall.tsx`) hace lo mismo: mantiene lo
  que la cuenta da, quita el plan, el precio y el botón.
- El aviso de prueba (`components/TrialBanner.tsx`) informa de los días y ya.
- El registro y el perfil del entrenador no nombran euros.

Los dos muros siguen teniendo su botón de **"Ya está activa · Actualizar"**, y
además comprueban solos cada pocos segundos: quien pague desde su cuenta en la
web entra sin tener que hacer nada. Es el mismo patrón de Netflix, Spotify o
Notion, y es el que pasa revisión.

Esto **no** afecta a lo que un alumno le paga a su entrenador: eso es un
servicio real entre personas, que Apple deja expresamente fuera de las compras
integradas.

**Lo que falta para hacerlo del todo bien en iOS** son las compras integradas
(StoreKit + acuerdos de pago en App Store Connect), y es un proyecto aparte: hay
que dar de alta los productos, cobrar el 15-30 % de comisión y sincronizar los
recibos de Apple con `subscriptionUntil`. Hasta entonces, en iPhone se entra con
una cuenta ya activada desde fuera.

En Android, web y APK no cambia nada: se cobra con normalidad.

---

## 3 · Qué hace el webhook

`payments-webhook/api/stripe-webhook.js`, evento `checkout.session.completed`:

1. Si es una **suscripción**, extiende `subscriptionUntil` hasta el fin del
   periodo pagado.
2. Si es un **pago suelto**, mira el rol de quien paga:
   - entrenador o atleta → es el alta: escribe `entryPaidAt`, guarda la huella
     de la tarjeta, reparte (o no) las plazas de alumno y, si es atleta, arranca
     sus 28 días.
   - alumno → es la cuota que le paga a su entrenador.

Todos los eventos son idempotentes (colección `stripeEvents`): Stripe reenvía, y
un cobro no puede contar dos veces.


---

## 3 bis · Los cobros están ENCENDIDOS

`PAGOS_ACTIVOS = true` en `lib/planBase.ts`, con los cuatro Payment Links de
producción en `lib/subscription.ts` y los dos del alta también en
`web/config.js`.

### Lo que tiene que seguir cuadrando

Los enlaces se crearon en el **perfil de UDECA** de Stripe, y las claves de
Vercel (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) son de **ese mismo
perfil**. Esa coincidencia es todo lo que hace que un pago active una cuenta.

Estuvo apagado un tiempo justo por eso: los enlaces eran del perfil de UDECA y
las claves de la cuenta de coaching. Con esa mezcla el cliente paga de verdad,
el servidor le pregunta a la cuenta equivocada, no encuentra el pago y **la
cuenta no se activa nunca**. Sin ningún error y con el dinero ya cobrado.

**Si algún día se cambia de perfil o de cuenta de Stripe, hay que mover LAS DOS
COSAS a la vez**: los enlaces del repositorio y las dos claves de Vercel.

### Los cuatro enlaces

| Producto | Payment Link |
|---|---|
| Alta de atleta · 1 € | `https://buy.stripe.com/4gMdR8gL50UbbgY9nu3sI01` |
| Plan de atleta · 10 €/mes | `https://buy.stripe.com/5kQ3cudyT8mDetafLS3sI03` |
| Plan de atleta · 96 €/año | `https://buy.stripe.com/3cIdR866rcCT98Q9nu3sI05` |
| Alta de entrenador · 1 € | `https://buy.stripe.com/5kQeVc8ezdGX84MbvC3sI00` |
| Plan de entrenador · 180 €/año | `https://buy.stripe.com/eVqcN4cuP9qH70IgPW3sI02` |

### Por qué 96 y no 95

96 entre 12 son **8,00 € exactos**, y "8 € al mes pagando el año" se lee de un
vistazo. 95 salen a 7,92, que ni se recuerda ni cabe en un titular. El descuento
es del 20%, dentro del estándar (17-25%).

Y el anual no regala margen: **un atleta mensual tiene que aguantar diez meses
para dejar lo que el anual deja el primer día**, contando IVA y comisiones. En
una app de entrenamiento la mayoría no llega a seis. Además quita once cobros
que pueden fallar.

La app **no enseña ninguno de estos importes**: solo el ahorro en porcentaje, y
calculado a partir de los dos precios (`AHORRO_ANUAL_PCT`), nunca escrito a
mano. El porqué está en `lib/subscription.ts`.

### En iPhone no se cobra, y es a propósito

`CAN_LINK_TO_PAYMENT` vale `PAGOS_ACTIVOS && Platform.OS !== 'ios'`. La norma
3.1.1 de la App Store prohíbe enlazar a pagar contenido digital fuera de sus
compras integradas. En iPhone la app dice el estado de la cuenta y ofrece volver
a comprobarla; el cobro va por la web. Ver docs/TIENDAS.md.

### Si hay que apagarlo otra vez

`PAGOS_ACTIVOS = false` y vaciar los cuatro enlaces (y dejar `web/config.js`
apuntando a `/proximamente`). Van juntos: en la app un enlace suelto es
inofensivo porque manda `CAN_LINK_TO_PAYMENT`, pero `web/config.js` no mira
ningún interruptor y ahí un enlace es un cobro real. `check-stripe.mjs` no deja
que se separen.

---

## 4 · Qué hay que configurar en Stripe

Una vez por cada Payment Link (Payments → Payment Links → el enlace → editar):

- **Después del pago → Redirigir a una página**, con la dirección
  **`https://app.udeca.app/gracias`**. Es la página que explica cómo activar la
  cuenta; sin ella, el cliente paga y se queda mirando la pantalla de Stripe.

  Ojo con el dominio: **`app.` y no `www.`**. La misma página está en los dos,
  pero `www` es Vercel y se despliega A MANO, mientras que `app` se despliega
  solo en cada push. Esta es la dirección a la que Stripe manda a alguien que
  acaba de pagar: si un día falla, esa persona ve un error justo después de
  darnos su dinero y piensa que le hemos cobrado sin darle nada. No puede
  depender de que alguien se acuerde de publicar.
- **Recopilar el correo del cliente**, activado. Sin correo no hay forma de unir
  el pago con la cuenta que se cree después, y el euro se pierde.

Una sola vez, para toda la cuenta (Desarrolladores → Webhooks → Añadir
endpoint):

- Dirección: `https://udeca.vercel.app/api/stripe-webhook`
- Eventos: `checkout.session.completed`, `invoice.paid`,
  `customer.subscription.deleted`
- Copia el **secreto de firma** (`whsec_…`) en la variable
  `STRIPE_WEBHOOK_SECRET` de Vercel, y **vuelve a desplegar**: las variables no
  entran en vigor hasta el siguiente despliegue.

**Modo de prueba y modo real son dos mundos separados.** Tienen claves,
webhooks y enlaces distintos. Si los enlaces son `buy.stripe.com/test_…`, en
Vercel tienen que estar la clave de prueba (`sk_test_…`) y el secreto del
webhook de prueba; el día que pases a real hay que cambiar los tres a la vez
(enlaces, clave y secreto) o los pagos entrarán sin que nadie se entere.


---

## 5 · El correo

`payments-webhook/api/_correo.js`, con **Resend**.

**Sin clave no pasa nada**: si `RESEND_API_KEY` no está puesta, no se envía y se
dice en la respuesta de la tarea diaria (`correo: "sin-configurar"`). El resto
sigue funcionando igual. Así el código puede estar publicado antes de que exista
la cuenta, y el día que se pegue la clave empieza a funcionar solo.

### Qué hay que hacer una vez

1. Crear la cuenta en [resend.com](https://resend.com) (3.000 correos al mes
   gratis, de sobra para empezar).
2. **Domains → Add Domain → `udeca.app`**. Resend da unos registros DNS (SPF y
   DKIM) que hay que añadir donde esté el dominio. Sin verificarlo, los correos
   salen desde una dirección de pruebas y acaban en spam.
3. **API Keys → Create**, permiso de solo envío.
4. En Vercel, en el proyecto del webhook: **Settings → Environment Variables**
   - `RESEND_API_KEY` = la clave
   - `MAIL_FROM` = `UDECA <avisos@udeca.app>` (opcional; es el valor por defecto)
5. **Volver a desplegar.** Las variables no entran en vigor hasta el siguiente
   despliegue.

La clave **no va en el repositorio**, que es público, ni se pega en ningún chat:
solo en Vercel.

### Qué se envía hoy

Solo el aviso de fin de prueba del atleta (a 3 días y el último día). Los demás
recordatorios —inactividad, cuota— siguen siendo solo push: son de trato diario
entre entrenador y alumno, y un correo por cada uno se lee como spam propio.

Los correos van sin imágenes ni tipografías externas a propósito: lo que depende
de recursos remotos se ve roto en media bandeja de entrada y puntúa peor en los
filtros de spam.

---

## 6 · La campaña de fundadores

Quien paga su alta mientras la campaña está abierta recibe un **número de
fundador** correlativo: el 7 es el séptimo, y lo sigue siendo aunque los seis
anteriores se borren la cuenta. Se ve en su perfil y se puede compartir como
imagen.

El número lo reparte el servidor (`payments-webhook/api/_alta.js`) dentro de una
**transacción** sobre `config/fundadores`, para que dos altas simultáneas no se
lleven el mismo. Las reglas impiden escribir `founderNumber` desde la app: un
distintivo que cualquiera pudiera ponerse no valdría nada.

**La campaña arranca CERRADA.** Se abre y se cierra desde la consola de Firebase,
sin desplegar nada: empieza cuando lo decide quien lleva el marketing. Y cerrada
por defecto porque repartir números antes de tiempo no tiene vuelta atrás — el
número 1 solo se da una vez. En `config/fundadores`:

| Campo | Para qué |
| --- | --- |
| `abierta` | `true` la abre. Sin este campo (o en `false`) no se reparte nada. |
| `limite` | Último número que se reparte, por ejemplo 100. Opcional. |
| `siguiente` | El próximo número. Lo lleva el servidor; no hace falta tocarlo. |

Si el reparto falla por lo que sea, la cuenta se activa igual: el alta es lo que
la persona ha pagado, y el número es un extra.
