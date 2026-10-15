import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { frase } from '../lib/idioma';
import { getClientsForTrainer } from '../lib/firestore/users';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

/**
 * APLICAR LA RUTINA A VARIOS ALUMNOS A LA VEZ.
 *
 * Un entrenador con un grupo que hace el mismo bloque montaba la rutina una
 * vez y la copiaba alumno por alumno ("Copiar" desde la ficha de cada uno).
 * Aquí se marcan todos de una vez: a cada uno le llega SU copia —se pueden
 * retocar luego por separado— y pasa a ser su rutina activa.
 */
export function AplicarAVarios({
  visible,
  onClose,
  trainerId,
  excepto,
  onAplicar,
}: {
  visible: boolean;
  onClose: () => void;
  trainerId: string;
  /** El alumno de esta ficha: su rutina es la que se está guardando. */
  excepto?: string;
  onAplicar: (alumnos: UserProfile[]) => Promise<void>;
}) {
  const [alumnos, setAlumnos] = useState<UserProfile[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (!visible || alumnos) return;
    getClientsForTrainer(trainerId)
      .then((l) => setAlumnos(l.filter((c) => c.uid !== excepto)))
      .catch(() => setAlumnos([]));
  }, [visible, alumnos, trainerId, excepto]);

  const alternar = (uid: string) =>
    setMarcados((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  const aplicar = async () => {
    if (!alumnos) return;
    setAplicando(true);
    try {
      await onAplicar(alumnos.filter((a) => marcados.has(a.uid)));
      setMarcados(new Set());
      onClose();
    } finally {
      setAplicando(false);
    }
  };

  const todos = !!alumnos && alumnos.length > 0 && marcados.size === alumnos.length;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      titulo="Aplicar a otros alumnos"
      descripcion="Cada uno recibe su copia como rutina activa (sustituye la que tenga). Luego puedes retocarla en su ficha."
    >
      {alumnos === null ? (
        <Text style={styles.vacio}>Cargando alumnos…</Text>
      ) : alumnos.length === 0 ? (
        <Text style={styles.vacio}>No tienes más alumnos.</Text>
      ) : (
        <>
          <Pressable
            onPress={() => setMarcados(todos ? new Set() : new Set(alumnos.map((a) => a.uid)))}
            style={styles.todos}
            hitSlop={6}
          >
            <Text style={styles.todosTexto}>{todos ? 'Quitar todos' : 'Marcar todos'}</Text>
          </Pressable>
          <ScrollView style={{ maxHeight: 380 }}>
            {alumnos.map((a) => {
              const si = marcados.has(a.uid);
              return (
                <Pressable key={a.uid} onPress={() => alternar(a.uid)} style={[styles.fila, si && styles.filaSi]}>
                  <Avatar name={a.name} photoURL={a.photoURL} size={34} />
                  <Text style={styles.nombre} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Ionicons
                    name={si ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={si ? colors.primary : colors.textFaint}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
          <Button
            title={
              marcados.size === 0
                ? 'Elige a quién'
                : marcados.size === 1
                  ? 'Aplicar a 1 alumno'
                  : frase`Aplicar a ${marcados.size} alumnos`
            }
            onPress={aplicar}
            loading={aplicando}
            disabled={marcados.size === 0}
            style={{ marginTop: spacing.md }}
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  vacio: { ...typography.body, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  todos: { alignSelf: 'flex-end', paddingVertical: spacing.xs, marginBottom: spacing.xs },
  todosTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  filaSi: { backgroundColor: colors.primaryMuted },
  nombre: { ...typography.body, color: colors.text, flex: 1 },
});
