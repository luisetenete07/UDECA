# Cobro automático de UDECA (webhook de Stripe)

Esta pequeña función confirma **automáticamente** los pagos: cuando un alumno
paga por el enlace de Stripe, Stripe avisa aquí, se verifica la firma y se marca
el cobro en la app (estado "Pagado", próxima cuota y limpieza del aviso). El
coach no tiene que confirmar nada a mano.

> **Coste:** 0 € de infraestructura. Vercel (Hobby) y Firestore (Spark) son
> gratis de sobra para este uso, incluso con volumen alto. Lo único que se paga
> es la **comisión por transacción de Stripe** (se descuenta de cada cobro), que
> es inevitable con cualquier método de pago con tarjeta.

## Qué necesitas (una sola vez)

1. Una cuenta de **Stripe** (gratis): https://dashboard.stripe.com
2. Una cuenta de **Vercel** (gratis, sin tarjeta): https://vercel.com
3. Tu proyecto de **Firebase** (el que ya usa UDECA).

## Paso 1 · Enlace de pago en Stripe

1. En Stripe: **Payment Links** → **New** → crea un enlace con la cuota (p. ej.
   "Cuota mensual UDECA", precio recurrente o único, como prefieras).
2. Copia la URL (`https://buy.stripe.com/...`).
3. Pégala en la app: **UDECA → Alumnos → (el alumno) → Cobro → Enlace de pago**.

El enlace va **por alumno**, no por entrenador: cada plan tiene su precio, y con
uno común el botón cobraría de más a unos y de menos a otros. Crea en Stripe un
enlace por tarifa y pégalo en la ficha de quien le corresponda.

La app añade sola `?client_reference_id=<id del alumno>` al abrir el enlace, así
el webhook sabe **quién** pagó.

## Paso 2 · Clave de la cuenta de servicio de Firebase

Firebase Console → ⚙️ **Configuración del proyecto** → **Cuentas de servicio** →
**Generar nueva clave privada**. Se descarga un JSON. Lo necesitarás entero (en
una sola línea) para la variable `FIREBASE_SERVICE_ACCOUNT`.

## Paso 3 · Desplegar en Vercel (gratis)

Desde esta carpeta `payments-webhook/`:

```bash
npm i -g vercel        # una vez
cd payments-webhook
vercel                 # sigue el asistente (crea el proyecto)
```

En **Vercel → tu proyecto → Settings → Environment Variables** añade:

| Variable | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | Tu clave secreta de Stripe (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | (lo obtienes en el paso 4) |
| `FIREBASE_SERVICE_ACCOUNT` | El JSON del paso 2, en una sola línea |

Vuelve a desplegar (`vercel --prod`). Tu endpoint será algo como
`https://tu-proyecto.vercel.app/api/stripe-webhook`.

## Paso 4 · Conectar el webhook en Stripe

1. Stripe → **Developers → Webhooks → Add endpoint**.
2. URL: `https://tu-proyecto.vercel.app/api/stripe-webhook`
3. Evento a escuchar: **`checkout.session.completed`**.
4. Copia el **Signing secret** (`whsec_…`) y ponlo en Vercel como
   `STRIPE_WEBHOOK_SECRET`. Redepliega (`vercel --prod`).

## Listo ✅

A partir de ahora, cuando un alumno pague por el enlace, el cobro se marca solo
en la app. El botón manual del coach ("Registrar pago") sigue disponible como
respaldo por si algún pago no cuadra o se cobra por otro medio.

### Notas

- **Un coach = una cuenta de Stripe.** Este webhook usa una sola cuenta de
  Stripe (la del coach). Si en el futuro UDECA tiene muchos coaches, cada uno con
  su Stripe, habría que montar una plataforma con muchas cuentas conectadas. Es
  un cambio futuro; para uno o pocos coaches, esto vale.
- Hubo un alta de cuentas conectadas (`/api/connect`) para que cada coach cobrara
  desde la app sin pegar enlaces. Se quitó: obligaba a darse de alta en Stripe y
  cobraba lo mismo a todos los alumnos, calculado desde la cuota. Un enlace por
  alumno hace lo mismo, sirve igual para Bizum o PayPal y no obliga a nadie a
  nada.
- El webhook es **idempotente**: si Stripe reenvía un evento, no se cuenta el
  cobro dos veces.
- Bizum/PayPal no tienen webhook aquí: para esos, se sigue usando el flujo manual
  ("Ya he pagado" → confirmar).

## Extra · Apuntar el entreno dictado por voz (`/api/apuntar-entreno`)

Cuando alguien registra un entreno de días atrás, puede contarlo hablando en vez
de rellenar treinta casillas. El móvil pasa la voz a texto (el dictado del
teclado, o el del navegador en el ordenador) y este endpoint convierte ese texto
en series y marcas usando la API de Anthropic.

Vive aquí, y no en la app, porque **la clave es un secreto y el repositorio de la
app es público**: una clave metida en la app se saca del paquete en dos minutos
y la factura la paga UDECA.

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | Tu clave de https://console.anthropic.com (empieza por `sk-ant-…`) |
| `ANTHROPIC_MODEL` | *(opcional)* el modelo a usar. Sin ella se usa el que trae por defecto |

Notas:

- Solo atiende a quien tiene sesión iniciada en la app, y hay que demostrarlo con
  el token de Firebase: el `uid` no se acepta en el cuerpo de la petición.
- Hay un **tope de 40 dictados por persona y día**, contado en la colección
  `aiUsage` de Firestore. Es lo que impide que una cuenta desbocada se lleve la
  factura por delante.
- El endpoint **no escribe nada** en el histórico: devuelve lo que ha entendido y
  la app se lo enseña a la persona, que es quien confirma. Una IA que escribe
  sola en el historial de alguien es una IA que un día le apunta cuarenta
  dominadas que no hizo.
- Si no pones `ANTHROPIC_API_KEY`, el resto de la app funciona igual: el botón de
  dictar avisa de que no se pudo apuntar y el entreno se sigue registrando a
  mano.
