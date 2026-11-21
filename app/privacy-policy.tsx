import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Texto';
import { colors, spacing, typography } from '../lib/theme';

export default function PrivacyPolicy() {
  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.background }}>
      <Text style={styles.title}>Política de privacidad de Mastery</Text>
      <Text style={styles.updated}>Última actualización: noviembre 2026</Text>

      <Text style={styles.intro}>
        Mastery es la aplicación de entrenamiento de calistenia de Luis Tena para sus
        alumnos. Esta política explica qué datos tratamos, con qué finalidad y qué derechos tienes.
        El responsable del tratamiento es Luis Tena; puedes contactar en cualquier momento en{' '}
        <Text style={styles.bold}>luistenaf@gmail.com</Text>.
      </Text>

      <Section title="1. Datos que recogemos">
        Recogemos únicamente los datos necesarios para prestar el servicio:{'\n\n'}
        • <Text style={styles.bold}>Datos de cuenta:</Text> nombre y correo electrónico (para el
        registro y el inicio de sesión).{'\n'}
        • <Text style={styles.bold}>Perfil:</Text> foto de perfil (opcional) y objetivos de
        entrenamiento.{'\n'}
        • <Text style={styles.bold}>Datos de entrenamiento y forma física:</Text> rutinas, series,
        repeticiones, cargas (lastre), peso corporal (y su foto, si la añades), sensaciones, hábitos, retos y estadísticas de
        progreso.{'\n'}
        • <Text style={styles.bold}>Nutrición:</Text> macros y datos que introduzcas.{'\n'}
        • <Text style={styles.bold}>Comunicación:</Text> mensajes con Luis, y
        anuncios del grupo.{'\n'}
        • <Text style={styles.bold}>Datos técnicos:</Text> un identificador de dispositivo para
        notificaciones push (solo si las activas).
      </Section>

      <Section title="2. Para qué usamos tus datos">
        Tratamos tus datos para: ofrecerte el servicio de entrenamiento y seguimiento con Luis;
        mostrarte tu progreso y estadísticas;
        gestionar tu cuenta y la relación con Luis; y enviarte notificaciones relacionadas
        con tu entrenamiento (solo si las activas). La app no cobra nada ni guarda datos de pago. No
        usamos tus datos para publicidad ni para elaborar perfiles comerciales.
      </Section>

      <Section title="3. Proveedores y con quién se comparten">
        Tus datos de entrenamiento son visibles para tu <Text style={styles.bold}>entrenador
        asignado</Text>, Luis Tena (no lo son para otros alumnos, salvo la clasificación del grupo y tu
        estado en línea, que puedes tratar con Luis).{'\n\n'}
        Para funcionar, la app se apoya en proveedores de infraestructura que actúan como encargados
        del tratamiento:{'\n'}
        • <Text style={styles.bold}>Firebase (Google):</Text> autenticación, base de datos y
        almacenamiento de imágenes.{'\n'}
        • <Text style={styles.bold}>Expo:</Text> envío de notificaciones push.{'\n\n'}
        No vendemos ni cedemos tus datos a terceros con fines publicitarios.
      </Section>

      <Section title="4. Transferencias internacionales">
        Algunos de nuestros proveedores (Google, Expo) pueden tratar datos en servidores
        situados fuera del Espacio Económico Europeo. En esos casos, la transferencia se ampara en las
        garantías previstas por el RGPD (como las Cláusulas Contractuales Tipo de la Comisión Europea).
      </Section>

      <Section title="5. Conservación">
        Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta o lo solicitas,
        borramos tus datos personales, salvo los que debamos conservar por obligaciones legales.
      </Section>

      <Section title="6. Tus derechos">
        Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión,
        oposición, limitación y portabilidad de tus datos. Muchos de ellos los puedes ejercer
        directamente desde la app (editar tu perfil, borrar registros o eliminar tu cuenta). Para
        cualquier otra solicitud, escríbenos a{' '}
        <Text style={styles.bold}>luistenaf@gmail.com</Text>. Si consideras que no hemos atendido
        correctamente tu solicitud, tienes derecho a reclamar ante la autoridad de control competente
        (en España, la Agencia Española de Protección de Datos, aepd.es).
      </Section>

      <Section title="7. Eliminar tu cuenta y tus datos">
        Puedes eliminar tu cuenta desde los ajustes de la app o solicitándolo en{' '}
        <Text style={styles.bold}>luistenaf@gmail.com</Text>. Al hacerlo, borramos tu perfil y tus
        datos de entrenamiento asociados.
      </Section>

      <Section title="8. Menores">
        Mastery no está dirigida a menores de 14 años. Si eres menor de esa edad, no debes usar la app
        sin el consentimiento de tus padres o tutores.
      </Section>

      <Section title="9. Cambios en esta política">
        Podemos actualizar esta política para reflejar cambios en el servicio o en la normativa.
        Publicaremos siempre la versión vigente en esta misma página, indicando la fecha de última
        actualización.
      </Section>

      <Section title="10. Contacto">
        Para cualquier duda sobre privacidad o para ejercer tus derechos, escríbenos a{' '}
        <Text style={styles.bold}>luistenaf@gmail.com</Text>.
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
  intro: { ...typography.body, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  bold: { color: colors.text, fontWeight: '600' },
});
