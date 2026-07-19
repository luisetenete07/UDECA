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

1. En Stripe: **Payment Links** → **New** → crea un enlace con tu cuota (p. ej.
   "Cuota mensual UDECA", precio recurrente o único, como prefieras).
2. Copia la URL (`https://buy.stripe.com/...`).
3. Pégala en la app: **UDECA → Perfil (coach) → Cobros → Enlace de pago**.

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
  su Stripe, se migraría a **Stripe Connect** (una sola plataforma con muchos
  coaches). Es un cambio futuro; para uno o pocos coaches, esto vale.
- El webhook es **idempotente**: si Stripe reenvía un evento, no se cuenta el
  cobro dos veces.
- Bizum/PayPal no tienen webhook aquí: para esos, se sigue usando el flujo manual
  ("Ya he pagado" → confirmar).
