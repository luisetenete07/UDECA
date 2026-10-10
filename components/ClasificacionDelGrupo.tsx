import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Avatar } from './Avatar';
import { CollapsibleCard } from './CollapsibleCard';
import { Dialogo } from './Dialogo';
import { showToast } from './Toast';
import { frase } from '../lib/idioma';
import { deleteSocialStats, subscribeSocialLeaderboard } from '../lib/firestore/social';
import { isOnline } from '../lib/presence';
import { colors, fonts, spacing, typography } from '../lib/theme';
import type { SocialStats } from '../lib/types';

/**
 * La clasificación del grupo: quién entrena más, quién está en línea.
 *
 * Vivía en el perfil del entrenador, entre el código de invitación y la
 * suscripción, que es el último sitio donde se busca algo sobre los alumnos.
 * Ahora va al final de Clientes, que es donde se mira al grupo.
 *
 * En vivo: rachas, entrenos y presencia se refrescan solos, y un alumno recién
 * incorporado aparece al instante. Solo escucha mientras la pantalla está
 * delante: los alumnos refrescan su presencia cada pocos minutos y no queremos
 * recibir esos latidos en segundo plano.
 */
export function ClasificacionDelGrupo({ trainerId }: { trainerId: string }) {
  const [leaderboard, setLeaderboard] = useState<SocialStats[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SocialStats | null>(null);

  useFocusEffect(
    useCallback(() => subscribeSocialLeaderboard(trainerId, setLeaderboard), [trainerId])
  );

  const confirmDeleteEntry = async () => {
    if (!deleteTarget) return;
    const uid = deleteTarget.uid;
    setLeaderboard((prev) => prev.filter((s) => s.uid !== uid));
    setDeleteTarget(null);
    try {
      await deleteSocialStats(uid);
      showToast('Perfil eliminado de la clasificación');
    } catch {
      // La suscripción en vivo devuelve la fila a su sitio por sí sola.
      showToast('No se pudo eliminar');
    }
  };
  const onlineCount = leaderboard.filter((s) => isOnline(s.lastSeen)).length;

  return (
    <>
      <CollapsibleCard
        id="coach-clasificacion"
        icon="trophy-outline"
        title="Clasificación"
        hint={
          onlineCount > 0
            ? `${onlineCount} en línea`
            : leaderboard.length > 0
              ? `${leaderboard.length} ${leaderboard.length === 1 ? 'alumno' : 'alumnos'}`
              : undefined
        }
        defaultOpen={false}
      >
        {leaderboard.length === 0 ? (
          <Text style={styles.mutedSmall}>
            Aparecerá cuando tus alumnos empiecen a entrenar con la app.
          </Text>
        ) : (
          leaderboard.slice(0, 10).map((s, i) => (
            <View key={s.uid} style={styles.rankRow}>
              <Text style={styles.rankPos}>{i + 1}</Text>
              <Avatar name={s.name} photoURL={s.photoURL} size={34} />
              <View style={{ flex: 1 }}>
                <View style={styles.rankNameRow}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  {isOnline(s.lastSeen) ? <View style={styles.onlineDot} /> : null}
                </View>
                <Text style={styles.rankMeta}>
                  {s.sessionsThisWeek} esta semana · {s.totalWorkouts} totales
                  {s.currentStreak > 1 ? ` · racha ${s.currentStreak}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setDeleteTarget(s)} hitSlop={8} style={styles.rankDelete}>
                <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
              </Pressable>
            </View>
          ))
        )}
        {leaderboard.length > 0 ? (
          <Text style={styles.rankHint}>
            Mantén la lista limpia: elimina perfiles antiguos o de prueba con la papelera.
          </Text>
        ) : null}
      </CollapsibleCard>

      <Dialogo
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        icono="trash-outline"
        titulo="¿Quitar de la clasificación?"
        texto={frase`Se eliminará a ${deleteTarget?.name ?? ''} de la tabla. Sus entrenos e historial no se tocan. Si sigue usando la app y entrena, volverá a aparecer.`}
        accion="Eliminar"
        onAccion={confirmDeleteEntry}
      />
    </>
  );
}

const styles = StyleSheet.create({
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  mutedSmall: { ...typography.small, color: colors.textFaint },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rankPos: { ...typography.h3, color: colors.primaryBright, width: 24, textAlign: 'center' },
  rankNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flexShrink: 1 },
  rankMeta: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  rankDelete: { padding: 6 },
  rankHint: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm, lineHeight: 17 },
});
