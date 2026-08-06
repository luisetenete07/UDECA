import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ProgressCard, type DatoTarjeta } from '../../components/ProgressCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { shareMemberImage } from '../../lib/brandCards';
import { tarjetaDeEntrenador, textoDesde } from '../../lib/cardStats';
import { getClientsForTrainer } from '../../lib/firestore/users';
import { getWorkoutLogsForTrainer } from '../../lib/firestore/workoutLogs';
import { colors, spacing, typography } from '../../lib/theme';

/**
 * La tarjeta del entrenador, en su propia pantalla.
 *
 * Vivía apretada entre el código de invitación y los ajustes, del tamaño de
 * cualquier otra tarjeta del perfil. Una cosa que se enseña necesita una
 * pantalla para ella sola: en cuanto comparte sitio con algo, deja de ser lo
 * que se mira y pasa a ser lo que se pasa de largo.
 */
export default function TrainerCardScreen() {
  const { profile } = useAuth();
  const [datos, setDatos] = useState<DatoTarjeta[] | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let vivo = true;
      (async () => {
        // Se pinta con lo que ya se sabe del perfil y se completa cuando
        // llegan las cifras: la tarjeta no puede tardar en aparecer.
        setDatos(
          tarjetaDeEntrenador({
            founderNumber: profile.founderNumber,
            createdAt: profile.createdAt,
            alumnos: 0,
            entrenosDirigidos: 0,
          })
        );
        try {
          const [clientes, logs] = await Promise.all([
            getClientsForTrainer(profile.uid),
            getWorkoutLogsForTrainer(profile.uid),
          ]);
          if (!vivo) return;
          setDatos(
            tarjetaDeEntrenador({
              founderNumber: profile.founderNumber,
              createdAt: profile.createdAt,
              alumnos: clientes.length,
              entrenosDirigidos: logs.length,
            })
          );
        } catch {
          // Sin cifras, la tarjeta se queda con lo del perfil. Sigue siendo
          // suya y sigue enseñándose.
        }
      })();
      return () => {
        vivo = false;
      };
    }, [profile])
  );

  if (!profile) return null;
  const esFundador = typeof profile.founderNumber === 'number' && profile.founderNumber > 0;

  const compartir = async () => {
    setCompartiendo(true);
    try {
      const r = await shareMemberImage({
        name: profile.name,
        roleLabel: 'Entrenador',
        founderNumber: esFundador ? profile.founderNumber : undefined,
        since: textoDesde(profile.createdAt)?.toLowerCase(),
        tagline: 'Dirige, mide y cobra',
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
          rol="Entrenador"
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
