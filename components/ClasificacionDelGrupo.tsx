import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Dialogo } from './Dialogo';
import { Sheet } from './Sheet';
import { showToast } from './Toast';
import { frase } from '../lib/idioma';
import { deleteSocialStats, subscribeSocialLeaderboard } from '../lib/firestore/social';
import { setComunidadOculta } from '../lib/firestore/users';
import { useAuth } from '../lib/auth-context';
import { isOnline } from '../lib/presence';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { SocialStats } from '../lib/types';

/** Oro, plata y bronce: los de un podio, apagados para no chillar sobre negro. */
const MEDALLA = ['#D8B65A', '#A7AEB6', '#A07C5B'];

/**
 * La clasificación del grupo, al final de Clientes.
 *
 * ERA UN DESPLEGABLE CERRADO con "Clasificación · 3 alumnos": nada que mirar
 * hasta abrirlo, y abierto, una lista gris con papeleras. Ahora el podio está a
 * la vista —los tres que más se superan este mes, con lo que lleva cada uno—, y
 * la lista entera y el borrado de perfiles viejos, en su panel ("Ver todos").
 *
 * Se ordena igual que la ve el alumno en Social (marcas superadas este mes, ver
 * `compareLeaderboard`): el coach y su grupo miran la misma tabla.
 *
 * En vivo y solo mientras la pantalla está delante: los alumnos refrescan su
 * presencia cada pocos minutos y no queremos esos latidos en segundo plano.
 */
export function ClasificacionDelGrupo({ trainerId }: { trainerId: string }) {
  const [leaderboard, setLeaderboard] = useState<SocialStats[]>([]);
  const [todos, setTodos] = useState(false);
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

  /*
   * ENSEÑAR U OCULTAR LA COMUNIDAD A SUS ALUMNOS.
   *
   * Hay grupos donde compararse motiva y otros donde no (alumnos que empiezan,
   * coaching 1:1 donde no hay "grupo"). Lo decide el entrenador. Oculta, sus
   * alumnos no tienen pestaña Social ni puesto en el carné, la próxima vez que
   * abran la app o vuelvan a ella.
   */
  const { profile, refreshProfile } = useAuth();
  const [oculta, setOculta] = useState(profile?.comunidadOculta === true);
  const cambiarVisible = async (visible: boolean) => {
    setOculta(!visible);
    try {
      await setComunidadOculta(trainerId, !visible);
      refreshProfile().catch(() => {});
      showToast(visible ? 'Tus alumnos ya ven la comunidad' : 'Comunidad oculta para tus alumnos');
    } catch {
      setOculta(visible);
      showToast('No se pudo guardar');
    }
  };

  /** Una fila: puesto, cara (con su punto si está en línea), nombre y cifra. */
  const fila = (s: SocialStats, i: number, conBorrar: boolean) => {
    const medalla = MEDALLA[i];
    const marcas = s.prsThisMonth ?? 0;
    return (
      <View key={s.uid} style={[styles.fila, i === 0 && !conBorrar && styles.filaPrimera]}>
        <View
          style={[
            styles.puesto,
            medalla ? { borderColor: medalla, backgroundColor: `${medalla}22` } : null,
          ]}
        >
          <Text style={[styles.puestoTexto, medalla ? { color: medalla } : null]}>{i + 1}</Text>
        </View>
        <View>
          <Avatar name={s.name} photoURL={s.photoURL} size={38} />
          {isOnline(s.lastSeen) ? <View style={styles.enLinea} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.nombre} numberOfLines={1}>
            {s.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {/* "Este mes" ya lo dice la cabecera: repetirlo cortaba la racha. */}
            {(s.workoutsThisMonth ?? 0) === 1 ? frase`1 entreno` : frase`${s.workoutsThisMonth ?? 0} entrenos`}
            {s.currentStreak > 1 ? frase` · racha ${s.currentStreak}` : ''}
          </Text>
        </View>
        {conBorrar ? (
          <Pressable onPress={() => setDeleteTarget(s)} hitSlop={8} style={styles.borrar}>
            <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
          </Pressable>
        ) : (
          <View style={styles.cifra}>
            <Text style={[styles.cifraNumero, i === 0 && { color: colors.primaryBright }]}>{marcas}</Text>
            <Text style={styles.cifraEtiqueta}>{marcas === 1 ? 'marca' : 'marcas'}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.cabecera}>
          <View style={styles.icono}>
            <Ionicons name="trophy" size={17} color={colors.primaryBright} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Clasificación</Text>
            <Text style={styles.sub}>Quién más se supera este mes</Text>
          </View>
          {onlineCount > 0 ? (
            <View style={styles.pastilla}>
              <View style={styles.pastillaPunto} />
              <Text style={styles.pastillaTexto}>{frase`${onlineCount} en línea`}</Text>
            </View>
          ) : null}
        </View>

        {leaderboard.length === 0 ? (
          <Text style={styles.vacio}>
            Aparecerá cuando tus alumnos empiecen a entrenar con la app.
          </Text>
        ) : (
          <>
            {leaderboard.slice(0, 3).map((s, i) => fila(s, i, false))}
            <Pressable onPress={() => setTodos(true)} style={styles.verTodos} hitSlop={6}>
              <Text style={styles.verTodosTexto}>
                {leaderboard.length > 3
                  ? frase`Ver los ${leaderboard.length}`
                  : 'Ver y gestionar la lista'}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </Pressable>
          </>
        )}

        {/* Si sus alumnos la ven o no. Aquí y no en el perfil: es donde el
            entrenador mira a su grupo, y lo que decide está justo encima. */}
        <View style={styles.visible}>
          <View style={{ flex: 1 }}>
            <Text style={styles.visibleTitulo}>Que la vean tus alumnos</Text>
            <Text style={styles.sub}>
              {oculta
                ? 'No ven la pestaña Social ni su puesto. Tú la sigues teniendo aquí.'
                : 'La ven en su pestaña Social, con su puesto.'}
            </Text>
          </View>
          <Switch
            value={!oculta}
            onValueChange={cambiarVisible}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      <Sheet
        visible={todos}
        onClose={() => setTodos(false)}
        titulo={frase`Clasificación (${leaderboard.length})`}
        descripcion="Mantén la lista limpia: quita con la papelera los perfiles antiguos o de prueba."
      >
        <ScrollView style={{ maxHeight: 480 }}>
          {leaderboard.map((s, i) => fila(s, i, true))}
        </ScrollView>
      </Sheet>

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
  card: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, marginBottom: spacing.sm },
  icono: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { ...typography.h3, color: colors.text },
  sub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.successMuted,
  },
  pastillaPunto: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  pastillaTexto: { ...typography.small, color: colors.success, fontFamily: fonts.semiBold, fontSize: 11 },
  vacio: { ...typography.small, color: colors.textFaint, lineHeight: 19 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // El primero, con un fondo apenas dorado: el podio se lee de un vistazo.
  filaPrimera: {
    backgroundColor: colors.primaryMuted,
    borderTopColor: 'transparent',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  puesto: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puestoTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.heading, fontSize: 12 },
  enLinea: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  nombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  cifra: { alignItems: 'flex-end' },
  cifraNumero: { ...typography.h3, color: colors.text, ...tabularNums },
  cifraEtiqueta: { ...typography.small, color: colors.textFaint, fontSize: 10 },
  borrar: { padding: 6 },
  verTodos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  verTodosTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  visible: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  visibleTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
});
