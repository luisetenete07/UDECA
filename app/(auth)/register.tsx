import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BotonGoogle, Separador } from '../../components/BotonGoogle';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { emailFieldProps, TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { useGoogleSignIn } from '../../lib/googleAuth';
import { track, trackOnce } from '../../lib/analytics';
import { friendlyAuthError } from '../../lib/firebase-errors';
import {
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
  const google = useGoogleSignIn();

  /**
   * Entrar con Google. Si la cuenta ya tenía perfil, el enrutado la lleva a su
   * sitio sola; si no, cae en la pantalla que pregunta el rol (ver
   * app/(auth)/completar.tsx). Aquí no hay que decidir nada de eso.
   */
  const entrarConGoogle = async () => {
    setError(null);
    try {
      await google.entrar();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se ha podido entrar con Google. Inténtalo otra vez.'
      );
    }
  };
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
                <Text style={styles.roleTag} numberOfLines={1}>
                  {rc.tag}
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

        {/* Google, debajo del correo y no encima: quien ya tiene cuenta
            aquí viene a por su contraseña, y mover el campo de siempre a
            media pantalla más abajo por una alternativa es cambiarle el
            sitio a la mayoría por la minoría. */}
        {google.disponible ? (
          <>
            <Separador />
            <BotonGoogle
              texto="Registrarme con Google"
              cargando={google.entrando}
              onPress={entrarConGoogle}
            />
          </>
        ) : null}
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

/*
 * Las tres cuentas, sin un solo precio (ver lib/subscription.ts).
 *
 * En la tarjeta va lo que ES cada una, no lo que cuesta: quien se está
 * registrando todavía está eligiendo qué tipo de usuario es, y el precio no le
 * ayuda a decidir eso. Lo que cuesta lo verá al activar la cuenta, en la web,
 * donde siempre está al día.
 */
const ROLE_CARDS: {
  value: UserRole;
  title: string;
  /** Tres palabras que dicen qué es, no cuánto vale. */
  tag: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'client',
    title: 'Alumno',
    tag: 'Con entrenador',
    icon: 'person-outline',
    desc: 'Entrenas con tu entrenador, que te manda el plan. Necesitas su código para entrar.',
  },
  {
    value: 'athlete',
    title: 'Atleta',
    tag: 'Por tu cuenta',
    icon: 'barbell-outline',
    desc: `Entrenas por tu cuenta: tus rutinas, tu progreso y tu nutrición. Empiezas con ${TRIAL_DAYS} días con todo abierto.`,
  },
  {
    value: 'trainer',
    title: 'Entrenador',
    tag: 'Para entrenar a otros',
    icon: 'people-outline',
    desc: `Tus alumnos, tus cobros y tu negocio. El plan de entrada incluye ${FREE_CLIENT_LIMIT} alumnos.`,
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
  roleTag: { ...typography.small, color: colors.textMuted, fontSize: 11, textAlign: 'center' },
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
