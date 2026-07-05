import React, { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../lib/auth-context';
import { colors, radius, spacing, typography } from '../../lib/theme';

export default function TrainerProfileScreen() {
  const { profile, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!profile?.inviteCode) return;
    const message = `Únete a mis entrenamientos en UDECA. Descarga la app y regístrate como cliente usando este código: ${profile.inviteCode}`;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(profile.inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silently ignore clipboard failures (e.g. insecure context).
      }
    } else {
      await Share.share({ message });
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Perfil</Text>

      <Card style={styles.section}>
        <Text style={styles.name}>{profile?.name}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Código de invitación</Text>
        <Text style={styles.helperText}>
          Comparte este código con tus clientes para que se registren y queden vinculados a ti
          automáticamente.
        </Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{profile?.inviteCode}</Text>
        </View>
        <Button
          title={copied ? 'Copiado' : Platform.OS === 'web' ? 'Copiar código' : 'Compartir código'}
          variant="secondary"
          onPress={handleShare}
        />
      </Card>

      <Button title="Cerrar sesión" variant="danger" onPress={signOut} style={{ marginTop: spacing.lg }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  name: { ...typography.h2, color: colors.text },
  email: { ...typography.small, color: colors.textMuted },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  helperText: { ...typography.small, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  codeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  code: {
    ...typography.h1,
    color: colors.primary,
    letterSpacing: 4,
  },
});
