import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Card } from './Card';
import { frase, t } from '../lib/idioma';
import { pendientesHechos, pendientesPorHacer } from '../lib/pendientes';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { CoachTask } from '../lib/types';

/**
 * LA LISTA DE PENDIENTES DEL ENTRENADOR (lib/pendientes.ts).
 *
 * Lo que tiene que hacer sin fecha: se apunta en una línea, se tacha con un
 * toque, la bandera lo sube arriba y, si acaba teniendo día, el calendario se
 * lo pone. Lo tachado se queda unos días debajo, plegado, por si fue sin
 * querer.
 *
 * Sale en el inicio (con los primeros a la vista) y en el calendario.
 */
export function PendientesDelCoach({
  tasks,
  onAdd,
  onToggle,
  onFlag,
  onEdit,
  onPonerDia,
  max,
  enTarjeta = true,
}: {
  tasks: CoachTask[];
  onAdd: (titulo: string) => void;
  onToggle: (t: CoachTask) => void;
  onFlag: (t: CoachTask) => void;
  onEdit: (t: CoachTask) => void;
  /** Ponerle día: pasa al calendario. */
  onPonerDia?: (t: CoachTask) => void;
  /** Cuántos se ven antes de "Ver todos". Sin poner, todos. */
  max?: number;
  /** En el inicio va en su tarjeta; en el calendario, como una sección más. */
  enTarjeta?: boolean;
}) {
  const [nuevo, setNuevo] = useState('');
  const [todos, setTodos] = useState(false);
  const [verHechos, setVerHechos] = useState(false);
  const porHacer = pendientesPorHacer(tasks);
  const hechos = pendientesHechos(tasks);
  const visibles = max && !todos ? porHacer.slice(0, max) : porHacer;
  const ocultos = porHacer.length - visibles.length;

  const apuntar = () => {
    const titulo = nuevo.trim();
    if (!titulo) return;
    onAdd(titulo);
    setNuevo('');
  };

  const fila = (task: CoachTask) => (
    <View key={task.id} style={styles.fila}>
      <Pressable
        onPress={() => onToggle(task)}
        hitSlop={8}
        style={[styles.check, task.done && styles.checkHecho]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.title}
      >
        {task.done ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
      </Pressable>
      <Pressable style={styles.cuerpo} onPress={() => onEdit(task)}>
        <Text style={[styles.titulo, task.done && styles.tituloHecho]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.notes ? (
          <Text style={styles.notas} numberOfLines={1}>
            {task.notes}
          </Text>
        ) : null}
      </Pressable>
      {!task.done && onPonerDia ? (
        <Pressable
          onPress={() => onPonerDia(task)}
          hitSlop={8}
          style={styles.boton}
          accessibilityRole="button"
          accessibilityLabel={t('Ponerle día')}
        >
          <Ionicons name="calendar-outline" size={17} color={colors.textFaint} />
        </Pressable>
      ) : null}
      {!task.done ? (
        <Pressable
          onPress={() => onFlag(task)}
          hitSlop={8}
          style={styles.boton}
          accessibilityRole="button"
          accessibilityLabel={task.flagged ? t('Quitar prioridad') : t('Destacar')}
        >
          <Ionicons
            name={task.flagged ? 'flag' : 'flag-outline'}
            size={17}
            color={task.flagged ? colors.primary : colors.textFaint}
          />
        </Pressable>
      ) : null}
    </View>
  );

  const contenido = (
    <>
      <View style={styles.cabecera}>
        <Ionicons name="list-outline" size={17} color={colors.primary} />
        <Text style={styles.cabeceraTitulo}>Pendientes</Text>
        {porHacer.length > 0 ? <Text style={styles.cuenta}>{String(porHacer.length)}</Text> : null}
      </View>

      <View style={styles.apuntar}>
        <Ionicons name="add" size={20} color={colors.primary} />
        <TextInput
          style={styles.apuntarCampo}
          placeholder={t('Apuntar un pendiente')}
          placeholderTextColor={colors.textFaint}
          value={nuevo}
          onChangeText={setNuevo}
          onSubmitEditing={apuntar}
          returnKeyType="done"
          blurOnSubmit={false}
          accessibilityLabel={t('Apuntar un pendiente')}
        />
        {nuevo.trim() ? (
          <Pressable onPress={apuntar} style={styles.anadir} hitSlop={6}>
            <Text style={styles.anadirTexto}>Añadir</Text>
          </Pressable>
        ) : null}
      </View>

      {porHacer.length === 0 ? (
        <Text style={styles.vacio}>
          Lo que tengas que hacer sin fecha: llamar a alguien, grabar un vídeo, preparar un plan. Sin día, sin que se pierda.
        </Text>
      ) : (
        visibles.map(fila)
      )}

      {ocultos > 0 ? (
        <Pressable onPress={() => setTodos(true)} style={styles.mas} hitSlop={6}>
          <Text style={styles.masTexto}>{ocultos === 1 ? t('Ver 1 más') : frase`Ver ${ocultos} más`}</Text>
        </Pressable>
      ) : null}

      {hechos.length > 0 ? (
        <>
          <Pressable onPress={() => setVerHechos((v) => !v)} style={styles.mas} hitSlop={6}>
            <Text style={styles.hechosTexto}>
              {hechos.length === 1 ? t('1 hecho estos días') : frase`${hechos.length} hechos estos días`}
            </Text>
            <Ionicons name={verHechos ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textFaint} />
          </Pressable>
          {verHechos ? hechos.map(fila) : null}
        </>
      ) : null}
    </>
  );

  return enTarjeta ? <Card style={styles.tarjeta}>{contenido}</Card> : <View style={styles.seccion}>{contenido}</View>;
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  seccion: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cabeceraTitulo: { ...typography.h3, color: colors.text, flex: 1 },
  cuenta: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 1,
    overflow: 'hidden',
  },
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
    marginBottom: spacing.sm,
    minHeight: 50,
  },
  apuntarCampo: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fonts.body, paddingVertical: spacing.sm },
  anadir: { backgroundColor: colors.primaryMuted, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  anadirTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  vacio: { ...typography.small, color: colors.textFaint, lineHeight: 19, paddingVertical: spacing.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkHecho: { backgroundColor: colors.primary, borderColor: colors.primary },
  cuerpo: { flex: 1, paddingVertical: 2 },
  titulo: { ...typography.body, color: colors.text },
  tituloHecho: { color: colors.textFaint, textDecorationLine: 'line-through' },
  notas: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  boton: { padding: 4 },
  mas: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: spacing.sm },
  masTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  hechosTexto: { ...typography.small, color: colors.textFaint },
});
