import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { fotoDePeso } from '../lib/firestore/fotosDePeso';
import { fechaLegible } from '../lib/fechas';
import { frase } from '../lib/idioma';
import { kgCorto } from '../lib/peso';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { WeightLog } from '../lib/types';

/** Registros a la vista sin pedir más. */
const A_LA_VISTA = 3;

/**
 * Los registros de peso, del último al primero: fecha, kilos, la nota y la
 * foto si la lleva. Las fotos se piden solo de las filas que se ven, y se
 * abren en grande con un toque.
 *
 * Lo usan el alumno (en su tarjeta del peso) y Luis (en la ficha del alumno),
 * así que los dos ven lo mismo.
 */
export function RegistrosDePeso({
  logs,
  onBorrarUltimo,
}: {
  logs: WeightLog[];
  /** Si se da, el último registro lleva su papelera (deshacer un peso mal escrito). */
  onBorrarUltimo?: (log: WeightLog) => void;
}) {
  const [todos, setTodos] = useState(false);
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [abierta, setAbierta] = useState<string | null>(null);

  const ordenados = [...logs].sort((a, b) => b.date - a.date);
  const visibles = todos ? ordenados : ordenados.slice(0, A_LA_VISTA);

  // Las fotos de las filas que se ven y aún no se han pedido.
  const pendientes = visibles.filter((l) => l.conFoto && !(l.id in fotos)).map((l) => l.id);
  useEffect(() => {
    if (pendientes.length === 0) return;
    let vivo = true;
    Promise.all(pendientes.map(async (id) => [id, await fotoDePeso(id)] as const)).then((pares) => {
      if (vivo) setFotos((prev) => ({ ...prev, ...Object.fromEntries(pares) }));
    });
    return () => {
      vivo = false;
    };
    // Solo cuando cambia qué falta por pedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientes.join(',')]);

  if (ordenados.length === 0) return null;

  return (
    <View style={styles.lista}>
      {visibles.map((l, i) => {
        const foto = fotos[l.id];
        return (
          <View key={l.id} style={[styles.fila, i > 0 && styles.filaSeparada]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.linea}>
                <Text style={styles.kg}>{kgCorto(l.weightKg)} kg</Text>
                <Text style={styles.fecha}>{fechaLegible(l.date)}</Text>
              </View>
              {l.notes ? (
                <Text style={styles.nota} numberOfLines={2}>
                  {l.notes}
                </Text>
              ) : null}
            </View>
            {l.conFoto ? (
              <Pressable
                onPress={() => foto && setAbierta(foto)}
                style={styles.miniatura}
                accessibilityRole="button"
                accessibilityLabel={frase`Foto del ${fechaLegible(l.date)}`}
              >
                {foto ? (
                  <Image source={{ uri: foto }} style={styles.miniaturaImagen} resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={16} color={colors.textFaint} />
                )}
              </Pressable>
            ) : null}
            {i === 0 && onBorrarUltimo ? (
              <Pressable
                onPress={() => onBorrarUltimo(l)}
                hitSlop={8}
                style={styles.borrar}
                accessibilityRole="button"
                accessibilityLabel={frase`Borrar el registro de ${kgCorto(l.weightKg)} kg`}
              >
                <Ionicons name="trash-outline" size={15} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {ordenados.length > A_LA_VISTA ? (
        <Pressable onPress={() => setTodos((v) => !v)} style={styles.mas} hitSlop={6}>
          <Ionicons name={todos ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
          <Text style={styles.masTexto}>{todos ? 'Ver menos' : frase`Ver los ${ordenados.length} registros`}</Text>
        </Pressable>
      ) : null}

      {/* La foto en grande: un toque fuera, o la X, la cierra. */}
      <Modal visible={!!abierta} transparent animationType="fade" onRequestClose={() => setAbierta(null)}>
        <Pressable style={styles.fondo} onPress={() => setAbierta(null)}>
          {abierta ? <Image source={{ uri: abierta }} style={styles.grande} resizeMode="contain" /> : null}
          <Pressable style={styles.cerrar} onPress={() => setAbierta(null)} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { marginTop: spacing.sm },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  filaSeparada: { borderTopWidth: 1, borderTopColor: colors.border },
  linea: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  kg: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, ...tabularNums },
  fecha: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  nota: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  miniatura: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniaturaImagen: { width: '100%', height: '100%' },
  borrar: { padding: 4 },
  mas: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingTop: spacing.xs },
  masTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  grande: { width: '94%', height: '84%' },
  cerrar: { position: 'absolute', top: 44, right: 20 },
});
