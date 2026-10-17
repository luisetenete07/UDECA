import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Chip, ChipRow } from './Chip';
import { CollapsibleCard } from './CollapsibleCard';
import { showToast } from './Toast';
import { diaLargo, horaCorta } from '../lib/fechas';
import { frase } from '../lib/idioma';
import { getAjustesLlamadas, getLlamadasDelAlumno, setPlanDelAlumno } from '../lib/firestore/llamadas';
import { delMes, loQueTiene, proximas, type AjustesLlamadas, type Llamada } from '../lib/llamadas';
import { colors, fonts, spacing, tabularNums, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

/**
 * El plan del alumno y sus llamadas, en su ficha.
 *
 * Los planes se crean en Llamadas 1:1 (por orden de prioridad); aquí solo se
 * elige cuál tiene este alumno, que es lo que se hace al darle de alta o al
 * cambiarle de tarifa. Si el plan incluye lo VIP, el alumno pasa a VIP.
 */
export function PlanDelAlumno({
  trainerId,
  alumno,
  onCambia,
}: {
  trainerId: string;
  alumno: UserProfile;
  onCambia: (cambio: Pick<UserProfile, 'planId' | 'vip'>) => void;
}) {
  const router = useRouter();
  const [ajustes, setAjustes] = useState<AjustesLlamadas | null>(null);
  const [suyas, setSuyas] = useState<Llamada[]>([]);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      Promise.all([getAjustesLlamadas(trainerId), getLlamadasDelAlumno(alumno.uid, trainerId)])
        .then(([a, l]) => {
          if (!vivo) return;
          setAjustes(a);
          setSuyas(l);
        })
        .catch(() => {});
      return () => {
        vivo = false;
      };
    }, [trainerId, alumno.uid])
  );

  if (!ajustes) return null;
  const suyo = loQueTiene(ajustes, alumno.planId);
  const usadas = delMes(suyas, Date.now());
  const siguiente = proximas(suyas)[0];

  const elegir = async (planId: string | null) => {
    if (planId === (alumno.planId ?? null)) return;
    const plan = planId ? ajustes.planes.find((p) => p.id === planId) : undefined;
    // Sin plan no le quita el VIP: eso se decide a mano en sus ajustes.
    const cambio = { planId: planId ?? undefined, vip: plan ? plan.vip : alumno.vip };
    const antes = { planId: alumno.planId, vip: alumno.vip };
    onCambia(cambio);
    try {
      await setPlanDelAlumno(alumno.uid, planId, plan?.vip);
    } catch {
      onCambia(antes);
      showToast('No se pudo guardar');
    }
  };

  return (
    <CollapsibleCard
      id="alumno-plan"
      icon="ribbon-outline"
      title="Plan y llamadas"
      hint={`${suyo.plan?.nombre ?? 'Sin plan'}${suyo.llamadasAlMes > 0 ? frase` · ${usadas}/${suyo.llamadasAlMes} llamadas` : ''}`}
      defaultOpen={false}
    >
      {ajustes.planes.length === 0 ? (
        <Text style={styles.muted}>
          Aún no tienes planes. Crea los tuyos (con cuántas llamadas incluye cada uno) y elige aquí el de cada
          alumno.
        </Text>
      ) : (
        <ChipRow>
          {ajustes.planes.map((p, i) => (
            <Chip
              key={p.id}
              texto={p.nombre || frase`Plan ${i + 1}`}
              icono={p.vip ? 'star' : undefined}
              activo={alumno.planId === p.id}
              onPress={() => elegir(p.id)}
            />
          ))}
          <Chip texto="Sin plan" activo={!suyo.plan} onPress={() => elegir(null)} />
        </ChipRow>
      )}

      <View style={styles.datos}>
        <Dato
          valor={suyo.llamadasAlMes > 0 ? `${usadas}/${suyo.llamadasAlMes}` : '—'}
          texto="llamadas este mes"
        />
        <Dato valor={frase`${suyo.antelacionDias} d`} texto="reserva con antelación" />
      </View>

      {siguiente ? (
        <View style={styles.siguiente}>
          <Ionicons name="call" size={14} color={colors.success} />
          <Text style={styles.siguienteTexto}>
            {frase`Próxima: ${diaLargo(siguiente.inicio)} · ${horaCorta(siguiente.inicio)}`}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={() => router.push('/(trainer)/llamadas')} hitSlop={8} style={styles.enlace}>
        <Text style={styles.enlaceTexto}>
          {ajustes.planes.length === 0 ? 'Crear planes' : 'Editar planes y horarios'}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
    </CollapsibleCard>
  );
}

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoValor}>{valor}</Text>
      <Text style={styles.datoTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.small, color: colors.textMuted },
  datos: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  dato: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  datoValor: { ...typography.body, color: colors.text, fontFamily: fonts.heading, ...tabularNums },
  datoTexto: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  siguiente: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  siguienteTexto: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.md, alignSelf: 'flex-start' },
  enlaceTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
