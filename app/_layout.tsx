import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { ArranqueSeguro } from '../components/ArranqueSeguro';
import { CardRendererHost } from '../components/CardRendererHost';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingScreen } from '../components/LoadingScreen';
import { ToastHost } from '../components/Toast';
import { ActualizacionObligatoria } from '../components/ActualizacionObligatoria';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { installGlobalErrorLogging } from '../lib/errorLog';
import { colors } from '../lib/theme';
import { migrarClavesAntiguas } from '../lib/clavesAntiguas';

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
  /*
   * Las claves guardadas con el nombre anterior pasan a su nombre nuevo ANTES
   * de que nada las lea (lib/clavesAntiguas.ts): la cuenta, la cola de
   * entrenos sin subir y el borrador se leen en cuanto arranca la sesión. Con
   * un tope, por si el almacenamiento tardara: mejor arrancar que esperar.
   */
  const [clavesListas, setClavesListas] = useState(false);
  useEffect(() => {
    const tope = setTimeout(() => setClavesListas(true), 1500);
    migrarClavesAntiguas().finally(() => {
      clearTimeout(tope);
      setClavesListas(true);
    });
    return () => clearTimeout(tope);
  }, []);
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    /* Por encima de TODO, incluidas las fuentes y el gestor de gestos: si
       cualquiera de esas piezas falla al arrancar, sale un aviso legible en vez
       de una pantalla negra y una app que se cierra sola. Ver ArranqueSeguro. */
    <ArranqueSeguro>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {Platform.OS === 'web' ? (
        <Head>
          <title>CALICO — Calisthenics Coaches</title>
        </Head>
      ) : null}
      <SafeAreaProvider>
        {!clavesListas ? null : (
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
                  contentStyle: { backgroundColor: colors.background },
                }}
              />
            </ErrorBoundary>
          )}
          {!splashDone ? <AnimatedSplash onFinish={() => setSplashDone(true)} /> : null}
          {/* El muro de "actualiza para seguir", por encima de todo lo demás.
              Va aquí y no dentro de una pantalla porque tiene que tapar la app
              entera, esté donde esté quien la abre. */}
          <ActualizacionObligatoria />
        </AuthProvider>
        )}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ArranqueSeguro>
  );
}
