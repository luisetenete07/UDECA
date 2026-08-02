# Cómo se cobra en UDECA

Un solo documento con las tres cosas que se cobran, quién las paga y —lo que
más problemas da— **dónde se puede enseñar un precio y dónde no**.

---

## 1 · Los tres cobros

| Qué | Cuánto | Quién | Dónde se cobra |
| --- | --- | --- | --- |
| **Alta** | 1 €, una vez | entrenador y atleta | web (`pagos.altaCoach` / `pagos.altaAtleta`) o app (`COACH_ENTRY_LINK` / `ATHLETE_ENTRY_LINK`) |
| **Plan del entrenador** | 180 €/año | entrenador con más de 5 alumnos | app (`COACH_PAYMENT_LINK`) |
| **Plan del atleta** | 10 €/mes | atleta pasados sus 14 días | app (`ATHLETE_PAYMENT_LINK`) |

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

### Cuándo empiezan los 14 días del atleta

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
     sus 14 días.
   - alumno → es la cuota que le paga a su entrenador.

Todos los eventos son idempotentes (colección `stripeEvents`): Stripe reenvía, y
un cobro no puede contar dos veces.
