# Calistenia Coach

App multiplataforma (iOS, Android y Web) para que un entrenador de calistenia
gestione a sus clientes, rutinas, entrenamientos y progreso desde un único
lugar, y para que cada cliente acceda a su plan personalizado.

Construida con **Expo (React Native + React Native Web)** y **Firebase**
(autenticación + Firestore).

## Estado del proyecto — Fase 1 (MVP)

Implementado en esta fase:

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

Pendiente para fases siguientes (ver `APP PARA ENTRENADORES PERSONALES`):
nutrición, chat integrado, medidas corporales, notificaciones push,
reportes PDF.

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

## 5. Cómo funciona la vinculación entrenador–cliente

No hay panel de administración para crear usuarios: cada persona se
registra ella misma.

1. El entrenador se registra eligiendo "Soy entrenador". Al crear la
   cuenta se genera automáticamente un **código de invitación** de 6
   caracteres, visible en la pestaña **Perfil**.
2. El entrenador comparte ese código con sus clientes (WhatsApp, email...).
3. Cada cliente se registra eligiendo "Soy cliente" e introduce ese código.
   Queda vinculado automáticamente a su entrenador y aparece en la lista de
   clientes de este.

## 6. Estructura del proyecto

```
app/                      Pantallas (expo-router, navegación por archivos)
  (auth)/                 Login y registro
  (trainer)/              Área del entrenador (tabs: inicio, clientes, ejercicios, perfil)
  (client)/                Área del cliente (tabs: inicio, entreno, progreso, perfil)
components/                Componentes de UI reutilizables
lib/
  firebase.ts              Inicialización de Firebase (auth + Firestore)
  auth-context.tsx         Contexto de autenticación y perfil de usuario
  types.ts                 Tipos de datos (Firestore)
  theme.ts                 Colores, tipografía y espaciados
  firestore/                Funciones de acceso a datos por colección
firestore.rules            Reglas de seguridad de Firestore
```

## 7. Modelo de datos (Firestore)

| Colección       | Descripción                                                   |
| ---------------- | -------------------------------------------------------------- |
| `users`           | Perfiles de entrenador y cliente (`role`, `trainerId`, etc.)   |
| `trainerCodes`     | Mapa público `código → trainerId` para el registro de clientes |
| `exercises`        | Biblioteca de ejercicios de cada entrenador                    |
| `routines`          | Rutinas asignadas a cada cliente (días, ejercicios, series)     |
| `workoutLogs`       | Entrenamientos registrados por cada cliente                     |
| `weightLogs`        | Registros de peso de cada cliente                                |

## 8. Publicar (build)

- **Web**: `npx expo export --platform web` genera una build estática en
  `dist/`, lista para desplegar en cualquier hosting estático (Firebase
  Hosting, Vercel, Netlify...).
- **iOS / Android**: usa [EAS Build](https://docs.expo.dev/build/introduction/)
  (`npx eas build`) para generar los binarios de las tiendas.
