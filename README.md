# UDECA — Universidad de Calistenia

App multiplataforma (iOS, Android y Web) de UDECA (by Luis Tena /
luistenafit) para que el entrenador gestione a sus clientes, rutinas,
entrenamientos y progreso desde un único lugar, y para que cada cliente
acceda a su plan personalizado.

Construida con **Expo (React Native + React Native Web)** y **Firebase**
(autenticación + Firestore).

## Estado del proyecto — Fase 1, Fase 2 y Fase 3

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
