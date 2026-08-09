import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { DragList } from './DragList';
import { MiniaturaCurso } from './MiniaturaCurso';
import { Opciones } from './Opciones';
import { TextField } from './TextField';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../lib/theme';
import type { ContenidoDeCurso, Lesson, MiniClase } from '../lib/types';

/**
 * Una lección dentro del editor de cursos, con sus mini clases.
 *
 * Vive aparte porque una lección ya no es un par de campos: tiene tipo,
 * enlace, duración, miniatura, candado y una lista de mini clases que se
 * pueden reordenar. Todo eso dentro de la pantalla del curso convertía el
 * editor en una pared de cuatrocientas líneas donde no se distinguía qué
 * pertenecía a qué.
 *
 * Las mini clases empiezan PLEGADAS y solo aparecen si el entrenador las pide.
 * La mayoría de las lecciones son una lección y ya está; enseñar siempre una
 * sección de "mini clases" vacía sugiere que falta rellenarla.
 */

/** Los campos comunes: tipo, enlace, duración y miniatura. */
function CamposDeContenido({
  contenido,
  onCambiar,
  onMiniatura,
  onQuitarMiniatura,
  compacto,
}: {
  contenido: ContenidoDeCurso;
  onCambiar: (campos: Partial<ContenidoDeCurso>) => void;
  onMiniatura: () => void;
  onQuitarMiniatura: () => void;
  compacto?: boolean;
}) {
  const esPdf = (contenido.kind ?? 'video') === 'pdf';
  return (
    <>
      <Opciones
        opciones={[
          { valor: 'video', texto: 'Vídeo' },
          { valor: 'pdf', texto: 'E-book / PDF' },
        ]}
        valor={contenido.kind ?? 'video'}
        onChange={(k) => k && onCambiar({ kind: k as 'video' | 'pdf' })}
      />

      <TextField
        value={esPdf ? (contenido.pdfUrl ?? '') : (contenido.videoUrl ?? '')}
        onChangeText={(v) => onCambiar(esPdf ? { pdfUrl: v } : { videoUrl: v })}
        placeholder={
          esPdf
            ? 'Enlace de Drive, Dropbox o URL .pdf'
            : 'Enlace de Vimeo o URL .mp4'
        }
        autoCapitalize="none"
        containerStyle={{ marginTop: spacing.sm }}
      />

      {/* La duración y la miniatura, juntas: es lo que se ve encima de la
          imagen, así que se rellenan mirándolo. */}
      <View style={styles.filaMiniatura}>
        <Pressable onPress={onMiniatura} hitSlop={4}>
          <MiniaturaCurso contenido={contenido} tamano={compacto ? 'mini' : 'fila'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextField
            value={contenido.durationLabel ?? ''}
            onChangeText={(v) => onCambiar({ durationLabel: v })}
            placeholder="Duración (ej. 12 min)"
            containerStyle={{ marginBottom: spacing.xs }}
          />
          <Pressable onPress={contenido.thumbURL ? onQuitarMiniatura : onMiniatura} hitSlop={6}>
            <Text style={styles.enlaceMiniatura}>
              {contenido.thumbURL ? 'Quitar miniatura' : 'Subir miniatura'}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

export function EditorDeLeccion({
  leccion,
  numero,
  onCambiar,
  onQuitar,
  onMiniatura,
  onQuitarMiniatura,
  onMiniCambiar,
  onMiniNueva,
  onMiniQuitar,
  onMiniReordenar,
  onMiniMiniatura,
  onMiniQuitarMiniatura,
  handleProps,
}: {
  leccion: Lesson;
  numero: number;
  onCambiar: (campos: Partial<Lesson>) => void;
  onQuitar: () => void;
  onMiniatura: () => void;
  onQuitarMiniatura: () => void;
  onMiniCambiar: (miniId: string, campos: Partial<MiniClase>) => void;
  onMiniNueva: () => void;
  onMiniQuitar: (miniId: string) => void;
  onMiniReordenar: (de: number, a: number) => void;
  onMiniMiniatura: (miniId: string) => void;
  onMiniQuitarMiniatura: (miniId: string) => void;
  handleProps?: object;
}) {
  const minis = leccion.minis ?? [];
  const [abiertas, setAbiertas] = useState(minis.length > 0);

  return (
    <View style={styles.bloque}>
      <View style={styles.cabecera}>
        <View style={styles.asa} {...handleProps}>
          <Ionicons name="reorder-two-outline" size={20} color={colors.textFaint} />
        </View>
        <Text style={styles.numero}>Lección {numero}</Text>
        <Pressable onPress={onQuitar} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.danger} />
        </Pressable>
      </View>

      <TextField
        value={leccion.title}
        onChangeText={(v) => onCambiar({ title: v })}
        placeholder="Título de la lección"
      />

      <CamposDeContenido
        contenido={leccion}
        onCambiar={onCambiar}
        onMiniatura={onMiniatura}
        onQuitarMiniatura={onQuitarMiniatura}
      />

      <TextField
        label="Candado (días)"
        value={leccion.unlockAfterDays ? String(leccion.unlockAfterDays) : ''}
        onChangeText={(v) => onCambiar({ unlockAfterDays: parseInt(v, 10) || undefined })}
        placeholder="Ej. 30"
        keyboardType="numeric"
        containerStyle={{ marginBottom: spacing.xs }}
      />
      <Text style={styles.pista}>
        Días que el alumno debe llevar en tu grupo para verla. Vacío: desde el
        primer día. Alcanza también a sus mini clases.
      </Text>

      {/* Mini clases: plegadas hasta que hagan falta. */}
      <Pressable onPress={() => setAbiertas((v) => !v)} style={styles.filaMinis} hitSlop={6}>
        <Ionicons
          name={abiertas ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={colors.textMuted}
        />
        <Text style={styles.tituloMinis}>
          Mini clases{minis.length > 0 ? ` · ${minis.length}` : ''}
        </Text>
        {!abiertas && minis.length === 0 ? (
          <Text style={styles.pistaMinis}>opcional</Text>
        ) : null}
      </Pressable>

      {abiertas ? (
        <View style={styles.zonaMinis}>
          {minis.length === 0 ? (
            <Text style={styles.pista}>
              Trocea la lección en vídeos más cortos. Si no la necesitas, déjala
              vacía: la lección funciona igual con su propio vídeo.
            </Text>
          ) : null}

          <DragList
            items={minis}
            keyOf={(m) => m.id}
            onReorder={onMiniReordenar}
            handleOnly
            gap={spacing.sm}
            renderItem={(mini, i, arrastrando, asa) => (
              <View style={[styles.mini, arrastrando && styles.miniArrastrando]}>
                <View style={styles.cabecera}>
                  <View style={styles.asa} {...asa}>
                    <Ionicons name="reorder-two-outline" size={18} color={colors.textFaint} />
                  </View>
                  <Text style={styles.numeroMini}>Mini {i + 1}</Text>
                  <Pressable onPress={() => onMiniQuitar(mini.id)} hitSlop={8}>
                    <Ionicons name="close" size={15} color={colors.danger} />
                  </Pressable>
                </View>
                <TextField
                  value={mini.title}
                  onChangeText={(v) => onMiniCambiar(mini.id, { title: v })}
                  placeholder="Título de la mini clase"
                />
                <CamposDeContenido
                  contenido={mini}
                  onCambiar={(campos) => onMiniCambiar(mini.id, campos)}
                  onMiniatura={() => onMiniMiniatura(mini.id)}
                  onQuitarMiniatura={() => onMiniQuitarMiniatura(mini.id)}
                  compacto
                />
              </View>
            )}
          />

          <Button
            title="+ Añadir mini clase"
            variant="ghost"
            onPress={onMiniNueva}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  asa: { paddingVertical: 2, paddingRight: 2 },
  numero: { ...typography.label, color: colors.primary, flex: 1 },
  numeroMini: { ...typography.label, color: colors.textMuted, flex: 1, fontSize: 11 },
  pista: { ...typography.small, color: colors.textFaint, marginBottom: spacing.sm },
  filaMiniatura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  enlaceMiniatura: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  filaMinis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tituloMinis: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  pistaMinis: { ...typography.small, color: colors.textFaint, flex: 1 },
  zonaMinis: { paddingLeft: spacing.sm, borderLeftWidth: 1, borderLeftColor: colors.border },
  mini: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  miniArrastrando: { borderColor: colors.hairline },
});
