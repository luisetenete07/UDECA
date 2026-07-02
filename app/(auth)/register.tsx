import React, { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { friendlyAuthError } from '../../lib/firebase-errors';
import { colors, radius, spacing, typography } from '../../lib/theme';
import type { UserRole } from '../../lib/types';

export default function RegisterScreen() {
  const { registerTrainer, registerClient } = useAuth();
  const [role, setRole] = useState<UserRole>('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name || !email || !password) {
      setError('Rellena todos los campos.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (role === 'client' && !inviteCode) {
      setError('Introduce el código de invitación de tu entrenador.');
      return;
    }

    setLoading(true);
    try {
      if (role === 'trainer') {
        await registerTrainer(name.trim(), email.trim(), password);
      } else {
        await registerClient(name.trim(), email.trim(), password, inviteCode);
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Elige cómo quieres usar la app</Text>
      </View>

      <View style={styles.roleSwitch}>
        <RoleOption
          label="Soy cliente"
          selected={role === 'client'}
          onPress={() => setRole('client')}
        />
        <RoleOption
          label="Soy entrenador"
          selected={role === 'trainer'}
          onPress={() => setRole('trainer')}
        />
      </View>

      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Tu nombre" />
      <TextField
        label="Correo electrónico"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="tucorreo@ejemplo.com"
      />
      <TextField
        label="Contraseña"
        secureTextEntry
        autoComplete="password-new"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 6 caracteres"
      />

      {role === 'client' ? (
        <TextField
          label="Código de tu entrenador"
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="Ej. 7XQK2M"
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Crear cuenta" onPress={handleSubmit} loading={loading} style={styles.submit} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
        <Link href="/(auth)/login" asChild>
          <Text style={styles.link}> Inicia sesión</Text>
        </Link>
      </View>
    </ScreenContainer>
  );
}

function RoleOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.roleOption, selected && styles.roleOptionSelected]}
    >
      <Text style={[styles.roleOptionText, selected && styles.roleOptionTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  roleSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  roleOptionSelected: {
    backgroundColor: colors.primary,
  },
  roleOptionText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textMuted,
  },
  roleOptionTextSelected: {
    color: colors.background,
  },
  error: {
    ...typography.small,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textMuted,
  },
  link: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
});
