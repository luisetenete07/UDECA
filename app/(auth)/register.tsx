import React, { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { friendlyAuthError } from '../../lib/firebase-errors';
import { colors, fonts, gradients, radius, spacing, typography } from '../../lib/theme';
import type { UserRole } from '../../lib/types';

export default function RegisterScreen() {
  const { registerTrainer, registerClient, registerAthlete } = useAuth();
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
      } else if (role === 'athlete') {
        await registerAthlete(name.trim(), email.trim(), password);
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
    <ScreenContainer contentStyle={styles.content} maxWidth={560}>
      <View style={styles.header}>
        <LinearGradient
          colors={gradients.goldHalo}
          style={styles.heroGlow}
          pointerEvents="none"
        />
        <Logo compact />
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Elige cómo quieres usar la app</Text>
      </View>

      <Card accent style={styles.formCard}>
        {ROLE_CARDS.map((rc) => {
          const on = role === rc.value;
          return (
            <Pressable
              key={rc.value}
              onPress={() => setRole(rc.value)}
              style={[styles.roleCard, on && styles.roleCardOn]}
            >
              <View style={[styles.roleIcon, on && styles.roleIconOn]}>
                <Ionicons
                  name={rc.icon}
                  size={20}
                  color={on ? colors.primary : colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.roleCardTop}>
                  <Text style={[styles.roleCardTitle, on && styles.roleCardTitleOn]}>{rc.title}</Text>
                  <Text style={[styles.rolePrice, rc.free && styles.rolePriceFree]}>{rc.price}</Text>
                </View>
                <Text style={styles.roleCardDesc}>{rc.desc}</Text>
              </View>
              <Ionicons
                name={on ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={on ? colors.primary : colors.border}
              />
            </Pressable>
          );
        })}

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

        <Button
          title="Crear cuenta"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submit}
        />
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
        <Link href="/(auth)/login" asChild>
          <Text style={styles.link}> Inicia sesión</Text>
        </Link>
      </View>
    </ScreenContainer>
  );
}

const ROLE_CARDS: {
  value: UserRole;
  title: string;
  price: string;
  desc: string;
  free?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'client',
    title: 'Alumno',
    price: 'Gratis',
    free: true,
    icon: 'person-outline',
    desc: 'Entrena con tu entrenador. Necesitas su código de invitación.',
  },
  {
    value: 'athlete',
    title: 'Atleta',
    price: '10 €/mes',
    icon: 'barbell-outline',
    desc: 'Entrena por tu cuenta: crea tus rutinas y sigue tu progreso y nutrición.',
  },
  {
    value: 'trainer',
    title: 'Entrenador',
    price: '15 €/mes',
    icon: 'people-outline',
    desc: 'Gestiona a tus alumnos, cobros y tu negocio. Se paga 180 €/año de una vez (cuota anual, no meses sueltos).',
  },
];

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  heroGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  formCard: {
    padding: spacing.lg,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  roleCardOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconOn: { borderColor: colors.hairline, backgroundColor: colors.surface },
  roleCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleCardTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  roleCardTitleOn: { color: colors.primaryBright },
  rolePrice: { ...typography.small, color: colors.primary, fontFamily: fonts.heading },
  rolePriceFree: { color: colors.success },
  roleCardDesc: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
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
    fontFamily: fonts.semiBold,
  },
});
