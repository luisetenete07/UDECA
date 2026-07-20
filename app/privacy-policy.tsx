import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';

export default function PrivacyPolicy() {
  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.background }}>
      <Text style={styles.title}>Política de privacidad de UDECA</Text>
      <Text style={styles.updated}>Última actualización: julio 2026</Text>

      <Section title="1. Datos que recogemos">
        Nombre, email, foto de perfil (opcional), datos de entrenamiento (rutinas, series,
        repeticiones, pesos), peso corporal, fotos de progreso (opcional), datos de nutrición
        y mensajes con tu entrenador.
      </Section>
      <Section title="2. Para qué los usamos">
        Ofrecer el servicio de entrenamiento y seguimiento con tu coach, mostrarte tu progreso
        y estadísticas, y comunicarte notificaciones relacionadas con tu entrenamiento y pagos.
      </Section>
      <Section title="3. Con quién se comparten">
        Tus datos son visibles para tu entrenador asignado en UDECA. No vendemos ni compartimos
        tus datos con terceros con fines publicitarios. Usamos Firebase (Google) como proveedor
        de infraestructura (autenticación y base de datos).
      </Section>
      <Section title="4. Conservación">
        Conservamos tus datos mientras tu cuenta esté activa. Puedes solicitar su eliminación
        en cualquier momento (ver "Eliminar cuenta").
      </Section>
      <Section title="5. Tus derechos">
        Puedes acceder, corregir o eliminar tus datos en cualquier momento escribiendo a{' '}
        <Text style={styles.bold}>luistenaf@gmail.com</Text> o desde la app.
      </Section>
      <Section title="6. Contacto">
        Para cualquier duda sobre privacidad: luistenaf@gmail.com
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 720, alignSelf: 'center', width: '100%' },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  updated: { ...typography.small, color: colors.textMuted, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  bold: { color: colors.text, fontWeight: '600' },
});
