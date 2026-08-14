import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Texto';
import { colors, spacing, typography } from '../lib/theme';

export default function DeleteAccount() {
  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.background }}>
      <Text style={styles.title}>Eliminar tu cuenta de UDECA</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Desde la app, tú mismo</Text>
        <Text style={styles.body}>
          Entra en UDECA y ve a <Text style={styles.fuerte}>Perfil → Eliminar mi cuenta</Text>, al
          final de la pantalla. Son cinco pasos: te explicamos qué se borra, tienes que
          escribir "ELIMINAR MI CUENTA" y confirmar con tu contraseña. Al terminar, tu cuenta
          y tus datos desaparecen en el momento. Vale para cualquier tipo de perfil: alumno,
          atleta y entrenador.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Por correo, si prefieres</Text>
        <Text style={styles.body}>
          Escríbenos desde la dirección con la que te registraste a:
        </Text>
        <Text style={styles.email}>luistenaf@gmail.com</Text>
        <Text style={styles.body}>
          Asunto: "Eliminar cuenta". Procesaremos la solicitud en un máximo de 30 días. Es
          también la vía para pedir que se borren los restos que la app no puede quitar por
          sí sola (comidas y hábitos registrados, y los mensajes con tu entrenador, que
          conserva su copia).
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
  fuerte: { color: colors.text },
});
