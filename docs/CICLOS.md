# Planificación por ciclos

Cómo se planifica una temporada en UDECA, qué decide la app y qué decide el
entrenador.

---

## 1 · Los tres niveles

| Nivel | Qué es | Quién lo crea |
| --- | --- | --- |
| **Macrociclo** | La temporada entera. Contiene bloques. | El plan, de una vez |
| **Mesociclo** | Un bloque (acumulación, intensificación…). Contiene semanas. | El plan, de una vez |
| **Microciclo** | Una semana, de lunes a domingo. | El plan, de una vez |

Todo vive en la colección `trainingCycles`. Lo que los une es `parentId`: un
meso cuelga de su macro y un micro de su meso. `orderIndex` es su posición
dentro del padre (bloque 2, semana 3).

`parentId` es **opcional**: los ciclos sueltos —los que ya existían y los que se
crean a mano desde "Ciclo suelto"— no tienen padre y siguen funcionando como
siempre. Nada de esto es obligatorio: un entrenador que no planifique no ve
ningún cambio.

---

## 2 · Crear un plan

`components/CyclePlanSheet.tsx` → `lib/cyclePlan.ts` (`buildPlan`) →
`createCyclePlan` en `lib/firestore/cycles.ts`.

El entrenador elige una estructura (o la monta a mano), la fecha de inicio y
cuántos entrenos por semana. La app crea el macro, un meso por bloque y un micro
por semana, con las fechas ya encajadas.

Esto es lo que hace que la planificación se use: montar doce semanas a mano son
dieciséis formularios, y nadie los rellena dos veces. Así son treinta segundos, y
después se puede tocar cualquier ciclo por separado.

**Se escribe en un solo lote** (`writeBatch`). Los ids se generan antes de
escribir, porque un hijo necesita el id de su padre y en un lote no se puede leer
lo que se acaba de escribir. En un lote entra todo o no entra nada: nunca queda
un macrociclo a medio poblar porque se fuera la conexión.

### Dos decisiones que sostienen el resto

**El microciclo es una semana natural, de lunes a domingo.** No porque no existan
micros de diez días, sino porque el alumno vive en semanas: un calendario que
empieza en martes no se entiende de un vistazo. Quien necesite otra cosa crea un
ciclo suelto con las fechas que quiera.

**Saltarse un entreno no mueve el plan.** Las fechas son las que puso el
entrenador; lo que cambia es el cumplimiento que se ve en el calendario. Un plan
que se desplaza solo deja de ser un plan a la tercera semana, y además haría
imposible comparar dos alumnos con el mismo bloque.

### La semana de descarga

Marcada con `isDeload`, se pinta distinta y **pide un entreno menos** (nunca
menos de dos). Si la descarga pidiera lo mismo que una semana normal, el
cumplimiento saldría mal justo cuando el alumno está haciendo lo correcto.

---

## 3 · El calendario

`lib/cyclePlan.ts` → `planCalendar()` y `planSummary()`, pintados por
`components/PlanCalendar.tsx`.

Una fila por semana, agrupadas por bloque, con los siete días (relleno = entrenó)
y el cumplimiento de la semana (`hechos / previstos`). Ver catorce semanas
seguidas y dónde se cayó el alumno es lo que permite corregir a tiempo, que es
para lo que se planifica; una lista de ciclos con fechas no dice nada.

Detalles que importan:

- El recorrido va **semana a semana desde el macro**, no por la lista de micros.
  Así, una semana sin microciclo creado sale igualmente en su sitio en vez de
  dejar un hueco en mitad del calendario.
- Solo entra lo que cuelga de **ese** plan (`descendantIds`): dos macrociclos
  seguidos no se mezclan.
- El cumplimiento del resumen solo cuenta las semanas **cerradas y la actual**:
  incluir las futuras dejaría a todo el mundo al 20 % el primer día.

El alumno ve lo mismo resumido en su inicio: bloque, "semana 6 de 12" contada
sobre el plan entero (no sobre el bloque, que dice menos) y el aviso de descarga.

---

## 4 · Borrar

Borrar un ciclo con hijos borra **el plan entero** (`deleteCycles` con
`descendantIds`), y el aviso dice cuántos ciclos se llevará por delante. Los
`workoutLogs` **no se tocan nunca**: la pertenencia se calcula por fechas, así
que el historial del alumno sobrevive a cualquier replanificación.

---

## 5 · Comprobaciones

```bash
node --experimental-strip-types scripts/check-cycle-plan.mjs
```

Comprueba el cálculo puro: que el plan se alinee al lunes, que los bloques
encajen sin huecos ni solapes, que la descarga caiga donde toca, que el árbol se
reconstruya bien (incluidos los ciclos huérfanos), que el cumplimiento cuente lo
que debe y que dos planes seguidos no se mezclen.

Son fechas, que es justo donde los fallos no se ven: un plan con una semana de
más parece correcto en pantalla y descuadra el mes siguiente.
