import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Cinzel_600SemiBold, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { CardRendererHost } from '../components/CardRendererHost';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingScreen } from '../components/LoadingScreen';
import { ToastHost } from '../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { installGlobalErrorLogging } from '../lib/errorLog';
import { colors, gradients } from '../lib/theme';

/**
 * Engancha una sola vez el registro de errores no capturados. Vive dentro del
 * AuthProvider para poder adjuntar a cada fallo el usuario afectado, que es lo
 * que permite escribirle y saber si le pasa a uno o a todos.
 */
function GlobalErrorLogger() {
  const { profile } = useAuth();
  // Ref en vez de dependencia: el manejador se instala una vez y lee siempre
  // el uid más reciente, sin reinstalarse en cada login.
  const uidRef = useRef<string | undefined>(undefined);
  uidRef.current = profile?.uid;
  useEffect(() => {
    installGlobalErrorLogging(() => uidRef.current);
  }, []);
  return null;
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);
  const [fontsLoaded] = useFonts({
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Fondo de la app: una sola capa detrás de todo. Al vivir aquí y no en
          cada pantalla, se queda quieto mientras el contenido se desplaza, que
          es lo que hace que se lea como fondo y no como una cabecera de color. */}
      <LinearGradient
        colors={gradients.appBackground}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {Platform.OS === 'web' ? (
        <Head>
          <title>UDECA — Universidad de Calistenia</title>
        </Head>
      ) : null}
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <GlobalErrorLogger />
          <ToastHost />
          {/* Motor oculto de las tarjetas PNG para compartir (solo móvil). */}
          <CardRendererHost />
          {!fontsLoaded ? (
            <LoadingScreen />
          ) : (
            // Si una pantalla falla al pintarse, se muestra un aviso con opción
            // de reintentar en vez de dejar la app en blanco.
            <ErrorBoundary>
              <Stack
                screenOptions={{
                  headerShown: false,
                  // Transparente para que se vea el degradado de detrás.
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </ErrorBoundary>
          )}
          {!splashDone ? <AnimatedSplash onFinish={() => setSplashDone(true)} /> : null}
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
