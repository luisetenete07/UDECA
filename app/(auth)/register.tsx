import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { emailFieldProps, TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { track, trackOnce } from '../../lib/analytics';
import { friendlyAuthError } from '../../lib/firebase-errors';
import {
  ANNUAL_PRICE_EUR,
  CAN_SELL_IN_APP,
  COACH_MONTHLY_EQUIV_EUR,
  FREE_CLIENT_LIMIT,
  TRIAL_DAYS,
} from '../../lib/subscription';
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
  // Encadenan el foco al pulsar "siguiente" en el teclado.
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const inviteRef = useRef<TextInput>(null);

  // Cuántos llegan a ver la pantalla de alta (denominador del embudo).
  useEffect(() => {
    void trackOnce('register_view');
  }, []);

  const handleSubmit = async () => {
    setError(null);
    void track('register_submit');
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
      void track('register_ok');
      void track(
        role === 'trainer'
          ? 'register_ok_trainer'
          : role === 'athlete'
            ? 'register_ok_athlete'
            : 'register_ok_client'
      );
    } catch (e) {
      // El fallo importa tanto como el éxito: si `register_fail` sube, algo
      // se ha roto en el alta (fue lo que pasó con las reglas de Firestore).
      void track('register_fail');
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content} maxWidth={560}>
      <View style={styles.header}>
        <LinearGradient
          colors={gradients.goldHaloSoft}
          style={styles.heroGlow}
          pointerEvents="none"
        />
        <Logo compact />
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Elige cómo quieres usar la app</Text>
      </View>

      <Card accent style={styles.formCard}>
        {/* Tres tarjetas en columna, como un selector de plan: se comparan de
            un vistazo en vez de leerse una debajo de otra. El detalle del rol
            elegido va DEBAJO, no dentro: metido en la tarjeta obligaría a
            hacerlas altas y estrechas, que es donde se rompen en pantallas
            pequeñas. */}
        <View style={styles.roleRow}>
          {ROLE_CARDS.map((rc) => {
            const on = role === rc.value;
            return (
              <Pressable
                key={rc.value}
                onPress={() => setRole(rc.value)}
                style={[styles.roleCard, on && styles.roleCardOn]}
              >
                {on ? (
                  <View style={styles.roleCheck}>
                    <Ionicons name="checkmark" size={11} color={colors.onPrimary} />
                  </View>
                ) : null}
                <View style={[styles.roleIcon, on && styles.roleIconOn]}>
                  <Ionicons
                    name={rc.icon}
                    size={20}
                    color={on ? colors.primary : colors.textMuted}
                  />
                </View>
                <Text style={[styles.roleCardTitle, on && styles.roleCardTitleOn]} numberOfLines={1}>
                  {rc.title}
                </Text>
                <Text style={[styles.rolePrice, rc.free && styles.rolePriceFree]} numberOfLines={1}>
                  {rc.price}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.roleDetail}>
          <Text style={styles.roleDetailText}>
            {ROLE_CARDS.find((rc) => rc.value === role)?.desc}
          </Text>
        </View>

        <TextField
          label="Nombre"
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label="Correo electrónico"
          {...emailFieldProps}
          value={email}
          onChangeText={setEmail}
          placeholder="tucorreo@ejemplo.com"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label="Contraseña"
          secureTextEntry
          autoComplete="password-new"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 6 caracteres"
          returnKeyType={role === 'client' ? 'next' : 'go'}
          onSubmitEditing={() =>
            role === 'client' ? inviteRef.current?.focus() : handleSubmit()
          }
        />

        {role === 'client' ? (
          <TextField
            ref={inviteRef}
            label="Código de tu entrenador"
            autoCapitalize="characters"
            autoCorrect={false}
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Ej. 7XQK2M"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
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
    desc: 'Entrenas con tu entrenador, que te manda el plan. Necesitas su código para entrar; no pagas nada.',
  },
  {
    value: 'athlete',
    title: 'Atleta',
    // En la tarjeta va lo corto; el precio completo, en el detalle de abajo.
    price: CAN_SELL_IN_APP ? `${TRIAL_DAYS} días` : 'Prueba',
    icon: 'barbell-outline',
    // En iOS no se nombran precios de la plataforma (ver CAN_SELL_IN_APP).
    desc: CAN_SELL_IN_APP
      ? `Entrenas por tu cuenta: tus rutinas, tu progreso y tu nutrición. ${TRIAL_DAYS} días con todo abierto y después 10 €/mes.`
      : 'Entrenas por tu cuenta: tus rutinas, tu progreso y tu nutrición.',
  },
  {
    value: 'trainer',
    title: 'Entrenador',
    // El alta es un euro para todos: filtra al curioso y deja una tarjeta
    // identificada, que es lo que impide multiplicar cuentas de entrenador.
    price: CAN_SELL_IN_APP ? '1 € de alta' : 'Pro',
    icon: 'people-outline',
    desc: CAN_SELL_IN_APP
      ? `Tus alumnos, tus cobros y tu negocio. El alta incluye ${FREE_CLIENT_LIMIT} alumnos para siempre; del ${FREE_CLIENT_LIMIT + 1} en adelante, ${COACH_MONTHLY_EQUIV_EUR} €/mes (${ANNUAL_PRICE_EUR} € facturados anualmente).`
      : `Tus alumnos, tus cobros y tu negocio. El plan de entrada incluye ${FREE_CLIENT_LIMIT} alumnos.`,
  },
];

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  heroGlow: {
    position: 'absolute',
    // Ver welcome.tsx: banda, no óvalo. Se desborda a los lados de la columna
    // de contenido para que su borde quede fuera de pantalla en cualquier
    // ancho realista; abajo se apaga a transparente y no deja costura.
    top: -spacing.lg,
    left: -600,
    right: -600,
    height: 380,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  // El saludo es el título de la pantalla, no un rótulo de sección.
  title: {
    ...typography.h1,
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
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  roleCardOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  roleCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 17,
    height: 17,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconOn: { borderColor: colors.hairline },
  roleCardTitle: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  roleCardTitleOn: { color: colors.primaryBright },
  rolePrice: { ...typography.small, color: colors.primary, fontSize: 11 },
  rolePriceFree: { color: colors.success },
  roleDetail: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  roleDetailText: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
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
    fontFamily: fonts.semiBold,
  },
});
