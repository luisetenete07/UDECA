# UDECA — Universidad de Calistenia

App multiplataforma (iOS, Android y Web) de UDECA (by Luis Tena /
luistenafit) para que el entrenador gestione a sus clientes, rutinas,
entrenamientos y progreso desde un único lugar, y para que cada cliente
acceda a su plan personalizado.

Construida con **Expo (React Native + React Native Web)** y **Firebase**
(autenticación + Firestore).

## Producción

- **App en vivo**: https://app.udeca.app (dominio propio con HTTPS;
  instalable en el móvil desde "Añadir a pantalla de inicio").
- **Web pública**: https://www.udeca.app — presentación, planes y
  descargas. Vive en `web/` y se despliega aparte; ver `docs/WEB.md`.
- **Comunidad**: https://comunidad.udeca.app — la puerta al grupo privado
  de Telegram (`comunidad/`).
- **Despliegue automático**: cada push a la rama de desarrollo compila la
  web y la publica en GitHub Pages vía `.github/workflows/deploy.yml`.
  No hay despliegues manuales.
- **Offline**: un service worker (`public/sw.js`) cachea la aplicación
  para carga instantánea y uso sin conexión (los datos de Firebase
  siempre van a red).

## Estado del proyecto

Implementado hasta ahora:

**Fase 1 (MVP)**
- **Login y registro** con dos roles: entrenador y cliente.
- **Vinculación cliente–entrenador** mediante un código de invitación (sin
  necesidad de backend propio ni Cloud Functions).
- **Gestión de clientes**: listado, búsqueda, ficha de cliente.
- **Biblioteca de ejercicios**: creación, edición, filtro por grupo
  muscular, vídeo explicativo (enlace).
- **Creación de rutinas**: días de entrenamiento, ejercicios, series y
  repeticiones, asignación a cada cliente.
- **Registro de entrenamientos**: el cliente marca series completadas, reps
  y peso por sesión.
- **Seguimiento de peso**: registro semanal y gráfica de evolución.
- **Dashboards**: resumen para entrenador (clientes activos, últimos
  entrenamientos, alertas de inactividad) y para cliente (próximo
  entrenamiento, peso actual, resumen semanal).

**Fase 2**
- **Nutrición**: el entrenador crea un plan (calorías y macros) por
  cliente; el cliente registra comidas y ve su consumo del día frente al
  objetivo con barras de progreso.
- **Sección Social**: ranking de constancia de los miembros del mismo
  coaching (racha, entrenos de la semana y totales), con métricas públicas
  no sensibles almacenadas aparte del perfil.
- **Medidas corporales**: registro de pecho, cintura, cadera, brazo y
  muslo, con gráfica de evolución de cintura.
- **Gráficos de progreso**: componente de gráfica de líneas reutilizable
  (`components/LineChart.tsx`) usado tanto para el peso como para las
  medidas corporales.

**Fase 3**
- **Notificaciones push**: aviso al cliente cuando el entrenador le asigna
  o actualiza una rutina o un plan nutricional, y aviso a quien no está
  mirando el chat cuando recibe un mensaje nuevo. Se envían directamente
  desde el cliente a la API de Expo Push (sin servidor propio ni Cloud
  Functions). **Requiere haber creado un proyecto EAS** (`npx eas init`)
  para que se genere el `projectId` en `app.json` — sin él, la app sigue
  funcionando con normalidad pero no se registran tokens push.
- **Reportes PDF**: botón "Generar informe PDF" en la ficha de cada
  cliente (rutina, plan nutricional, medidas, historial de peso y
  entrenamientos), generado con `expo-print` y compartido con
  `expo-sharing`. En web abre el diálogo de impresión del navegador.
- **Automatizaciones**: recordatorio de un toque para que el entrenador
  avise a un cliente inactivo (envía un mensaje de chat + notificación
  push), y aviso automático al cliente en su panel si lleva más de una
  semana sin registrar su peso.
- **Mejoras de diseño**: feedback háptico en los botones (iOS/Android).

**Fase 4 — Identidad UDECA y experiencia élite**
- **Rebranding UDECA**: negro + oro (#A2968B), tipografías Cinzel/Inter,
  logotipos reales, degradados oro, halos y tarjetas con filo dorado.
- **Perfil de alumno enriquecido**: foto de perfil (base64 en Firestore),
  bio, nivel, peso objetivo, logros/insignias y recordatorio diario de
  entrenamiento configurable.
- **Cursos en vídeo**: cursos → secciones → lecciones, privados y solo
  visibles para alumnos del entrenador cuando están publicados;
  reproductor sin descarga.
- **Fotos de progreso**: frente/perfil/espalda, visibles solo para el
  alumno y su entrenador.
- **Entreno inmersivo**: barra de progreso de sesión, ejercicio actual
  destacado, cronómetro de descanso entre series (+30s/saltar),
  detección de récords personales y pantalla resumen post-entreno
  (duración, series, reps, volumen, PRs, racha).
- **Planificación semanal**: cada día de rutina puede fijarse a un día de
  la semana; el alumno ve "Hoy toca"/descanso y el día preseleccionado.
- **Editor de rutinas pro**: descanso y notas por ejercicio, superseries
  (sin descanso entre encadenados), reordenar y copiar la rutina de otro
  alumno.
- **Check-in semanal**: energía/sueño/adherencia/sensaciones (1-5) + nota;
  el entrenador ve el histórico en la ficha.
- **Hábitos diarios**: el entrenador los asigna; el alumno los marca cada
  día desde su inicio.
- **Anuncios del coach**: tablón con push a todos los alumnos.
- **Retos del grupo**: un reto activo con ranking de sesiones en Social.
- **Estadísticas avanzadas**: mapa de constancia de 12 semanas, volumen
  semanal y top de ejercicios más entrenados.
- **Estado del alumno** (activo/pausa/inactivo) gestionado por el
  entrenador.

## 1. Requisitos

- Node.js 20+
- Una cuenta de [Firebase](https://console.firebase.google.com/)

## 2. Configurar Firebase

1. Ve a la [consola de Firebase](https://console.firebase.google.com/) y crea
   un proyecto nuevo (gratis, plan Spark es suficiente para empezar).
2. Dentro del proyecto, ve a **Compilación → Authentication → Comenzar** y
   activa el proveedor **Correo electrónico/contraseña**.
3. Ve a **Compilación → Firestore Database → Crear base de datos** (modo
   producción, elige la región más cercana a tus clientes).
4. Ve a **Configuración del proyecto** (icono de engranaje) → pestaña
   **General** → sección "Tus apps" → pulsa el icono `</>` para registrar una
   app web (sirve para las tres plataformas, ya que React Native Web
   reutiliza la misma configuración).
5. Copia los valores de `firebaseConfig` que te muestra Firebase.
6. En la raíz de este proyecto, copia `.env.example` como `.env`:

   ```bash
   cp .env.example .env
   ```

7. Rellena `.env` con los valores copiados en el paso 5 (todas las
   variables empiezan por `EXPO_PUBLIC_`, así Expo las incluye en el
   bundle de la app).

8. Sube las reglas de seguridad de Firestore (`firestore.rules`) a tu
   proyecto. Puedes hacerlo de dos formas:
   - **Consola** (más sencillo): abre Firestore Database → pestaña
     **Reglas**, pega el contenido de `firestore.rules` y publica.
   - **CLI**: `npx firebase-tools login` y luego
     `npx firebase-tools deploy --only firestore:rules`.

Sin este paso, cualquier usuario autenticado podría leer o escribir datos de
otros usuarios.

## 3. Instalar dependencias

```bash
npm install
```

## 4. Arrancar la app

```bash
npm run web       # navegador (ordenador / tablet)
npm run ios       # simulador iOS (requiere macOS)
npm run android   # emulador / dispositivo Android
```

Si `.env` no existe o le faltan variables, la app mostrará una pantalla
avisando de que falta configurar Firebase en lugar de fallar.

## 5. Activar notificaciones push (opcional)

Las notificaciones push (rutina asignada, mensajes de chat, recordatorios)
usan el servicio gratuito de Expo Push Notifications y no requieren
servidor propio, pero sí necesitan un proyecto EAS:

```bash
npx eas login       # crea una cuenta gratuita en expo.dev si no tienes una
npx eas init
```

Esto añade automáticamente un `extra.eas.projectId` a `app.json`. A partir
de ahí, cada usuario que abra la app en un dispositivo físico (no
simulador) y conceda permiso de notificaciones quedará registrado. Sin
este paso, la app funciona igual pero no se enviarán notificaciones.

## 6. Cómo funciona la vinculación entrenador–cliente

No hay panel de administración para crear usuarios: cada persona se
registra ella misma.

1. El entrenador se registra eligiendo "Soy entrenador". Al crear la
   cuenta se genera automáticamente un **código de invitación** de 6
   caracteres, visible en la pestaña **Perfil**.
2. El entrenador comparte ese código con sus clientes (WhatsApp, email...).
3. Cada cliente se registra eligiendo "Soy cliente" e introduce ese código.
   Queda vinculado automáticamente a su entrenador y aparece en la lista de
   clientes de este.

## 7. Estructura del proyecto

```
app/                      Pantallas (expo-router, navegación por archivos)
  (auth)/                 Login y registro
  (trainer)/              Área del entrenador (tabs: inicio, clientes, ejercicios, perfil)
  (client)/                Área del cliente (tabs: inicio, entreno, nutrición, progreso, social, perfil)
components/                Componentes de UI reutilizables
lib/
  firebase.ts              Inicialización de Firebase (auth + Firestore)
  auth-context.tsx         Contexto de autenticación y perfil de usuario
  types.ts                 Tipos de datos (Firestore)
  theme.ts                 Colores, tipografía y espaciados
  notifications.ts          Registro y envío de notificaciones push (Expo)
  report.ts                 Generación del HTML del informe PDF de cliente
  firestore/                Funciones de acceso a datos por colección
firestore.rules            Reglas de seguridad de Firestore
```

## 8. Modelo de datos (Firestore)

| Colección       | Descripción                                                   |
| ---------------- | -------------------------------------------------------------- |
| `users`           | Perfiles de entrenador y cliente (`role`, `trainerId`, etc.)   |
| `trainerCodes`     | Mapa público `código → trainerId` para el registro de clientes |
| `exercises`        | Biblioteca de ejercicios de cada entrenador                    |
| `routines`          | Rutinas asignadas a cada cliente (días, ejercicios, series)     |
| `workoutLogs`       | Entrenamientos registrados por cada cliente                     |
| `weightLogs`        | Registros de peso de cada cliente                                |
| `bodyMeasurements`   | Medidas corporales de cada cliente (pecho, cintura, cadera...)  |
| `nutritionPlans`     | Planes nutricionales asignados a cada cliente                    |
| `mealLogs`           | Comidas registradas por cada cliente                              |
| `socialStats`         | Métricas públicas por miembro para el ranking social (no sensibles) |
| `courses`             | Cursos en vídeo (secciones y lecciones); publicados = visibles para alumnos |
| `progressPhotos`      | Fotos de progreso (frente/perfil/espalda), privadas alumno+entrenador |
| `checkIns`            | Check-ins semanales del alumno (energía, sueño, adherencia, sensaciones) |
| `announcements`       | Anuncios del entrenador para su grupo                            |
| `habits`              | Hábitos diarios asignados por el entrenador a cada alumno         |
| `habitLogs`           | Registro diario de hábitos cumplidos (creado por el alumno)       |
| `challenges`          | Retos del grupo (uno activo por entrenador; ranking en Social)    |

## 9. Añadir el logo real (icono, splash y favicon)

Por ahora la app usa los iconos de ejemplo que genera Expo por defecto. Para
poner el logo real de UDECA, sustituye estos archivos en `assets/` por el
tuyo (mismo nombre, mismas dimensiones — puedes exportarlos con cualquier
editor de imagen o herramienta online tipo Canva/Figma):

| Archivo                             | Tamaño     | Uso                                  |
| ------------------------------------ | ---------- | ------------------------------------- |
| `assets/icon.png`                     | 1024×1024  | Icono de la app (iOS, Android, web)   |
| `assets/splash-icon.png`              | 1024×1024  | Pantalla de carga (fondo negro)       |
| `assets/android-icon-foreground.png`  | 512×512    | Icono adaptable de Android (primer plano, fondo transparente) |
| `assets/android-icon-background.png`  | 512×512    | Icono adaptable de Android (fondo, ya en negro) |
| `assets/android-icon-monochrome.png`  | 432×432    | Versión monocromo (Android 13+)       |
| `assets/favicon.png`                  | 48×48      | Icono de pestaña en el navegador web  |

Recomendación: usa tu logo del tridente en plata/blanco sobre fondo negro
para que combine con el resto de la app. Después de reemplazar los
archivos, reinicia el servidor (`npm start`) para que se regeneren los
iconos.

## 10. Publicar (build)

- **Web**: `npx expo export --platform web` genera una build estática en
  `dist/`, lista para desplegar en cualquier hosting estático (Firebase
  Hosting, Vercel, Netlify...).
- **iOS / Android**: usa [EAS Build](https://docs.expo.dev/build/introduction/)
  (`npx eas build`) para generar los binarios de las tiendas.
