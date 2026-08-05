# Rediseño: lo que queda

Estado a cierre de la sesión del 4 de agosto de 2026. El rediseño ya pasó por la
tipografía, los bordes, la jerarquía de cada pantalla, la vitrina de cifras, las
cabeceras y las tarjetas plegables (ver la fase 5 del README). Aquí está lo que
NO se hizo, con lo que se sabe de cada cosa para no empezar de cero.

---

## 1. Widgets reordenables en el panel

Hoy las tarjetas del panel del entrenador se **pliegan** y recuerdan cómo las
dejaste (`components/CollapsibleCard.tsx`, clave `panel-plegado-<id>` en
AsyncStorage). Falta poder **arrastrarlas** para cambiar su orden.

Lo que ya existe y sirve:

- `components/DragList.tsx` y `lib/useDragReorder.ts` — el gesto de reordenar
  con asa, ya usado en el editor de rutinas y en las categorías de ejercicios.
  El patrón de la app es **mantener pulsado el asa y mover**, no arrastrar desde
  cualquier punto: las tarjetas están llenas de cosas que se tocan.
- El mismo criterio de persistencia que el plegado: es una preferencia de cómo
  miras ESTA pantalla en ESTE dispositivo, así que va en AsyncStorage y no en la
  cuenta. Si se sincronizara, reordenar en el ordenador te cambiaría el móvil.

Trabajo real: dar identidad estable a cada widget, guardar el orden, y que las
tarjetas nuevas que se añadan en el futuro caigan al final en vez de perderse.

## 2. Progreso de cursos en el panel — EL DATO NO EXISTE

Comprobado en esta sesión. No hay por dónde empezar a pintarlo:

- `Lesson` (en `lib/types.ts`) no tiene ningún campo de completado.
- No hay colección de progreso de cursos en `lib/firestore/` (`progressTrackers`
  es otra cosa: los ejercicios que el entrenador vigila en la tabla).
- El visor del alumno (`app/(client)/courses/[id].tsx`) **solo lee**. Nunca
  escribe nada: abrir una lección no deja rastro en ninguna parte.

Así que esto es lo mismo que el punto 3, aunque no lo pareciera: primero hay que
**registrar qué lecciones ha visto cada alumno** —una funcionalidad nueva, con su
modelo, sus reglas de Firestore y su decisión de qué cuenta como "vista"
(¿abrirla?, ¿terminar el vídeo?, ¿marcarla a mano?)— y solo después se puede
enseñar el progreso en el panel. Lo segundo es una tarde; lo primero, no.

## 3. Mensajes en el panel — funcionalidad nueva, no rediseño

Tal como lo dejó dicho Luis: hoy no hay sistema de mensajes en la app. Lo más
parecido que existe son los **anuncios del coach** (tablón con push a todos) y el
recordatorio de un toque a un alumno inactivo, que son de una dirección y sin
conversación. Hay que decidir si se hace antes de diseñar nada.

## 4. Barrido de componentes: inputs, tabs, modales y calendarios

Tocados de refilón durante el rediseño, no uno a uno. Lo que se sabe:

- **Inputs**: `TextField` ya lleva la letra correcta (antes escribía en la del
  sistema) y el campo del código de invitación tiene tratamiento propio. Sin
  revisar: `DateField`, `RirPicker`, `MacroCalculator`.
- **Modales y hojas**: **17 ficheros se montan su propia hoja** con su
  `backdrop`, su `borderTopRadius` y sus paddings copiados —seis componentes
  (`QuickSheet`, `CycleSheet`, `CyclePlanSheet`, `WeekPlanSheet`, `TaskEditSheet`,
  `ProgressMatrix`) y once pantallas—. Es el mismo caso que tenía la vitrina
  antes de ser un componente: el patrón ya existe tres veces, así que toca
  sacarlo a un sitio.
- **Tabs**: hay al menos tres controles segmentados distintos (las pestañas de
  Progreso, el conmutador de músculos, los días de la pantalla de entreno).
  Ninguno comparte estilos con los otros.
- **Calendarios**: la rejilla de la agenda ya cuadra (cifras tabulares). Sin
  revisar: `PlanCalendar`, `ConsistencyMap`, `WeekStrip`.

Componentes que esta sesión NO abrió: `MacroCalculator`, `Onboarding`,
`UpgradeCard`, `CheckInCard`, `WeekStrip`, `ProgressMatrix`, `BlockOverview`,
`MuscleMap`, `LineChart`, `ConsistencyMap`, `ProgressRing`, `PlanCalendar`,
`DateField`, `RirPicker`, `MemberCard`, `Avatar`, `Toast`, `EmptyState`,
`ErrorState`, `DragList`, `Grid`.

## 5. Pantalla de entreno: la estructura

Es la que más tiempo se mira y la única grande que sigue con su estructura
original. Cuidado, porque en el rediseño **sí se le cambió bastante** y no hay que
rehacerlo:

Ya hecho — el ejercicio pasó a titular y el objetivo subió a su lado; el botón de
la serie lleva el número dentro y mide 52 px; la serie hecha se tiñe; la cuenta
atrás del descanso manda y avisa en ámbar los últimos diez segundos; el resumen
usa la vitrina.

Lo que sigue igual es el **esqueleto**: un ejercicio cada vez, con "Anterior" y
"Siguiente" abajo, las pestañas de días arriba y la tira de puntos en medio. La
pregunta de diseño que no se ha tocado es si ese recorrido es el correcto —o si
la sesión se lee mejor como una lista continua, o por gestos laterales— y esa es
una decisión de producto, no un ajuste de estilo.

---

## Lo que no se pudo verificar

**Nada del rediseño de la app está visto renderizado.** `expo export` falla en el
prerenderizado estático porque este contenedor no tiene credenciales de Firebase
(comprobado: falla igual sin los cambios). Todo se validó con `tsc --noEmit`, con
el empaquetado de Metro y con los scripts de `scripts/check-*.mjs`. Las decisiones
de tamaño y hueco están razonadas sobre el ancho de un móvil, pero no vistas.

La única parte vista de verdad es la web pública, que sí se pudo servir y
capturar en Chromium.
