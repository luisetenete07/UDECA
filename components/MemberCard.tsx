import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { ProgressCard, type DatoTarjeta } from './ProgressCard';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { shareMemberImage } from '../lib/brandCards';
import {
  numeroFundador,
  tarjetaDeAtleta,
  tarjetaDeEntrenador,
  textoDesde,
} from '../lib/cardStats';
import { getSocialLeaderboard } from '../lib/firestore/social';
import { getClientsForTrainer } from '../lib/firestore/users';
import { getWorkoutLogsForClient, getWorkoutLogsForTrainer } from '../lib/firestore/workoutLogs';
import { currentStreak } from '../lib/stats';
import { colors, spacing, typography } from '../lib/theme';

/**
 * La tarjeta, en el perfil y sin puerta delante.
 *
 * Antes vivía detrás de un botón, en su propia pantalla. Era más limpio de
 * montar y peor de usar: una cosa que se enseña tiene que estar ya puesta
 * cuando abres el perfil, no esperando a que alguien la busque. Nadie pulsa un
 * botón para ver su propio carné.
 *
 * Las cifras se cargan detrás y sin bloquear: la tarjeta se pinta al instante
 * con lo que el perfil ya sabe —el nombre, el número, la fecha de alta— y se
 * completa cuando llegan los entrenos. Que tarde una cifra no puede hacer que
 * tarde el perfil entero.
 */
export function MemberCard() {
  const { profile } = useAuth();
  const [datos, setDatos] = useState<DatoTarjeta[]>([]);
  const [compartiendo, setCompartiendo] = useState(false);

  const esEntrenador = profile?.role === 'trainer';
  const esFundador = typeof profile?.founderNumber === 'number' && profile.founderNumber > 0;
  const rol = esEntrenador ? 'Entrenador' : profile?.role === 'athlete' ? 'Atleta' : 'Alumno';

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let vivo = true;
      // El número ya va impreso abajo en la tarjeta: fuera de la rotación.
      const sinFundador = { conFundador: false };

      (async () => {
        // Primero, lo que ya se sabe sin pedir nada.
        setDatos(
          esEntrenador
            ? tarjetaDeEntrenador(
                { createdAt: profile.createdAt, alumnos: 0, entrenosDirigidos: 0 },
                Date.now(),
                sinFundador
              )
            : tarjetaDeAtleta(
                { createdAt: profile.createdAt, entrenos: 0, racha: 0 },
                Date.now(),
                sinFundador
              )
        );

        try {
          if (esEntrenador) {
            const [clientes, logs] = await Promise.all([
              getClientsForTrainer(profile.uid),
              getWorkoutLogsForTrainer(profile.uid),
            ]);
            if (!vivo) return;
            setDatos(
              tarjetaDeEntrenador(
                {
                  createdAt: profile.createdAt,
                  alumnos: clientes.length,
                  entrenosDirigidos: logs.length,
                },
                Date.now(),
                sinFundador
              )
            );
            return;
          }

          const logs = await getWorkoutLogsForClient(profile.uid);
          if (!vivo) return;

          // El puesto solo tiene sentido dentro de un grupo. El atleta que se
          // autoentrena es su propio entrenador: ahí no hay clasificación.
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
            tarjetaDeAtleta(
              {
                createdAt: profile.createdAt,
                entrenos: logs.length,
                racha: currentStreak(logs),
                puesto,
                deCuantos,
              },
              Date.now(),
              sinFundador
            )
          );
        } catch {
          // Sin cifras se queda lo del perfil. La tarjeta sigue siendo suya.
        }
      })();

      return () => {
        vivo = false;
      };
    }, [profile, esEntrenador])
  );

  if (!profile) return null;

  const compartir = async () => {
    setCompartiendo(true);
    try {
      const r = await shareMemberImage({
        name: profile.name,
        roleLabel: rol,
        founderNumber: esFundador ? profile.founderNumber : undefined,
        since: textoDesde(profile.createdAt)?.toLowerCase(),
        tagline: esEntrenador
          ? 'Dirige, mide y cobra'
          : profile.role === 'athlete'
            ? 'Entrena por su cuenta'
            : 'Entrena con su entrenador',
      });
      if (r === 'downloaded') showToast('Tarjeta descargada');
    } catch {
      showToast('No se pudo crear la tarjeta');
    } finally {
      setCompartiendo(false);
    }
  };

  return (
    <View style={styles.bloque}>
      <ProgressCard
        datos={datos}
        nombre={profile.name}
        rol={rol}
        desde={textoDesde(profile.createdAt)}
        fundador={esFundador ? numeroFundador(profile.founderNumber!) : undefined}
      />
      <View style={styles.pie}>
        <Text style={styles.ayuda}>Arrástrala para girarla</Text>
        <PressableScale
          onPress={compartir}
          disabled={compartiendo}
          style={styles.compartir}
          hitSlop={8}
        >
          <Ionicons
            name="share-outline"
            size={15}
            color={compartiendo ? colors.textFaint : colors.primary}
          />
          <Text style={styles.compartirTexto}>Compartir</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: spacing.lg },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  ayuda: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  compartir: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  compartirTexto: { ...typography.small, color: colors.primary, fontSize: 12 },
});
