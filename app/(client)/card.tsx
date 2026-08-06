import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ProgressCard, type DatoTarjeta } from '../../components/ProgressCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { shareMemberImage } from '../../lib/brandCards';
import { tarjetaDeAtleta, textoDesde } from '../../lib/cardStats';
import { getSocialLeaderboard } from '../../lib/firestore/social';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { currentStreak } from '../../lib/stats';
import { colors, spacing, typography } from '../../lib/theme';

/**
 * La tarjeta del atleta y del alumno.
 *
 * Misma pantalla para los dos, y a propósito: lo que cambia entre uno y otro
 * es quién le pone el plan, no lo que ha hecho. Los entrenos, la racha y el
 * puesto se ganan igual.
 */
export default function ClientCardScreen() {
  const { profile } = useAuth();
  const [datos, setDatos] = useState<DatoTarjeta[] | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let vivo = true;
      (async () => {
        setDatos(
          tarjetaDeAtleta({
            founderNumber: profile.founderNumber,
            createdAt: profile.createdAt,
            entrenos: 0,
            racha: 0,
          })
        );
        try {
          // Sin segundo argumento: el alumno lee LO SUYO. Pasar su propio uid
          // como entrenador filtraba por un vínculo que no existe y devolvía
          // cero entrenos — y al atleta le funcionaba de casualidad, porque él
          // sí es su propio entrenador.
          const logs = await getWorkoutLogsForClient(profile.uid);
          if (!vivo) return;

          // El puesto solo tiene sentido dentro de un grupo. El atleta que se
          // autoentrena es su propio entrenador, así que su "grupo" es él
          // mismo: ahí no hay clasificación que enseñar, y `tarjetaDeAtleta`
          // ya la descarta por tamaño.
          let puesto: number | undefined;
          let deCuantos: number | undefined;
          if (profile.trainerId && profile.trainerId !== profile.uid) {
            const tabla = await getSocialLeaderboard(profile.trainerId).catch(() => []);
            if (!vivo) return;
            const n = tabla.findIndex((x) => x.uid === profile.uid);
            if (n >= 0) {
              puesto = n + 1;
              deCuantos = tabla.length;
            }
          }

          setDatos(
            tarjetaDeAtleta({
              founderNumber: profile.founderNumber,
              createdAt: profile.createdAt,
              entrenos: logs.length,
              racha: currentStreak(logs),
              puesto,
              deCuantos,
            })
          );
        } catch {
          // Sin cifras se queda lo del perfil; la tarjeta sigue siendo suya.
        }
      })();
      return () => {
        vivo = false;
      };
    }, [profile])
  );

  if (!profile) return null;
  const esFundador = typeof profile.founderNumber === 'number' && profile.founderNumber > 0;
  const rol = profile.role === 'athlete' ? 'Atleta' : 'Alumno';

  const compartir = async () => {
    setCompartiendo(true);
    try {
      const r = await shareMemberImage({
        name: profile.name,
        roleLabel: rol,
        founderNumber: esFundador ? profile.founderNumber : undefined,
        since: textoDesde(profile.createdAt)?.toLowerCase(),
        tagline:
          profile.role === 'athlete' ? 'Entrena por su cuenta' : 'Entrena con su entrenador',
      });
      if (r === 'downloaded') showToast('Tarjeta descargada');
    } catch {
      showToast('No se pudo crear la tarjeta');
    } finally {
      setCompartiendo(false);
    }
  };

  return (
    <ScreenContainer maxWidth={520}>
      <Stack.Screen options={{ title: '' }} />
      <Text style={styles.titulo}>Tu tarjeta</Text>
      <View style={styles.hueco}>
        <ProgressCard
          datos={datos ?? []}
          nombre={profile.name}
          rol={rol}
          desde={textoDesde(profile.createdAt)?.toLowerCase()}
          verificado={esFundador}
        />
      </View>
      <Button title="Compartir" onPress={compartir} loading={compartiendo} />
      <Text style={styles.pie}>Arrastra la tarjeta para girarla.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  titulo: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  hueco: { marginBottom: spacing.xl },
  pie: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
