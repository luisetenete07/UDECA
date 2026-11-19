import React from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Texto';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from '../lib/auth-context';
import { colors, spacing, typography } from '../lib/theme';

export default function Index() {
  const { loading, firebaseUser, profile, isFirebaseConfigured } = useAuth();

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

  // Entró con Google y todavía no tiene perfil: Google da una identidad, no
  // un rol, y sin rol no hay app a la que mandarle. Sin esto se quedaría en un
  // bucle —con la sesión abierta y viendo la pantalla de entrar—.
  if (firebaseUser && !profile) {
    return <Redirect href="/(auth)/completar" />;
  }

  // Sin presentación: la app es de Luis para sus alumnos, y quien llega ya sabe
  // a qué viene. Directo a entrar.
  if (!firebaseUser || !profile) {
    return <Redirect href="/(auth)/login" />;
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
