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

## 4 · La vista general del bloque

`lib/blockView.ts` → `components/BlockOverview.tsx`. Sale en tres sitios: la
ficha del ciclo, el progreso del alumno que ve el entrenador y el progreso que
ve el propio alumno o atleta.

Contesta de una vez a las tres preguntas que un entrenador se hace y que la app
no respondía en ninguna pantalla: **volumen** (las celdas), **equilibrio** (las
filas) y **frecuencia** (la última fila). Antes, las series por grupo estaban en
la pantalla del alumno, las marcas en la del coach, la frecuencia no la
calculaba nadie, y nada estaba atado al bloque: había que sumarlo de cabeza, que
es exactamente lo que una hoja de cálculo te daba hecho.

### De dónde sale "lo previsto"

De la rutina activa, **por sesión**: series de cada grupo entre los días que no
son de descanso, multiplicado por los entrenos previstos de esa semana. Hacerlo
por sesión y no por semana tiene una consecuencia buena: en una semana de
descarga, con menos entrenos previstos, lo previsto baja solo.

Es una aproximación, y se nota en qué: la rutina no distingue la semana 1 de la
3, así que lo previsto se repite. Cuando el plan sepa de semanas (§2), esta
columna dejará de ser un promedio.

Si la rutina va **a sensaciones**, no hay previsión que enseñar y solo se
muestra lo hecho. Inventar una meta para poder pintar un porcentaje sería
mentir.

### Lo que no se cuenta

Las semanas que **aún no han empezado** no entran en el cumplimiento y en la
tabla enseñan solo lo previsto. Contarlas dejaba a cualquiera al 25 % el primer
lunes del bloque, que es la forma más rápida de que nadie vuelva a mirar ese
número.

### Los avisos

Como mucho **dos problemas y una buena noticia**. Con más, se convierte en una
lista que nadie lee y el que importaba queda enterrado.

| Aviso | Cuándo |
| --- | --- |
| Grupo a cero | Programado (≥ 4 series) y sin tocar en todo el bloque. Todos los grupos en un solo aviso. |
| Desequilibrio | Lo **previsto** reparte 1,6 a 1 o peor entre empuje y tirón. |
| Se salta el patrón | El plan está equilibrado pero lo hecho no, y no hay ninguna semana caída que lo explique. |
| La descarga no descargó | Una semana de descarga ya cerrada con tanto volumen como la anterior. |
| Semana caída | Una semana cerrada con la mitad o menos de los entrenos previstos. |
| Progresión | El ejercicio que más ha subido (mínimo tres sesiones). |

Ninguno es opinable, y es a propósito: **un aviso que un entrenador serio
considera una tontería quema la confianza en todos los demás**. Por eso el
desequilibrio se mide sobre lo previsto —lo que el entrenador controla— y no
sobre lo hecho: si el plan está bien y falla la adherencia, el problema es otro
y se dice con otras palabras, o no se dice si ya está reportado como semana
caída. Sería el mismo aviso dos veces.

### Lo que todavía no se puede medir

**La intensidad real.** La app guarda el RIR que el entrenador programa, pero
quien entrena no dice nunca cómo le fue: `LoggedSet` tiene repeticiones, peso y
poco más. Está decidido que se pedirá **solo a atletas y a los alumnos que el
entrenador marque como avanzados** —al principiante el RIR no le suena y lo
rellenaría al azar, que es peor que no tenerlo— pero todavía no está hecho.

---

## 5 · Borrar

Borrar un ciclo con hijos borra **el plan entero** (`deleteCycles` con
`descendantIds`), y el aviso dice cuántos ciclos se llevará por delante. Los
`workoutLogs` **no se tocan nunca**: la pertenencia se calcula por fechas, así
que el historial del alumno sobrevive a cualquier replanificación.

---

## 6 · Comprobaciones

```bash
node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-cycle-plan.mjs
node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-block-view.mjs
```

(El gancho de `scripts/_ts-hook.mjs` solo resuelve las extensiones de los
imports; el código de la app no las lleva, ni debe.)

**`check-cycle-plan`** comprueba el cálculo de fechas: que el plan se alinee al
lunes, que los bloques encajen sin huecos ni solapes, que la descarga caiga
donde toca, que el árbol se reconstruya bien —incluidos los ciclos huérfanos— y
que dos planes seguidos no se mezclen. Son fechas, que es justo donde los fallos
no se ven: un plan con una semana de más parece correcto en pantalla y
descuadra el mes siguiente.

**`check-block-view`** comprueba los números y, sobre todo, los avisos: que
salgan cuando deben y —lo que más importa— **que no salgan cuando no deben**.
