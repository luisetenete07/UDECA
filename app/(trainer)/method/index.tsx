import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { METHOD_CATEGORIES, METHODOLOGY, type MethodSection } from '../../../lib/methodology';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Metodología': 'construct-outline',
  'Fundamentos': 'bulb-outline',
  'Planche': 'body-outline',
  'Next Level Planche': 'flame-outline',
  'Front Lever': 'barbell-outline',
  'Élite': 'trophy-outline',
};

export default function MethodIndex() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  // Búsqueda: filtra por título, categoría o subtítulo de sección.
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (s: MethodSection) =>
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.subtitle.toLowerCase().includes(q);
    return METHOD_CATEGORIES.map((cat) => ({
      cat,
      items: METHODOLOGY.filter((s) => s.category === cat && match(s)),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  return (
    <ScreenContainer>
      <Text style={styles.title}>Metodología UDECA</Text>
      <Text style={styles.subtitle}>
        Tu método completo, siempre a mano. Solo para ti como entrenador.
      </Text>

      <TextField
        placeholder="Buscar (planche, front lever, estructura...)"
        value={search}
        onChangeText={setSearch}
        style={{ marginBottom: spacing.md }}
      />

      {grouped.length === 0 ? (
        <Text style={styles.empty}>Sin resultados para “{search}”.</Text>
      ) : (
        grouped.map((g) => (
          <View key={g.cat} style={styles.group}>
            <View style={styles.groupHead}>
              <Ionicons
                name={CATEGORY_ICON[g.cat] ?? 'library-outline'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.groupTitle}>{g.cat}</Text>
            </View>
            {g.items.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/(trainer)/method/${s.id}`)}
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{s.title}</Text>
                  {s.subtitle ? (
                    <Text style={styles.rowSub} numberOfLines={2}>
                      {s.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
        ))
      )}
      <View style={{ height: spacing.xl }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  empty: { ...typography.body, color: colors.textMuted, marginTop: spacing.lg },
  group: { marginBottom: spacing.lg },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  groupTitle: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  rowTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  rowSub: { ...typography.small, color: colors.textFaint, marginTop: 2 },
});
