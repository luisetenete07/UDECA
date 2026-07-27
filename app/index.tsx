import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from '../lib/auth-context';
import { hasSeenIntro } from '../lib/intro';
import { colors, spacing, typography } from '../lib/theme';

export default function Index() {
  const { loading, firebaseUser, profile, isFirebaseConfigured } = useAuth();
  // null = todavía no sabemos si este dispositivo ya vio la presentación.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  useEffect(() => {
    hasSeenIntro().then(setIntroSeen);
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <View style={styles.warnContainer}>
        <Text style={styles.warnTitle}>Falta configurar Firebase</Text>
        <Text style={styles.warnText}>
          Crea un archivo .env en la raíz del proyecto (puedes copiar .env.example) con las
          credenciales de tu proyecto de Firebase y reinicia la app. Consulta el README para
          más detalles.
        </Text>
      </View>
    );
  }

  if (loading) {
    return <LoadingScreen label="Cargando..." />;
  }

  if (!firebaseUser || !profile) {
    if (introSeen === null) return <LoadingScreen label="Cargando..." />;
    // Primera vez en este dispositivo: antes de pedir nada, contamos qué es
    // UDECA. Después, directo al inicio de sesión.
    return <Redirect href={introSeen ? '/(auth)/login' : '/(auth)/welcome'} />;
  }

  if (profile.role === 'trainer') {
    return <Redirect href="/(trainer)/dashboard" />;
  }

  return <Redirect href="/(client)/dashboard" />;
}

const styles = StyleSheet.create({
  warnContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  warnTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  warnText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
