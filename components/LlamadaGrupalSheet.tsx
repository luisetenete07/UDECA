import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Button } from './Button';
import { Chip, ChipRow } from './Chip';
import { DateField } from './DateField';
import { Sheet } from './Sheet';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { diaLargo, horaCorta, inicioDelDia, masDias } from '../lib/fechas';
import { frase, t } from '../lib/idioma';
import { minutosDe, normalizarHora } from '../lib/llamadas';
import {
  DIAS_ANTES,
  DIAS_ANTES_POR_DEFECTO,
  DURACIONES_GRUPALES,
  fijadaDesde,
  MAX_NOTA,
  MAX_TITULO,
  problemaDeGrupal,
  TEXTO_DEL_PROBLEMA,
  type BorradorDeGrupal,
  type LlamadaGrupal,
} from '../lib/llamadaGrupal';
import { colors, fieldLabel, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/** El instante de ese día a esa hora ("19:30"), en la hora de quien la programa. */
function aLas(dia: number, hora: string): number {
  const min = minutosDe(normalizarHora(hora) ?? '');
  if (min === null) return NaN;
  const d = new Date(inicioDelDia(dia));
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d.getTime();
}

const textoDeDiasAntes = (n: number) =>
  n === 0 ? t('El mismo día') : n === 1 ? t('1 día antes') : frase`${n} días antes`;

/**
 * PROGRAMAR (O CAMBIAR) UNA LLAMADA GRUPAL (lib/llamadaGrupal.ts).
 *
 * Qué es, cuándo, cuánto dura, por dónde, y desde cuándo la ven fijada sus
 * alumnos. Abajo, en una frase, lo que va a pasar al guardarla: a cuántos
 * alumnos y desde qué día. Así nadie programa a ciegas un aviso a todo el
 * grupo.
 */
export function LlamadaGrupalSheet({
  inicial,
  alumnos,
  guardando,
  onGuardar,
  onClose,
}: {
  /** La que se cambia; sin ella, una nueva. */
  inicial?: LlamadaGrupal | null;
  /** Cuántos alumnos tiene (a cuántos les va a llegar). */
  alumnos: number;
  guardando: boolean;
  onGuardar: (b: BorradorDeGrupal) => void;
  onClose: () => void;
}) {
  const hoy = inicioDelDia(Date.now());
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [dia, setDia] = useState(inicial ? inicioDelDia(inicial.inicio) : masDias(hoy, 7));
  const [hora, setHora] = useState(inicial ? horaCorta(inicial.inicio) : '19:00');
  const [duracionMin, setDuracion] = useState(inicial?.duracionMin ?? 60);
  const [enlace, setEnlace] = useState(inicial?.enlace ?? '');
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const [diasAntes, setDiasAntes] = useState(inicial?.diasAntes ?? DIAS_ANTES_POR_DEFECTO);

  const inicio = aLas(dia, hora);
  const borrador: BorradorDeGrupal = { titulo, nota, enlace, inicio, duracionMin, diasAntes };
  const problema = problemaDeGrupal(borrador);
  const desde = Number.isFinite(inicio) ? fijadaDesde(borrador) : NaN;
  const yaFijada = Number.isFinite(desde) && desde <= Date.now();
  // Si el número de días no está entre los botones (una guardada con otro), se enseña también.
  const opciones = (DIAS_ANTES as readonly number[]).includes(diasAntes) ? DIAS_ANTES : [...DIAS_ANTES, diasAntes].sort((a, b) => a - b);

  const guardar = () => {
    if (problema) {
      showToast(TEXTO_DEL_PROBLEMA[problema]);
      return;
    }
    onGuardar(borrador);
  };

  return (
    <Sheet
      onClose={onClose}
      titulo={inicial ? 'Cambiar la llamada grupal' : 'Nueva llamada grupal'}
      descripcion="Con todos tus alumnos a la vez. La llamada va por tu enlace (Meet, Zoom…)."
    >
      <TextField
        label="Título"
        value={titulo}
        onChangeText={(v) => setTitulo(v.slice(0, MAX_TITULO))}
        placeholder={t('Ej. Preguntas y respuestas de noviembre')}
        accessibilityLabel={t('Título')}
      />

      <Text style={styles.etiqueta}>Día</Text>
      <DateField value={dia} onChange={setDia} showToday={false} />

      <Text style={styles.etiqueta}>Hora</Text>
      <View style={styles.horaFila}>
        <TextInput
          value={hora}
          onChangeText={setHora}
          onBlur={() => setHora((h) => normalizarHora(h) ?? h)}
          placeholder="19:00"
          placeholderTextColor={colors.textFaint}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={styles.hora}
          accessibilityLabel={t('Hora')}
        />
        <Text style={styles.horaAyuda}>{Number.isFinite(inicio) ? diaLargo(inicio) : t('Escribe la hora, ej. 19:30')}</Text>
      </View>

      <Text style={styles.etiqueta}>Duración</Text>
      <ChipRow>
        {DURACIONES_GRUPALES.map((m) => (
          <Chip key={m} texto={`${m} min`} compacto activo={duracionMin === m} onPress={() => setDuracion(m)} />
        ))}
      </ChipRow>

      <TextField
        label="Enlace de la llamada"
        value={enlace}
        onChangeText={setEnlace}
        placeholder="https://meet.google.com/…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        containerStyle={{ marginTop: spacing.md }}
        accessibilityLabel={t('Enlace de la llamada')}
      />

      <TextField
        label="De qué va (opcional)"
        value={nota}
        onChangeText={(v) => setNota(v.slice(0, MAX_NOTA))}
        placeholder={t('Qué vais a ver o qué traer preparado')}
        multiline
        style={styles.nota}
        accessibilityLabel={t('De qué va')}
      />

      <Text style={styles.etiqueta}>Tus alumnos la ven fijada desde</Text>
      <ChipRow>
        {opciones.map((n) => (
          <Chip key={n} texto={textoDeDiasAntes(n)} compacto activo={diasAntes === n} onPress={() => setDiasAntes(n)} />
        ))}
      </ChipRow>

      {/* Lo que va a pasar al guardarla, dicho antes de pulsar. */}
      <View style={styles.resumen}>
        <Ionicons name="people-outline" size={16} color={colors.primaryBright} />
        <Text style={styles.resumenTexto}>
          {problema === 'pasada' || !Number.isFinite(desde)
            ? t('Elige un día y una hora que aún no hayan pasado.')
            : yaFijada
              ? alumnos === 1
                ? t('Tu alumno la verá fijada en su inicio desde ya, y le llega el aviso al momento.')
                : frase`Tus ${alumnos} alumnos la verán fijada en su inicio desde ya, y les llega el aviso al momento.`
              : alumnos === 1
                ? frase`Tu alumno la verá fijada en su inicio desde el ${diaLargo(desde)}, y ese día le llega el aviso.`
                : frase`Tus ${alumnos} alumnos la verán fijada en su inicio desde el ${diaLargo(desde)}, y ese día les llega el aviso.`}
        </Text>
      </View>

      <Button
        title={inicial ? 'Guardar cambios' : 'Programar llamada'}
        onPress={guardar}
        loading={guardando}
        style={{ marginTop: spacing.md }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Como el rótulo de los campos de texto, para que el formulario no cambie de letra a mitad.
  etiqueta: { ...fieldLabel, marginTop: spacing.sm },
  horaFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hora: {
    width: 84,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: fonts.semiBold,
    ...tabularNums,
  },
  horaAyuda: { ...typography.small, color: colors.textMuted, flex: 1 },
  nota: { minHeight: 76, textAlignVertical: 'top' },
  resumen: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  resumenTexto: { ...typography.small, color: colors.text, flex: 1, lineHeight: 19 },
});
