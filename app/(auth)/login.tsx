import React, { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { sendPasswordResetEmail, type AuthCredential } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/Avatar';
import { BotonApple } from '../../components/BotonApple';
import { BotonGoogle, Separador } from '../../components/BotonGoogle';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Logo } from '../../components/Logo';
import { ScreenContainer } from '../../components/ScreenContainer';
import { emailFieldProps, TextField } from '../../components/TextField';
import { useT } from '../../lib/idioma';
import { useAppleSignIn } from '../../lib/appleAuth';
import { useGoogleSignIn } from '../../lib/googleAuth';
import {
  correoDelError,
  credencialDelError,
  enlazarConContrasena,
  esCuentaConOtroMetodo,
  mensajeDeEntrada,
} from '../../lib/enlazarCuenta';
import { track } from '../../lib/analytics';
import { auth } from '../../lib/firebase';
import {
  forgetAccount,
  getRememberedAccounts,
  type RememberedAccount,
} from '../../lib/rememberedAccounts';
import { colors, fieldLabel, fonts, gradients, radius, spacing, typography } from '../../lib/theme';

/**
 * Entrar en UDECA: con Google o con Apple, y nada más.
 *
 * El correo y la contraseña se fueron de aquí. No porque estorbaran, sino
 * porque cada uno de los dos campos es una oportunidad de no entrar: la
 * contraseña que no se recuerda, la mayúscula de más, el correo escrito con un
 * dedo en el metro. Con Google o Apple se entra en un toque y no hay nada que
 * recordar; y de paso desaparece la única contraseña que esta app guardaba.
 *
 * LO QUE NO SE PUEDE PERDER POR EL CAMINO son las cuentas que ya existían con
 * contraseña. Al pulsar Google, Firebase las rechaza en vez de enlazarlas (ver
 * `lib/enlazarCuenta`), así que ese error se recoge aquí y se convierte en una
 * pantalla que pide la contraseña UNA última vez para engancharlo todo a la
 * misma cuenta. Sin eso, esa gente se quedaría fuera con sus datos dentro.
 */
export default function LoginScreen() {
  const t = useT();
  const google = useGoogleSignIn();
  const apple = useAppleSignIn();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<RememberedAccount[]>([]);

  // El rescate: cuando Firebase dice que esa cuenta ya existe con otro método.
  const [rescate, setRescate] = useState<{ email: string; credencial: AuthCredential | null } | null>(
    null
  );
  const [password, setPassword] = useState('');
  const [enlazando, setEnlazando] = useState(false);

  useEffect(() => {
    getRememberedAccounts().then(setAccounts);
  }, []);

  const olvidar = async (acc: RememberedAccount) => {
    await forgetAccount(acc.email);
    setAccounts(await getRememberedAccounts());
  };

  /**
   * Entrar con un proveedor. Si la cuenta ya tenía perfil, el enrutado la lleva
   * a su sitio sola; si no, cae en la pantalla que pregunta el rol (ver
   * app/(auth)/completar.tsx). Aquí no hay que decidir nada de eso.
   */
  const entrarCon = async (proveedor: { entrar: () => Promise<unknown> }, cual: string) => {
    setError(null);
    setInfo(null);
    try {
      await proveedor.entrar();
      void track('login_ok');
    } catch (e) {
      if (esCuentaConOtroMetodo(e)) {
        setRescate({ email: correoDelError(e), credencial: credencialDelError(e) });
        return;
      }
      setError(mensajeDeEntrada(e) || `No se ha podido entrar con ${cual}. Inténtalo otra vez.`);
    }
  };

  const enlazar = async () => {
    if (!rescate) return;
    setError(null);
    setEnlazando(true);
    const r = await enlazarConContrasena(rescate.email, password, rescate.credencial);
    setEnlazando(false);
    if (r.ok) {
      setPassword('');
      setRescate(null);
      void track('login_ok');
      return;
    }
    setError(r.motivo ?? 'No se ha podido enlazar la cuenta.');
  };

  const recordarContrasena = async () => {
    if (!rescate) return;
    setError(null);
    try {
      await sendPasswordResetEmail(auth, rescate.email);
      setInfo('Te hemos enviado un correo para restablecerla. Revisa tu bandeja (y el spam).');
    } catch (e) {
      setError(mensajeDeEntrada(e));
    }
  };

  // ---- El rescate ocupa la pantalla entera: es un camino, no un extra ----
  if (rescate) {
    return (
      <ScreenContainer contentStyle={styles.content} maxWidth={560}>
        <View style={styles.header}>
          <Logo />
          <Text style={styles.title}>Un paso y ya está</Text>
        </View>
        <Card accent style={styles.formCard}>
          <Text style={styles.rescateTexto}>
            Tu cuenta <Text style={styles.rescateCorreo}>{rescate.email}</Text> se creó con
            contraseña. Escríbela una última vez y la dejamos unida a tu cuenta de Google: no
            perderás nada y a partir de ahora entras de un toque.
          </Text>
          <TextField
            label={t('Contraseña')}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={enlazar}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}
          <Button title="Unir mi cuenta" onPress={enlazar} loading={enlazando} />
          <Pressable onPress={recordarContrasena} hitSlop={6}>
            <Text style={styles.forgot}>{t('¿Has olvidado tu contraseña?')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setRescate(null);
              setPassword('');
              setError(null);
              setInfo(null);
            }}
            hitSlop={6}
          >
            <Text style={styles.volver}>Volver</Text>
          </Pressable>
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.content} maxWidth={560}>
      <View style={styles.header}>
        <LinearGradient
          colors={gradients.goldHaloSoft}
          style={styles.heroGlow}
          pointerEvents="none"
        />
        <Logo />
        <Text style={styles.title}>Bienvenido de nuevo</Text>
        <Text style={styles.subtitle}>Entra y sigue con tu entrenamiento</Text>
      </View>

      <Card accent style={styles.formCard}>
        {/* Las cuentas guardadas ya no son botones de entrar —ahora se entra
            por Google o Apple, que eligen ellos la cuenta—, pero siguen aquí
            como recordatorio de con cuál entraste en este móvil. */}
        {accounts.length > 0 ? (
          <>
            <Text style={styles.pickTitle}>Ya has entrado aquí con</Text>
            {accounts.map((acc) => (
              <View key={acc.email} style={styles.accRow}>
                <Avatar name={acc.name} photoURL={acc.photoURL} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.accName} numberOfLines={1}>
                    {acc.name}
                  </Text>
                  <Text style={styles.accMeta} numberOfLines={1}>
                    {acc.role === 'trainer'
                      ? 'Entrenador'
                      : acc.role === 'athlete'
                        ? 'Atleta'
                        : 'Alumno'}{' '}
                    · {acc.email}
                  </Text>
                </View>
                <Pressable onPress={() => olvidar(acc)} hitSlop={10} style={styles.accRemove}>
                  <Ionicons name="close" size={16} color={colors.textFaint} />
                </Pressable>
              </View>
            ))}
            <Separador />
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        {google.disponible ? (
          <BotonGoogle
            texto={t('Continuar con Google')}
            cargando={google.entrando}
            onPress={() => entrarCon(google, 'Google')}
          />
        ) : null}

        {apple.disponible ? (
          <View style={google.disponible ? styles.hueco : undefined}>
            <BotonApple
              texto={t('Continuar con Apple')}
              cargando={apple.entrando}
              onPress={() => entrarCon(apple, 'Apple')}
            />
          </View>
        ) : null}

        {!google.disponible && !apple.disponible ? (
          <Text style={styles.error}>
            No se puede entrar desde este dispositivo. Prueba desde el navegador en app.udeca.app.
          </Text>
        ) : null}

        <Text style={styles.legal}>
          Al entrar aceptas los términos y la política de privacidad de UDECA.
        </Text>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('¿No tienes cuenta?')}</Text>
        <Link href="/(auth)/register" asChild>
          <Text style={styles.link}> {t('Regístrate')}</Text>
        </Link>
      </View>
    </ScreenContainer>
  );
}

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
    marginBottom: spacing.xl,
  },
  pickTitle: fieldLabel,
  accRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  accMeta: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  accRemove: { padding: 6 },
  hueco: { marginTop: spacing.sm },
  title: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.lg,
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
  error: {
    ...typography.small,
    color: colors.danger,
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  info: {
    ...typography.small,
    color: colors.primary,
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  legal: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  rescateTexto: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  rescateCorreo: { color: colors.text, fontFamily: fonts.semiBold },
  forgot: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  volver: {
    ...typography.small,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontFamily: fonts.semiBold,
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
