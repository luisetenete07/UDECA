import React, { useCallback, useEffect, useState } from 'react';
import { frase } from '../lib/idioma';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from './Button';
import { Card } from './Card';
import { showToast } from './Toast';
import { eventosDeLaAgenda, resumenDeEventos } from '../lib/calendario';
import { diaMes } from '../lib/fechas';
import { CLAVE_ENLACES, descargarIcs, sincronizarEnElMovil } from '../lib/sincronizarCalendario';
import { colors, fonts, spacing, typography } from '../lib/theme';
import type { CoachTask, TrainingCycle, UserProfile } from '../lib/types';

/**
 * Llevarse la agenda al calendario de siempre.
 *
 * Un entrenador no vive en UDECA: vive en el calendario del móvil, donde ya
 * están el dentista, la cena del sábado y las clases presenciales. Si los
 * cobros y los bloques de sus alumnos están solo aquí, o los mira dos veces o
 * no los mira. Y el día que le cae un cobro encima de un viaje no se entera
 * hasta que ya ha pasado.
 *
 * En el móvil escribe DIRECTAMENTE en el calendario del sistema —Apple
 * Calendar en un iPhone, el de Google en un Android—; en el ordenador descarga
 * un .ics, que es lo que los dos saben importar.
 *
 * Volver a pulsarlo no duplica nada: cada evento lleva su identificador y el
 * enlace con el evento del sistema se guarda en el propio dispositivo (ver
 * lib/calendario y lib/sincronizarCalendario).
 */
export function ConectarCalendario({
  perfil,
  tareas,
  alumnos,
  ciclos,
}: {
  perfil: UserProfile | null;
  tareas: CoachTask[];
  alumnos: UserProfile[];
  ciclos: TrainingCycle[];
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [ultima, setUltima] = useState<string | null>(null);

  const clave = `${CLAVE_ENLACES}-${perfil?.uid ?? ''}`;
  const claveFecha = `${clave}-fecha`;

  useEffect(() => {
    AsyncStorage.getItem(claveFecha)
      .then((v) => setUltima(v))
      .catch(() => {});
  }, [claveFecha]);

  const eventos = eventosDeLaAgenda({ tareas, alumnos, ciclos });
  const resumen = resumenDeEventos(eventos);

  const conectar = useCallback(async () => {
    if (eventos.length === 0) {
      showToast('Todavía no hay nada con fecha que llevarse');
      return;
    }
    setTrabajando(true);
    try {
      if (Platform.OS === 'web') {
        const ok = descargarIcs(eventos, perfil?.name);
        showToast(
          ok
            ? 'Agenda descargada. Ábrela con Google Calendar o Apple Calendar.'
            : 'No se pudo generar el fichero'
        );
      } else {
        const guardados = await AsyncStorage.getItem(clave).catch(() => null);
        const previos: Record<string, string> = guardados ? JSON.parse(guardados) : {};
        const { resultado, enlaces } = await sincronizarEnElMovil(eventos, previos);
        await AsyncStorage.setItem(clave, JSON.stringify(enlaces)).catch(() => {});
        if (resultado.ok) {
          showToast(
            resultado.creados > 0
              ? frase`${resultado.creados} en tu calendario${resultado.actualizados > 0 ? ` · ${resultado.actualizados} al día` : ''}`
              : 'Tu calendario ya estaba al día'
          );
        } else {
          showToast(resultado.motivo);
          setTrabajando(false);
          return;
        }
      }
      const ahora = diaMes(Date.now());
      await AsyncStorage.setItem(claveFecha, ahora).catch(() => {});
      setUltima(ahora);
    } finally {
      setTrabajando(false);
    }
  }, [eventos, perfil?.name, clave, claveFecha]);

  return (
    <Card style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <Ionicons name="calendar-outline" size={17} color={colors.primary} />
        <Text style={styles.titulo}>Tu calendario de siempre</Text>
      </View>
      <Text style={styles.texto}>
        {Platform.OS === 'web'
          ? 'Descarga tu agenda y ábrela con Google Calendar o Apple Calendar. Tus cobros, tus bloques y tus tareas, donde ya miras cada mañana.'
          : 'Lleva tus cobros, tus bloques y tus tareas al calendario del móvil. Puedes volver a pulsarlo cuando quieras: actualiza lo que hay, no lo duplica.'}
      </Text>

      <View style={styles.filaResumen}>
        <Text style={styles.resumen}>{resumen.texto}</Text>
        {ultima ? <Text style={styles.ultima}>Última vez: {ultima}</Text> : null}
      </View>

      <Button
        title={Platform.OS === 'web' ? 'Descargar mi agenda' : 'Llevar a mi calendario'}
        variant="secondary"
        onPress={conectar}
        loading={trabajando}
        disabled={eventos.length === 0}
      />
      {eventos.length === 0 ? (
        <Text style={styles.pista}>
          Cuando tengas tareas con fecha, cobros o bloques programados, aparecerán aquí.
        </Text>
      ) : null}
      {Platform.OS === 'web' ? (
        <Pressable onPress={() => showToast('Doble clic en el fichero, o Importar en tu calendario')} hitSlop={6}>
          <Text style={styles.ayuda}>¿Cómo lo abro?</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginTop: spacing.lg, marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  titulo: { ...typography.h3, color: colors.text },
  texto: { ...typography.small, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  filaResumen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resumen: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  ultima: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  pista: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm, lineHeight: 17 },
  ayuda: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
