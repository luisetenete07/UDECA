import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { Logo } from './Logo';
import { ScreenContainer } from './ScreenContainer';
import { colors, radius, shadows, spacing, typography } from '../lib/theme';

/**
 * La pantalla que dice "todavía no puedes entrar", y solo hay una.
 *
 * En UDECA hay cinco puertas —verificar el correo, vincularse con un
 * entrenador, pagar el alta, renovar la suscripción y desbloquear una cuota
 * atrasada— y cada una se había escrito por su cuenta. El resultado era que
 * las cinco decían lo mismo con cinco caras distintas: el círculo del icono
 * medía 68, 64 o 52 px; el título era h1 o h2; la salida era un botón fantasma
 * en unas y un enlace subrayado en otras; y dos de ellas no hacían scroll, así
 * que en un móvil pequeño el botón de pagar podía quedarse fuera de la
 * pantalla.
 *
 * Que se parezcan no es cuestión de gusto. Estas cinco pantallas aparecen sin
 * avisar y siempre son malas noticias; si además cada una parece de una app
 * distinta, la sensación no es "me falta un paso", es "algo va mal". Un mismo
 * marco convierte cinco sustos en un trámite reconocible.
 *
 * Lo que cambia de una a otra —el icono, el texto, los botones— entra por
 * props. Lo que no cambia vive aquí: el logo, el marco, el ancho, el scroll y
 * la salida siempre en el mismo sitio.
 */
export function GateScreen({
  icono,
  titulo,
  texto,
  children,
  nota,
  salida = 'Cerrar sesión',
  onSalir,
}: {
  /** El icono del círculo. Es lo primero que se mira: que diga de qué va. */
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  /** Una o dos frases. Qué pasa y qué hay que hacer. */
  texto?: React.ReactNode;
  /** Lo propio de esta puerta: campos, precio, botones. */
  children: React.ReactNode;
  /** Letra pequeña bajo la tarjeta. */
  nota?: React.ReactNode;
  /** Texto de la salida ("Usar otra cuenta" cuando la cuenta es el problema). */
  salida?: string;
  onSalir: () => void;
}) {
  return (
    <ScreenContainer contentStyle={styles.contenido} maxWidth={560}>
      <View style={styles.cabecera}>
        <Logo compact />
      </View>

      <Card accent style={styles.tarjeta}>
        <View style={styles.icono}>
          <Ionicons name={icono} size={30} color={colors.primary} />
        </View>
        <Text style={styles.titulo}>{titulo}</Text>
        {typeof texto === 'string' ? <Text style={styles.texto}>{texto}</Text> : texto}
        {children}
      </Card>

      {nota ? <Text style={styles.nota}>{nota}</Text> : null}

      <Pressable onPress={onSalir} style={styles.salida} hitSlop={8}>
        <Text style={styles.salidaTexto}>{salida}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

/**
 * El párrafo de estas pantallas, para el contenido que va dentro de `children`
 * y quiere el mismo aire que el de arriba.
 */
export function GateText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.texto}>{children}</Text>;
}

const styles = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'center' },
  cabecera: { alignItems: 'center', marginBottom: spacing.lg },
  tarjeta: { padding: spacing.lg, alignItems: 'center' },
  icono: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.glowGold,
  },
  titulo: { ...typography.h2, color: colors.text, textAlign: 'center' },
  texto: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 21,
  },
  nota: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    lineHeight: 17,
  },
  salida: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.sm },
  salidaTexto: { ...typography.small, color: colors.textFaint, textDecorationLine: 'underline' },
});
