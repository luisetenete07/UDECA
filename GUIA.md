# Guía de uso de UDECA

La app vive en **https://app.udeca.app** (en www.udeca.app está la web de
presentación, con los planes y las descargas). Es gratuita de alojar,
se actualiza sola con cada mejora y funciona en móvil, tablet y ordenador.

---

## Para tus alumnos: primeros pasos

Mándales esto por WhatsApp:

> 1. Abre https://app.udeca.app en el navegador del móvil.
> 2. Pulsa "Regístrate", elige **Soy cliente** y usa el **código del
>    entrenador** que te he pasado.
> 3. Instálala como app: en iPhone (Safari) botón compartir → "Añadir a
>    pantalla de inicio"; en Android (Chrome) menú ⋮ → "Instalar
>    aplicación".

Tu código de invitación está en tu pestaña **Perfil**.

---

## Manual del entrenador

**Inicio** — Resumen del negocio, tablón de **anuncios** (con notificación
push a todos), lanzar/finalizar el **reto del grupo**, últimos entrenos y
alumnos inactivos con recordatorio de un toque.

**Clientes** — Lista con buscador. En la ficha de cada alumno:
- **Estado** (activo / en pausa / inactivo).
- **Hábitos diarios**: asigna hábitos ("Dormir 8h") y ve su cumplimiento.
- **Check-ins semanales**: cómo se siente el alumno, semana a semana.
- **Rutina**: editor completo — días fijados a días de la semana (chips
  L-D), series, reps, descanso en segundos (alimenta el cronómetro del
  alumno), indicaciones por ejercicio, **superseries** (encadenar sin
  descanso), reordenar con flechas y **copiar la rutina de otro alumno**.
- **Nutrición**: plan de calorías y macros.
- **Progreso**: peso, medidas, fotos de progreso e historial de sesiones
  (toca una sesión para ver el detalle serie a serie).
- **Informe PDF** con un botón.

**Ejercicios** — Tu biblioteca: nombre, grupo muscular, descripción y
enlace de vídeo.

**Cursos** — Crea cursos con secciones y lecciones. Solo los cursos
**publicados** son visibles para tus alumnos, y solo para los tuyos.

## Manual del alumno

**Inicio** — Anuncios del coach, check-in semanal (1 minuto), hábitos de
hoy para marcar, "**Hoy toca**" según la planificación semanal, racha y
objetivo semanal.

**Entreno** — El día de hoy viene preseleccionado. Al marcar cada serie
arranca el **cronómetro de descanso** (+30s / saltar). Verás tu marca de
la última vez en cada ejercicio, las indicaciones del coach y las
superseries señaladas. Al terminar: **resumen** con duración, volumen,
récords personales y racha.

**Progreso** — Peso, medidas, fotos (frente/perfil/espalda) y pestaña
**Actividad**: mapa de constancia de 12 semanas, volumen semanal y tus
ejercicios más entrenados.

**Social** — Ranking de rachas del grupo y el reto activo con su top-5.

**Perfil** (tocando tu avatar) — Foto, bio, nivel, peso objetivo, logros
y recordatorio diario de entrenamiento.

---

## Mantenimiento (para Luis)

- **Actualizar la app**: no hay que hacer nada; cada cambio en el código
  se publica solo en 2-3 minutos (GitHub Actions → GitHub Pages).
- **Reglas de Firestore**: cuando se añadan colecciones nuevas hay que
  volver a publicar `firestore.rules` en Firebase Console → Firestore →
  Reglas → pegar todo → Publicar.
- **Si un alumno ve una versión antigua**: que cierre la app del todo y
  la vuelva a abrir (dos veces si hace falta) o recargue con Ctrl+Shift+R.

## Pendiente / siguientes pasos

0. **Rehacer las 3 capturas de la web** (`web/assets/app-entreno.png`,
   `app-inicio.png`, `app-coach.png`). Son fotos de la app de ANTES del
   rediseño: se ven los títulos en Cinzel y las cifras del resumen en
   cuadraditos con icono, que ya no existen. Ahora mismo www.udeca.app
   anuncia una versión de la app que nadie se va a encontrar al entrar.
   Para rehacerlas: abre app.udeca.app en el móvil (o en el navegador con
   la vista de móvil), ve a esas tres pantallas y haz captura. Se
   sustituyen los ficheros con el mismo nombre y ya está.
1. **Vídeos de los cursos (Vimeo)** — ya integrado en la app:
   1. Crea cuenta en vimeo.com (el plan gratuito vale para empezar;
      Starter da más almacenamiento).
   2. Sube tu vídeo. En **Privacidad**: "Ocultar de Vimeo" (hide from
      Vimeo) y en **¿Dónde se puede incrustar?** elige "Solo en sitios
      específicos" y añade `app.udeca.app`.
   3. Copia el **enlace del vídeo** (botón compartir; si es oculto tendrá
      la forma `vimeo.com/123456789/a1b2c3`).
   4. En la app: Cursos → tu curso → pega ese enlace en el campo de vídeo
      de la lección y guarda. El reproductor oficial de Vimeo aparece
      dentro de la app, y al estar restringido a tu dominio nadie puede
      ver el vídeo fuera de UDECA.
2. **Google Play** (opcional): cuenta de desarrollador (25 $ una vez) +
   `npx eas build -p android`. La PWA ya cubre iPhone y Android sin coste.
3. **Notificaciones push en web instalada**: funcionan en Android/Chrome;
   en iPhone requieren iOS 16.4+ y la app añadida a pantalla de inicio.
