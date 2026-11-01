import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/Texto';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ListSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../lib/auth-context';
import { diaMes, diasEntre, horaCorta } from '../../lib/fechas';
import { frase, t } from '../../lib/idioma';
import { unido } from '../../lib/texto';
import { getAvisosDelAlumno } from '../../lib/firestore/avisos';
import { updateUserProfile } from '../../lib/firestore/users';
import {
  ETIQUETA_DEL_PLAN,
  nombreDelDiaDelAviso,
  resumenDelDia,
  textoDelCambio,
  type AvisoDelPlan,
  type DiaDelAviso,
} from '../../lib/avisosDelPlan';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';

/**
 * LAS NOTIFICACIONES DEL ALUMNO (lib/avisosDelPlan.ts).
 *
 * Por ahora, lo que su entrenador cambia de su plan: cada vez que lo guarda con
 * algo distinto, un aviso con los DÍAS tocados —todos, si son varios—. Cada día
 * sale con lo que cambió a la vista ("Dominadas · 3 × 8 → 4 × 8") y, al
 * tocarlo, el día entero como quedó, con lo nuevo marcado.
 *
 * Al entrar se da todo por visto: el punto de la campana del inicio se va.
 */

/** "Hoy · 10:32", "Ayer · 18:05", "12 oct · 09:10". */
function cuandoFue(ts: number): string {
  const hace = diasEntre(ts, Date.now());
  const dia = hace <= 0 ? t('Hoy') : hace === 1 ? t('Ayer') : diaMes(ts);
  return unido(dia, horaCorta(ts));
}

const ESTADO: Record<DiaDelAviso['estado'], { texto: string; color: string; fondo: string }> = {
  nuevo: { texto: 'Nuevo', color: colors.success, fondo: colors.successMuted },
  cambiado: { texto: 'Cambiado', color: colors.primaryBright, fondo: colors.primaryMuted },
  quitado: { texto: 'Quitado', color: colors.danger, fondo: colors.dangerMuted },
};

export default function NotificacionesScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const [avisos, setAvisos] = useState<AvisoDelPlan[] | null>(null);
  // Lo visto ANTES de entrar: lo de después sale marcado como nuevo esta vez.
  const [vistosAntes, setVistosAntes] = useState<number | undefined>(undefined);
  // Días abiertos, por aviso y día ("aviso|día").
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  const uid = profile?.uid;
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let vivo = true;
      const antes = profile?.avisosVistos;
      getAvisosDelAlumno(uid)
        .then((lista) => {
          if (!vivo) return;
          setVistosAntes(antes);
          setAvisos(lista);
          /*
           * Visto hasta AHORA, o hasta el último aviso si llegó "del futuro":
           * la hora del aviso es la del servidor y la de ahora la del móvil, y
           * con el móvil atrasado el aviso recién leído volvería a salir nuevo.
           */
          const hasta = Math.max(Date.now(), lista[0]?.cuando ?? 0);
          if (lista.length > 0 && (antes ?? 0) < (lista[0]?.cuando ?? 0)) {
            updateUserProfile(uid, { avisosVistos: hasta })
              .then(() => refreshProfile())
              .catch(() => {});
          }
        })
        .catch(() => vivo && setAvisos([]));
      return () => {
        vivo = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid])
  );

  const volver = (
    <Pressable
      onPress={() => router.push('/(client)/dashboard')}
      style={styles.atras}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('Volver')}
    >
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );

  if (!avisos) {
    return (
      <ScreenContainer>
        <ListSkeleton rows={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth={620}>
      {volver}
      <Text style={styles.titulo}>Notificaciones</Text>
      <Text style={styles.subtitulo}>Lo que tu entrenador cambia de tu plan, con el día exacto.</Text>

      {avisos.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Sin notificaciones"
          subtitle="Cuando tu entrenador cambie algo de tu plan, lo verás aquí con el día que ha cambiado."
        />
      ) : null}

      {avisos.map((a, n) => {
        const sinVer = a.cuando > (vistosAntes ?? 0);
        // Pocos días: abiertos de entrada. Muchos, o un plan nuevo: cerrados,
        // cada uno con su resumen, y se abre el que se quiera ver.
        const abiertosDeEntrada = !a.nuevo && a.dias.length <= 2 && n === 0;
        return (
          <Card key={a.id} accent={sinVer} style={styles.aviso}>
            <View style={styles.cabecera}>
              <View style={[styles.icono, sinVer && styles.iconoNuevo]}>
                <Ionicons
                  name={a.nuevo ? 'sparkles-outline' : 'create-outline'}
                  size={17}
                  color={sinVer ? colors.primaryBright : colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.avisoTitulo}>
                  {a.nuevo
                    ? t('Tu entrenador te ha preparado un plan nuevo')
                    : a.dias.length === 0
                      ? t('Tu entrenador ha cambiado los ajustes de tu plan')
                      : a.dias.length === 1
                        ? t('Tu entrenador ha cambiado 1 día de tu plan')
                        : frase`Tu entrenador ha cambiado ${a.dias.length} días de tu plan`}
                </Text>
                <Text style={styles.avisoMeta}>{unido(a.plan, cuandoFue(a.cuando))}</Text>
              </View>
              {sinVer ? <View style={styles.punto} accessibilityLabel={t('Nueva')} /> : null}
            </View>

            {a.ajustes && a.ajustes.length > 0 ? (
              <Text style={styles.ajustes}>
                {frase`También: ${a.ajustes.map((k) => t(ETIQUETA_DEL_PLAN[k] ?? k)).join(', ')}`}
              </Text>
            ) : null}

            {a.dias.map((d) => {
              const clave = `${a.id}|${d.dayId}`;
              const abierto = abiertos[clave] ?? abiertosDeEntrada;
              const estado = ESTADO[d.estado];
              const cambiados = d.ejercicios.filter((e) => e.estado);
              const puedeAbrir = d.estado !== 'quitado' && d.ejercicios.length > 0;
              return (
                <View key={clave} style={styles.dia}>
                  <Pressable
                    onPress={() => puedeAbrir && setAbiertos((p) => ({ ...p, [clave]: !abierto }))}
                    style={styles.diaCab}
                    accessibilityRole={puedeAbrir ? 'button' : undefined}
                    accessibilityState={puedeAbrir ? { expanded: abierto } : undefined}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.diaNombreFila}>
                        <Text style={styles.diaNombre}>{nombreDelDiaDelAviso(d)}</Text>
                        {!a.nuevo ? (
                          <View style={[styles.etiqueta, { backgroundColor: estado.fondo }]}>
                            <Text style={[styles.etiquetaTexto, { color: estado.color }]}>{t(estado.texto)}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.diaResumen}>
                        {a.nuevo
                          ? d.ejercicios.length === 1
                            ? t('1 ejercicio')
                            : frase`${d.ejercicios.length} ejercicios`
                          : resumenDelDia(d)}
                      </Text>
                    </View>
                    {puedeAbrir ? (
                      <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                    ) : null}
                  </Pressable>

                  {/* Cerrado, lo que cambió y nada más: es lo que se viene a ver. */}
                  {!abierto && d.estado === 'cambiado'
                    ? cambiados.map((e, i) => (
                        <Text key={i} style={styles.cambioCorto} numberOfLines={2}>
                          <Text style={styles.cambioCortoNombre}>{e.nombre}</Text>
                          {` · ${textoDelCambio(e)}`}
                        </Text>
                      ))
                    : null}

                  {/* Abierto, el día entero como quedó, con lo nuevo marcado. */}
                  {abierto
                    ? d.ejercicios.map((e, i) => {
                        const marcado = !!e.estado && !a.nuevo && d.estado === 'cambiado';
                        return (
                          <View key={i} style={[styles.ejercicio, marcado && styles.ejercicioMarcado]}>
                            {e.superserie ? (
                              <Ionicons name="link" size={12} color={colors.primaryBright} style={styles.enlace} />
                            ) : null}
                            <View style={{ flex: 1 }}>
                              <View style={styles.ejercicioFila}>
                                <Text style={styles.ejercicioNombre} numberOfLines={2}>
                                  {e.nombre}
                                </Text>
                                <Text style={styles.ejercicioCuanto}>{e.cuanto}</Text>
                              </View>
                              {marcado ? <Text style={styles.ejercicioCambio}>{textoDelCambio(e)}</Text> : null}
                            </View>
                          </View>
                        );
                      })
                    : null}

                  {d.quitados && d.quitados.length > 0 && (abierto || d.estado === 'cambiado') ? (
                    <Text style={styles.quitados}>
                      {frase`Quitado: ${d.quitados.join(', ')}`}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </Card>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  atras: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  titulo: { ...typography.h1, color: colors.text },
  subtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md, lineHeight: 18 },
  aviso: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  icono: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  iconoNuevo: { backgroundColor: colors.primaryMuted },
  avisoTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  avisoMeta: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  punto: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  ajustes: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },
  dia: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  diaCab: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  diaNombreFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  diaNombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flexShrink: 1 },
  diaResumen: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  etiqueta: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  etiquetaTexto: { ...typography.small, fontSize: 12, lineHeight: 16, fontFamily: fonts.semiBold },
  cambioCorto: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs + 2, lineHeight: 18 },
  cambioCortoNombre: { color: colors.text, fontFamily: fonts.semiBold },
  ejercicio: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  ejercicioMarcado: { backgroundColor: colors.primaryMuted, borderLeftColor: colors.primary },
  enlace: { marginRight: 4, marginTop: 4 },
  ejercicioFila: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  ejercicioNombre: { ...typography.body, color: colors.text, flex: 1 },
  ejercicioCuanto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  ejercicioCambio: { ...typography.small, color: colors.primaryBright, marginTop: 2 },
  quitados: {
    ...typography.small,
    color: colors.danger,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
