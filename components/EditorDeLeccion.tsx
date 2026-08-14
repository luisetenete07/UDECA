import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
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

/**
 * Los campos comunes: tipo, enlace y duración. Y la miniatura SOLO en las
 * lecciones: una mini clase usa la de la plataforma del enlace, porque las
 * fotos subidas viven dentro del documento del curso y se lo comen (ver
 * lib/video.ts).
 */
function CamposDeContenido({
  contenido,
  onCambiar,
  thumbURL,
  onMiniatura,
  onQuitarMiniatura,
  compacto,
}: {
  contenido: ContenidoDeCurso;
  onCambiar: (campos: Partial<ContenidoDeCurso>) => void;
  /** Sin estas tres, no se ofrece subir nada: es una mini clase. */
  thumbURL?: string;
  onMiniatura?: () => void;
  onQuitarMiniatura?: () => void;
  compacto?: boolean;
}) {
  const esPdf = (contenido.kind ?? 'video') === 'pdf';
  return (
    <>
      {/* Quién la ve. Va aquí arriba, junto al tipo de contenido, porque es
          una decisión del mismo orden: qué es esto y para quién es. */}
      <Pressable
        onPress={() => onCambiar({ vip: contenido.vip === true ? undefined : true })}
        style={styles.filaVip}
        hitSlop={6}
        accessibilityRole="switch"
        accessibilityState={{ checked: contenido.vip === true }}
      >
        <Ionicons
          name={contenido.vip === true ? 'lock-closed' : 'people-outline'}
          size={16}
          color={contenido.vip === true ? colors.primaryBright : colors.textMuted}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.vipTitulo, contenido.vip === true && { color: colors.primaryBright }]}>
            {contenido.vip === true ? 'Solo alumnos VIP' : 'Para todos tus alumnos'}
          </Text>
          {!compacto ? (
            <Text style={styles.vipPista}>
              {contenido.vip === true
                ? 'Solo la ven los alumnos que hayas marcado como VIP en su ficha. Para el resto no existe.'
                : 'Toca para reservarla a tus alumnos VIP.'}
            </Text>
          ) : null}
        </View>
        <View style={[styles.vipInterruptor, contenido.vip === true && styles.vipInterruptorOn]}>
          <View style={[styles.vipBola, contenido.vip === true && styles.vipBolaOn]} />
        </View>
      </Pressable>

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

      {/* La duración y la miniatura, juntas: la duración se pinta encima de la
          imagen, así que se rellena mirándola. */}
      <View style={styles.filaMiniatura}>
        <Pressable onPress={onMiniatura} disabled={!onMiniatura} hitSlop={4}>
          <MiniaturaCurso
            contenido={contenido}
            thumbURL={thumbURL}
            tamano={compacto ? 'mini' : 'fila'}
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextField
            value={contenido.durationLabel ?? ''}
            onChangeText={(v) => onCambiar({ durationLabel: v })}
            placeholder="Duración (ej. 12 min)"
            containerStyle={{ marginBottom: spacing.xs }}
          />
          {onMiniatura ? (
            <Pressable
              onPress={thumbURL ? onQuitarMiniatura : onMiniatura}
              hitSlop={6}
            >
              <Text style={styles.enlaceMiniatura}>
                {thumbURL ? 'Quitar miniatura' : 'Subir miniatura'}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.pistaMiniatura}>
              La miniatura la pone la plataforma del vídeo.
            </Text>
          )}
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
        thumbURL={leccion.thumbURL}
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
  filaVip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  vipTitulo: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  vipPista: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: 1, lineHeight: 15 },
  vipInterruptor: {
    width: 38,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  vipInterruptorOn: { backgroundColor: colors.primaryMuted, borderColor: colors.hairline },
  vipBola: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.textFaint },
  vipBolaOn: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  filaMiniatura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  enlaceMiniatura: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  pistaMiniatura: { ...typography.small, color: colors.textFaint, fontSize: 11 },
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
