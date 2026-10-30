import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { TextField } from './TextField';
import { PressableScale } from './PressableScale';
import { t } from '../lib/idioma';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/** Una casilla de la fila: reps, segundos, kg, el otro lado, un bloque… */
export interface CampoDeSerie {
  clave: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** "REPS", "KG", "SEG."… En la cabecera o debajo de la casilla. */
  rotulo: string;
  decimal?: boolean;
}

/**
 * UNA SERIE, LISTA PARA EL PULGAR.
 *
 * La misma fila para todo: una serie de un ejercicio suelto, un paso de una
 * superserie, por reps, por segundos, con lastre, por lados o en clúster.
 *
 *   [Serie 2            ]  [ 6 ] [ 10 ]  ( ✓ )
 *   [◷ 6 × 10           ]
 *
 *  - El ✓ a la DERECHA y grande (48): es donde cae el pulgar con el móvil en
 *    una mano, y lo que más se toca de toda la pantalla. Tocar el nombre de
 *    la serie también marca: con las manos cansadas, cuanto más grande el
 *    blanco, menos se falla.
 *  - Lo de la última vez, en ESA serie, debajo del nombre.
 *  - Cada fila en su caja y con aire entre una y otra: antes iban pegadas y se
 *    tocaba la que no era.
 *  - Con tres casillas o más (clúster, lastre y lados a la vez) no caben al
 *    lado del nombre: bajan a una segunda línea, con su rótulo debajo.
 *  - En un móvil estrecho (360 de ancho, muchos Android) las casillas y el ✓
 *    adelgazan un poco: si no, "Serie 1" se partía en dos líneas.
 *  - "Regresión", debajo del nombre: la serie se hizo en una progresión más
 *    fácil, sin decir cuál. Sale en la serie que toca (es cuando se sabe) y en
 *    las que ya la llevan; en las demás no, para no llenar de botones todas
 *    las filas. Desmarcando una hecha, vuelve a ser la que toca y se puede
 *    cambiar.
 */
export function FilaDeSerie({
  letra,
  titulo,
  detalle,
  antes,
  extra,
  pie,
  esAhora,
  hecha,
  campos,
  conRotulos = false,
  onMarcar,
  regresion = false,
  onRegresion,
}: {
  /** La letra del paso en una superserie ("A"), delante del nombre. */
  letra?: string;
  titulo: string;
  /** Una línea debajo del título (en la superserie, lo que toca de ese ejercicio). */
  detalle?: string;
  /** Lo de la última vez en esta serie, ya en texto ("6 × 10"). */
  antes?: string;
  /** Algo más debajo del título: la etiqueta del esfuerzo apuntado. */
  extra?: React.ReactNode;
  /** Debajo de todo, dentro de la caja: lo de ese ejercicio en una superserie. */
  pie?: React.ReactNode;
  esAhora: boolean;
  hecha: boolean;
  campos: CampoDeSerie[];
  /** El rótulo debajo de cada casilla (cuando no hay una cabecera común). */
  conRotulos?: boolean;
  onMarcar: () => void;
  /** Hecha en regresión (ver `LoggedSet.regresion`). */
  regresion?: boolean;
  /** Sin esto no hay botón de regresión (p. ej. donde no se apuntan marcas). */
  onRegresion?: () => void;
}) {
  const enDosLineas = campos.length > 2;
  const m = useMedidas();
  const verRegresion = !!onRegresion && (esAhora || regresion);
  const casillas = (
    <View style={[styles.campos, enDosLineas && styles.camposAncho]}>
      {campos.map((c) => (
        <View key={c.clave} style={[styles.campo, { width: m.casilla }, enDosLineas && styles.campoFlexible]}>
          <TextField
            value={c.valor}
            onChangeText={c.onChange}
            placeholder={c.placeholder}
            keyboardType={c.decimal ? 'decimal-pad' : 'numeric'}
            style={[styles.casilla, hecha && !esAhora && styles.casillaHecha]}
            containerStyle={styles.casillaCaja}
          />
          {conRotulos || enDosLineas ? <Text style={styles.rotulo}>{c.rotulo}</Text> : null}
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.fila, esAhora && styles.filaAhora]}>
      <View style={styles.linea}>
        <View style={styles.izquierda}>
          <Pressable onPress={onMarcar} hitSlop={4}>
            <Text style={[styles.titulo, hecha && !esAhora && styles.tituloHecho]} numberOfLines={2}>
              {letra ? <Text style={styles.letra}>{`${letra}  `}</Text> : null}
              {titulo}
            </Text>
            {detalle ? (
              <Text style={styles.detalle} numberOfLines={2}>
                {detalle}
              </Text>
            ) : null}
            {/* La última vez, con un reloj delante y en una línea: con la
                palabra "Antes:" no cabía al lado de dos casillas y se partía. */}
            {antes ? (
              <View style={styles.antesFila} accessible accessibilityLabel={`Antes: ${antes}`}>
                <Ionicons name="time-outline" size={12} color={colors.primary} />
                <Text style={styles.antes} numberOfLines={1}>
                  {antes}
                </Text>
              </View>
            ) : null}
          </Pressable>
          {extra || verRegresion ? (
            <View style={styles.extra}>
              {extra}
              {verRegresion ? (
                <Pressable
                  onPress={onRegresion}
                  hitSlop={6}
                  style={[styles.regresion, regresion && styles.regresionPuesta]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: regresion }}
                  accessibilityLabel={t('Regresión')}
                >
                  <Ionicons
                    name="trending-down"
                    size={12}
                    color={regresion ? colors.warning : colors.textMuted}
                  />
                  <Text style={[styles.regresionTexto, regresion && styles.regresionTextoPuesta]}>
                    Regresión
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
        {enDosLineas ? null : casillas}
        <PressableScale
          haptic
          onPress={onMarcar}
          style={[
            styles.check,
            { width: m.check, height: m.check, borderRadius: m.check / 2 },
            esAhora && styles.checkAhora,
            hecha && styles.checkHecha,
          ]}
          hitSlop={6}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hecha }}
          accessibilityLabel={titulo}
        >
          <Ionicons
            name="checkmark"
            size={24}
            color={hecha ? colors.onPrimary : esAhora ? colors.primary : colors.textFaint}
          />
        </PressableScale>
      </View>
      {enDosLineas ? casillas : null}
      {pie}
    </View>
  );
}

/**
 * Los rótulos de las casillas, una vez encima de todas las filas y alineados
 * con ellas (en un ejercicio suelto todas las filas tienen las mismas).
 */
export function CabeceraDeSeries({ rotulos }: { rotulos: string[] }) {
  const m = useMedidas();
  if (rotulos.length === 0 || rotulos.length > 2) return null;
  return (
    <View style={[styles.cabecera, { paddingRight: 1 + RELLENO + m.check + spacing.sm }]}>
      {rotulos.map((r) => (
        <Text key={r} style={[styles.rotulo, styles.rotuloCabecera, { width: m.casilla }]}>
          {r}
        </Text>
      ))}
    </View>
  );
}

const ANCHO_CASILLA = 64;
const ANCHO_CHECK = 48;
const RELLENO = spacing.sm + 2;

/** El ancho de las casillas y del ✓: un poco menos en un móvil estrecho. */
function useMedidas() {
  const { width } = useWindowDimensions();
  return width < 380 ? { casilla: 54, check: 44 } : { casilla: ANCHO_CASILLA, check: ANCHO_CHECK };
}

const styles = StyleSheet.create({
  fila: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: RELLENO,
    marginBottom: spacing.sm,
  },
  // La que toca, encendida: con el pulso alto no hay que buscar por dónde iba.
  filaAhora: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  linea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  izquierda: { flex: 1, minWidth: 0 },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  tituloHecho: { color: colors.textMuted },
  letra: { color: colors.primaryBright, fontFamily: fonts.heading },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  antesFila: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  antes: { ...typography.small, fontSize: 12, color: colors.primary, flexShrink: 1, ...tabularNums },
  extra: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  regresion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  regresionPuesta: { backgroundColor: colors.warningMuted, borderColor: colors.warning },
  regresionTexto: { ...typography.small, fontSize: 11, color: colors.textMuted, fontFamily: fonts.semiBold },
  regresionTextoPuesta: { color: colors.warning },
  campos: { flexDirection: 'row', gap: 6 },
  camposAncho: { marginTop: spacing.sm },
  campo: { alignItems: 'center' },
  campoFlexible: { flex: 1, width: undefined },
  casillaCaja: { marginBottom: 0, alignSelf: 'stretch' },
  casilla: {
    minHeight: 48,
    height: 48,
    paddingHorizontal: 4,
    paddingVertical: 0,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: fonts.heading,
    ...tabularNums,
  },
  casillaHecha: { color: colors.textMuted },
  rotulo: {
    ...typography.small,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textFaint,
    fontFamily: fonts.semiBold,
    marginTop: 4,
    textAlign: 'center',
  },
  // Justo encima de las casillas (a la derecha se deja el borde, el relleno de
  // la fila y el ✓: va en línea, con las medidas del móvil).
  cabecera: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginBottom: 6 },
  rotuloCabecera: { marginTop: 0 },
  check: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  checkAhora: { borderColor: colors.primary, borderWidth: 2 },
  checkHecha: { backgroundColor: colors.primary, borderColor: colors.primary },
});
