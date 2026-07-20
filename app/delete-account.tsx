import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';

export default function DeleteAccount() {
  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.background }}>
      <Text style={styles.title}>Eliminar tu cuenta de UDECA</Text>

      <View style={styles.section}>
        <Text style={styles.body}>
          Para eliminar tu cuenta y todos tus datos asociados (perfil, rutinas, historial de
          entrenamientos, pagos, fotos de progreso y mensajes), envía un email desde la
          dirección con la que te registraste a:
        </Text>
        <Text style={styles.email}>luistenaf@gmail.com</Text>
        <Text style={styles.body}>
          Asunto: "Eliminar cuenta". Procesaremos la solicitud en un máximo de 30 días.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Qué se elimina</Text>
        <Text style={styles.body}>
          Perfil (nombre, email, foto), rutinas y ejercicios asignados, historial de
          entrenamientos y estadísticas, registros de peso y nutrición, fotos de progreso,
          historial de pagos y mensajes con tu entrenador.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Qué se conserva</Text>
        <Text style={styles.body}>
          Ningún dato personal. Podemos conservar registros de facturación durante el tiempo
          exigido por la ley aplicable.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 720, alignSelf: 'center', width: '100%' },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  email: { ...typography.h3, color: colors.primary, marginVertical: spacing.sm },
});
