import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Button } from './Button';
import { Card } from './Card';
import { Sheet } from './Sheet';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { updateUserProfile } from '../lib/firestore/users';
import { t } from '../lib/idioma';
import {
  MAX_OBJETIVO,
  objetivosDe,
  objetivosParaGuardar,
  PLAZOS,
  type Objetivos,
  type PlazoDeObjetivo,
} from '../lib/objetivos';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * El color de cada grado de realismo, como un semáforo: verde lo seguro, ámbar
 * lo difícil, rojo lo casi imposible. Con el beige de la marca, el sueño
 * parecía un objetivo desactivado.
 */
const TONO: Record<PlazoDeObjetivo['realismo'], string> = {
  3: colors.success,
  2: colors.warning,
  1: colors.danger,
};

/**
 * LOS OBJETIVOS DEL ALUMNO, EN SU INICIO.
 *
 * Corto, medio y largo plazo, cada uno con su icono y con lo realista que
 * tiene que ser (lib/objetivos.ts): realismo máximo, difícil pero alcanzable
 * en seis meses, y casi imposible. Estaban escondidos en el perfil, dentro de
 * "Sobre mí", y un objetivo que no se ve no se persigue.
 *
 * Se ven al abrir la app y se cambian desde aquí mismo: un toque en cualquiera
 * abre los tres para ponerlos al día. Luis los ve en la ficha del alumno.
 */
export function ObjetivosDelAlumno() {
  const { profile, refreshProfile } = useAuth();
  const actuales = objetivosDe(profile);
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Objetivos>(actuales);
  const [guardando, setGuardando] = useState(false);

  if (!profile) return null;

  const abrir = () => {
    setBorrador(objetivosDe(profile));
    setAbierto(true);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await updateUserProfile(profile.uid, objetivosParaGuardar(borrador));
      await refreshProfile();
      setAbierto(false);
      showToast('Objetivos guardados');
    } catch {
      showToast('No se pudieron guardar. Inténtalo otra vez.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Tus objetivos</Text>
        <Pressable
          onPress={abrir}
          hitSlop={8}
          style={styles.editar}
          accessibilityRole="button"
          accessibilityLabel={t('Actualizar mis objetivos')}
        >
          <Ionicons name="create-outline" size={15} color={colors.primary} />
          <Text style={styles.editarTexto}>Actualizar</Text>
        </Pressable>
      </View>

      {PLAZOS.map((p, i) => {
        const texto = actuales[p.clave];
        return (
          <Pressable
            key={p.clave}
            onPress={abrir}
            style={[styles.fila, i > 0 && styles.filaSeparada]}
            accessibilityRole="button"
            accessibilityLabel={`${t(p.etiqueta)}: ${texto || t('Sin escribir')}`}
          >
            <View style={[styles.icono, { backgroundColor: `${TONO[p.realismo]}1F`, borderColor: `${TONO[p.realismo]}55` }]}>
              <Ionicons name={p.icono} size={18} color={TONO[p.realismo]} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.plazoFila}>
                <Text style={styles.plazo}>{p.etiqueta}</Text>
                <Realismo plazo={p} />
              </View>
              {texto ? (
                <Text style={styles.texto}>{texto}</Text>
              ) : (
                <Text style={styles.vacio}>{p.pista}</Text>
              )}
            </View>
          </Pressable>
        );
      })}

      <Sheet
        visible={abierto}
        onClose={() => setAbierto(false)}
        titulo="Tus objetivos"
        descripcion="Uno por plazo, en una línea. Cámbialos cuando quieras: según avanzas, los de ahora se quedan cortos."
      >
        {PLAZOS.map((p) => (
          <View key={p.clave} style={styles.campo}>
            <View style={styles.plazoFila}>
              <Ionicons name={p.icono} size={15} color={TONO[p.realismo]} />
              <Text style={styles.campoPlazo}>{p.etiqueta}</Text>
              <Realismo plazo={p} />
            </View>
            <Text style={styles.campoPista}>{p.pista}</Text>
            <TextField
              value={borrador[p.clave]}
              onChangeText={(v) => setBorrador((b) => ({ ...b, [p.clave]: v.slice(0, MAX_OBJETIVO) }))}
              placeholder={p.ejemplo}
              maxLength={MAX_OBJETIVO}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
        ))}
        <Button title="Guardar objetivos" onPress={guardar} loading={guardando} style={{ marginTop: spacing.sm }} />
      </Sheet>
    </Card>
  );
}

/**
 * Lo realista que es un plazo: tres barras como las de la cobertura, más
 * llenas cuanto más seguro, y su nombre al lado.
 */
function Realismo({ plazo }: { plazo: PlazoDeObjetivo }) {
  const tono = TONO[plazo.realismo];
  return (
    <View style={styles.realismo} accessible accessibilityLabel={t(plazo.comoDeRealista)}>
      <View style={styles.barras}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[
              styles.barra,
              { height: 4 + n * 3, backgroundColor: n <= plazo.realismo ? tono : colors.borderStrong },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.realismoTexto, { color: tono }]} numberOfLines={1}>
        {plazo.comoDeRealista}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  titulo: { ...typography.h3, color: colors.text },
  editar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editarTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2, paddingVertical: spacing.sm + 2 },
  filaSeparada: { borderTopWidth: 1, borderTopColor: colors.border },
  icono: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  plazoFila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  plazo: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  texto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, marginTop: 3 },
  vacio: { ...typography.small, color: colors.textFaint, marginTop: 3 },
  realismo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 13 },
  barra: { width: 4, borderRadius: 1 },
  realismoTexto: { fontSize: 11, lineHeight: 14, fontFamily: fonts.semiBold },
  campo: { marginBottom: spacing.md, gap: 4 },
  campoPlazo: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  campoPista: { ...typography.small, color: colors.textMuted, marginBottom: 2 },
});
