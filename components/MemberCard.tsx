import React, { useCallback, useState } from 'react';
import { t, frase  } from '../lib/idioma';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { ProgressCard, type DatoTarjeta } from './ProgressCard';
import { useAuth } from '../lib/auth-context';
import {
  tarjetaDeAtleta,
  tarjetaDeEntrenador,
  textoDesde,
} from '../lib/cardStats';
import { datosDelCarne } from '../lib/carne';
import { showToast } from './Toast';
import { getCourseProgress } from '../lib/firestore/courseProgress';
import { getActiveRoutineForClient } from '../lib/firestore/routines';
import { comunidadAbierta, getSocialLeaderboard } from '../lib/firestore/social';
import { getClientsForTrainer } from '../lib/firestore/users';
import { getWorkoutLogsForClient, getWorkoutLogsForTrainer } from '../lib/firestore/workoutLogs';
import { currentStreak } from '../lib/stats';
import { colors, fonts, spacing, typography } from '../lib/theme';

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

  const esEntrenador = profile?.role === 'trainer';
  // Quién es dentro de la app. Se calcula igual aquí y en la imagen que se
  // comparte: son la misma tarjeta, y decir "Alumno" dentro y "Formación"
  // fuera sería tener dos.
  const [soloCursos, setSoloCursos] = useState(false);
  const carne = datosDelCarne(profile, { conCursos: soloCursos, conPlan: !soloCursos });
  const rol = carne?.titulo
    ? carne.titulo.charAt(0) + carne.titulo.slice(1).toLowerCase()
    : 'Miembro';

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let vivo = true;

      (async () => {
        // Primero, lo que ya se sabe sin pedir nada.
        setDatos(
          esEntrenador
            ? tarjetaDeEntrenador({ createdAt: profile.createdAt, alumnos: 0, entrenosDirigidos: 0 })
            : tarjetaDeAtleta({ createdAt: profile.createdAt, entrenos: 0, racha: 0 })
        );

        try {
          if (esEntrenador) {
            const [clientes, logs] = await Promise.all([
              getClientsForTrainer(profile.uid),
              getWorkoutLogsForTrainer(profile.uid),
            ]);
            if (!vivo) return;
            setDatos(
              tarjetaDeEntrenador({
                createdAt: profile.createdAt,
                alumnos: clientes.length,
                entrenosDirigidos: logs.length,
              })
            );
            return;
          }

          const [logs, rutina, vistas] = await Promise.all([
            getWorkoutLogsForClient(profile.uid),
            getActiveRoutineForClient(profile.uid).catch(() => null),
            getCourseProgress(profile.uid).catch(() => ({}) as Record<string, unknown>),
          ]);
          if (!vivo) return;
          /*
           * Cuenta de FORMACIÓN: la que está aquí por los cursos y no por
           * entrenar. Se reconoce por lo que hace —ve lecciones y no tiene
           * plan— y no por una casilla, que habría que mantener a mano y
           * quedaría mal puesta el día que esa persona empiece a entrenar.
           *
           * Quien compró la formación y todavía no ha abierto ninguna lección
           * sale como alumno hasta que la abra. Es preferible a lo contrario:
           * llamar "Formación" a alguien por lo que aún no ha hecho.
           */
          setSoloCursos(!rutina && logs.length === 0 && Object.keys(vistas).length > 0);

          // El puesto solo tiene sentido dentro de un grupo. El atleta que se
          // autoentrena es su propio entrenador: ahí no hay clasificación.
          let puesto: number | undefined;
          let deCuantos: number | undefined;
          // Ni si su entrenador no enseña la comunidad: un puesto de una
          // clasificación que no puede ver no le dice nada.
          if (
            profile.trainerId &&
            profile.trainerId !== profile.uid &&
            (await comunidadAbierta(profile.trainerId))
          ) {
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
              Date.now()
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

  return (
    <View style={styles.bloque}>
      <ProgressCard
        datos={datos}
        nombre={profile.name}
        rol={rol}
        desde={textoDesde(profile.createdAt)}
      />
      {/* Se dice el gesto entero: en el móvil, arrastrar sin más lo entiende
          la pantalla como desplazarse, y el que gira la tarjeta es apoyar el
          dedo un momento antes de moverlo. */}
      <Text style={styles.ayuda}>Mantén el dedo encima y gírala</Text>

    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: spacing.lg },
  ayuda: {
    ...typography.small,
    color: colors.textFaint,
    fontSize: 11,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
