import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Card } from './Card';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { ProgressRing } from './ProgressRing';
import { Sheet } from './Sheet';
import { TextField } from './TextField';
import { frase, t } from '../lib/idioma';
import { habitos, hechoHoy, racha, resumenDeHoy, ultimaSemana } from '../lib/habitosCoach';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { CoachTask } from '../lib/types';

const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/**
 * LOS HÁBITOS DEL ENTRENADOR, EN SU PANEL (lib/habitosCoach.ts).
 *
 * Un toque en el círculo y hecho; mañana sale sin marcar. Arriba, cuántos
 * lleva hoy en un anillo; en cada hábito, su racha y la semana en siete
 * puntos, que es lo que hace que apetezca no romperla.
 *
 * Tocando el nombre se cambia o se borra.
 */
export function HabitosDelCoach({
  tasks,
  onAdd,
  onToggle,
  onRename,
  onDelete,
}: {
  tasks: CoachTask[];
  onAdd: (titulo: string) => void;
  onToggle: (h: CoachTask) => void;
  onRename: (h: CoachTask, titulo: string) => void;
  onDelete: (h: CoachTask) => void;
}) {
  const lista = habitos(tasks);
  const { hechos, total } = resumenDeHoy(lista);
  const [nuevo, setNuevo] = useState('');
  const [editando, setEditando] = useState<CoachTask | null>(null);
  const [nombre, setNombre] = useState('');

  const apuntar = () => {
    const titulo = nuevo.trim();
    if (!titulo) return;
    onAdd(titulo);
    setNuevo('');
  };

  return (
    <Card style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <View style={{ flex: 1 }}>
          <View style={styles.tituloFila}>
            <Ionicons name="repeat" size={17} color={colors.primary} />
            <Text style={styles.titulo}>Hábitos</Text>
          </View>
          <Text style={styles.subtitulo}>
            {total === 0
              ? t('Lo que quieres hacer cada día. Se desmarcan solos al día siguiente.')
              : hechos === total
                ? t('Todos hechos hoy. Mañana, otra vez.')
                : frase`${hechos} de ${total} hoy`}
          </Text>
        </View>
        {total > 0 ? (
          <ProgressRing progress={hechos / total} size={54} thickness={6} value={`${hechos}/${total}`} celebrate />
        ) : null}
      </View>

      {lista.map((h) => {
        const hecho = hechoHoy(h);
        const seguidos = racha(h.dias);
        return (
          <View key={h.id} style={[styles.fila, hecho && styles.filaHecha]}>
            <PressableScale
              haptic
              onPress={() => onToggle(h)}
              style={[styles.check, hecho && styles.checkHecho]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hecho }}
              accessibilityLabel={h.title}
            >
              {hecho ? <Ionicons name="checkmark" size={20} color={colors.onPrimary} /> : null}
            </PressableScale>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                setEditando(h);
                setNombre(h.title);
              }}
              accessibilityRole="button"
              accessibilityHint={t('Cambiar o borrar el hábito')}
            >
              <Text style={[styles.nombre, hecho && styles.nombreHecho]} numberOfLines={1}>
                {h.title}
              </Text>
              <View style={styles.semana}>
                {ultimaSemana(h.dias).map((d, i) => (
                  <View key={d.dia} style={styles.diaCol}>
                    <View style={[styles.punto, d.hecho && styles.puntoHecho, i === 6 && styles.puntoHoy]} />
                    <Text style={[styles.letra, i === 6 && styles.letraHoy]}>{LETRAS[new Date(d.dia).getDay()]}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
            {seguidos > 0 ? (
              <View style={styles.racha} accessibilityLabel={seguidos === 1 ? t('Racha de 1 día') : frase`Racha de ${seguidos} días`}>
                <Ionicons name="flame" size={14} color={hecho ? colors.warning : colors.textMuted} />
                <Text style={[styles.rachaNumero, hecho && styles.rachaViva]}>{String(seguidos)}</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.apuntar}>
        <Ionicons name="add" size={20} color={colors.primary} />
        <TextInput
          style={styles.apuntarCampo}
          placeholder={t('Nuevo hábito (ej. leer 20 min)')}
          placeholderTextColor={colors.textFaint}
          value={nuevo}
          onChangeText={setNuevo}
          onSubmitEditing={apuntar}
          returnKeyType="done"
          blurOnSubmit={false}
          accessibilityLabel={t('Nuevo hábito')}
        />
        {nuevo.trim() ? (
          <Pressable onPress={apuntar} style={styles.anadir} hitSlop={6}>
            <Text style={styles.anadirTexto}>Añadir</Text>
          </Pressable>
        ) : null}
      </View>

      {editando ? (
        <Sheet onClose={() => setEditando(null)} titulo="Hábito">
          <TextField label="Nombre" value={nombre} onChangeText={setNombre} autoFocus />
          <Button
            title="Guardar"
            onPress={() => {
              if (nombre.trim()) onRename(editando, nombre.trim());
              setEditando(null);
            }}
          />
          <Pressable
            onPress={() => {
              onDelete(editando);
              setEditando(null);
            }}
            style={styles.borrar}
            hitSlop={6}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.borrarTexto}>Borrar el hábito</Text>
          </Pressable>
        </Sheet>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titulo: { ...typography.h3, color: colors.text },
  subtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filaHecha: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  check: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkHecho: { backgroundColor: colors.primary, borderColor: colors.primary },
  nombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  nombreHecho: { color: colors.text },
  semana: { flexDirection: 'row', gap: 6, marginTop: 5 },
  diaCol: { alignItems: 'center', gap: 2 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  puntoHecho: { backgroundColor: colors.primary },
  puntoHoy: { borderWidth: 1, borderColor: colors.primaryBright },
  letra: { fontSize: 8, lineHeight: 10, color: colors.textFaint, fontFamily: fonts.semiBold },
  letraHoy: { color: colors.primaryBright },
  racha: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rachaNumero: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  rachaViva: { color: colors.warning },
  apuntar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.md,
    minHeight: 50,
  },
  apuntarCampo: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fonts.body, paddingVertical: spacing.sm },
  anadir: { backgroundColor: colors.primaryMuted, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  anadirTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  borrar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  borrarTexto: { ...typography.small, color: colors.danger, fontFamily: fonts.semiBold },
});
