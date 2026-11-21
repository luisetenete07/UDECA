import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { TextField } from './TextField';
import { WeightChart } from './WeightChart';
import { RegistrosDePeso } from './RegistrosDePeso';
import { showToast } from './Toast';
import { confirmar } from '../lib/confirmar';
import { frase } from '../lib/idioma';
import { createWeightLog, deleteWeightLog } from '../lib/firestore/weightLogs';
import { guardarFotoDePeso } from '../lib/firestore/fotosDePeso';
import { pickWeightPhoto } from '../lib/image';
import { conSigno, kgCorto, pesoDeTexto, resumenDePeso, textoDelObjetivo } from '../lib/peso';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';
import type { UserProfile, WeightLog } from '../lib/types';

/**
 * El peso: cuánto pesa, cómo va, cómo ha ido y apuntar el de hoy, con su foto
 * si quiere. TODO en una tarjeta, y ajustada.
 *
 * Luis la pidió más pequeña sin perder nada. Lo que tenía sigue: la cifra, el
 * cambio de la semana y del mes, el objetivo, la gráfica, apuntar con nota y
 * deshacer el último. Lo que cambia es cómo ocupa:
 *
 *  - La cifra y los cambios van en la misma franja, no en tres filas.
 *  - La gráfica es más baja y sin su fila de resumen, que repetía la cifra.
 *  - La nota no es un campo siempre abierto: "Añadir nota" lo abre.
 *
 * Y suma lo que pidió: una FOTO EN CADA REGISTRO. Se elige al apuntar (el
 * botón de la cámara, junto a "Apuntar") y se ve en la lista de registros,
 * que de paso enseña los últimos pesos con su fecha y su nota.
 */
export function BloqueDePeso({
  profile,
  logs,
  onCambio,
  /** En Progreso el título sobra: ya lo dice la pestaña. */
  conTitulo = true,
}: {
  profile: UserProfile | null | undefined;
  logs: WeightLog[];
  /** Se llama tras guardar o borrar, para que el padre recargue lo suyo. */
  onCambio: () => void | Promise<void>;
  conTitulo?: boolean;
}) {
  const [peso, setPeso] = useState('');
  const [notas, setNotas] = useState('');
  const [conNota, setConNota] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const resumen = resumenDePeso(logs, profile?.targetWeightKg);
  const delObjetivo = textoDelObjetivo(resumen, profile?.targetWeightKg);

  const elegirFoto = async () => {
    try {
      const elegida = await pickWeightPhoto();
      if (elegida) setFoto(elegida);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo abrir la foto');
    }
  };

  const guardar = async () => {
    if (!profile) return;
    const kg = pesoDeTexto(peso);
    if (kg === undefined) {
      setError('Escribe tu peso en kg (por ejemplo, 66,4).');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const fecha = Date.now();
      const id = await createWeightLog({
        trainerId: profile.trainerId ?? '',
        clientId: profile.uid,
        date: fecha,
        weightKg: kg,
        notes: notas.trim() || undefined,
        conFoto: foto ? true : undefined,
      });
      if (foto) {
        // El peso ya está guardado: si la foto falla, se dice, pero el peso
        // no se pierde por ella.
        await guardarFotoDePeso(id, {
          clientId: profile.uid,
          trainerId: profile.trainerId ?? '',
          date: fecha,
          foto,
        }).catch(() => showToast('El peso se ha guardado, pero la foto no. Inténtalo otra vez.'));
      }
      setPeso('');
      setNotas('');
      setConNota(false);
      setFoto(null);
      await onCambio();
      showToast('Peso guardado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  // Solo se deshace el último: es el que se acaba de escribir mal. Deshacer el
  // de hace tres semanas no lo pide nadie.
  const borrar = async (log: WeightLog) => {
    if (!(await confirmar(frase`¿Borrar el registro de ${kgCorto(log.weightKg)} kg?`))) return;
    try {
      await deleteWeightLog(log.id, log.conFoto);
      await onCambio();
      showToast('Registro borrado');
    } catch {
      showToast('No se pudo borrar');
    }
  };

  return (
    <Card style={styles.tarjeta}>
      <View style={styles.cabecera}>
        {conTitulo ? <Text style={styles.titulo}>Mi peso</Text> : null}
        {resumen.actual !== undefined ? (
          <Text style={styles.cifra}>
            {kgCorto(resumen.actual)}
            <Text style={styles.unidad}> kg</Text>
          </Text>
        ) : null}
      </View>

      {resumen.actual === undefined ? (
        <Text style={styles.vacio}>
          Pésate a la misma hora, mejor en ayunas. Lo que importa no es el número de hoy: es hacia
          dónde va.
        </Text>
      ) : (
        <>
          {/* Los cambios y el objetivo, en una franja. */}
          <View style={styles.franja}>
            <Cambio etiqueta="Semana" kg={resumen.semana} />
            <Cambio etiqueta="Mes" kg={resumen.mes} />
            {delObjetivo ? (
              <View style={styles.objetivo}>
                <Ionicons
                  name={resumen.enObjetivo ? 'checkmark-circle' : 'flag-outline'}
                  size={13}
                  color={resumen.enObjetivo ? colors.success : colors.primaryBright}
                />
                <Text style={styles.objetivoTexto} numberOfLines={2}>
                  {delObjetivo}
                </Text>
              </View>
            ) : null}
          </View>
          {logs.length > 1 ? (
            <View style={styles.grafica}>
              <WeightChart logs={logs} compacto />
            </View>
          ) : null}
        </>
      )}

      {/* Apuntar: el peso, su foto si quiere, y listo. */}
      <View style={styles.apuntar}>
        <TextField
          placeholder="Ej. 66,4 kg"
          keyboardType="decimal-pad"
          value={peso}
          onChangeText={setPeso}
          containerStyle={styles.campo}
          style={{ marginBottom: 0 }}
        />
        <Pressable
          onPress={elegirFoto}
          style={[styles.botonFoto, foto && styles.botonFotoPuesta]}
          accessibilityRole="button"
          accessibilityLabel={foto ? 'Cambiar la foto' : 'Añadir una foto'}
          hitSlop={4}
        >
          {foto ? (
            <Image source={{ uri: foto }} style={styles.fotoElegida} resizeMode="cover" />
          ) : (
            <Ionicons name="camera-outline" size={20} color={colors.primaryBright} />
          )}
        </Pressable>
        <Button title="Apuntar" onPress={guardar} loading={guardando} style={styles.boton} />
      </View>

      <View style={styles.extras}>
        {foto ? (
          <Pressable onPress={() => setFoto(null)} style={styles.enlace} hitSlop={6}>
            <Ionicons name="close-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.enlaceTexto}>Quitar la foto</Text>
          </Pressable>
        ) : null}
        {!conNota ? (
          <Pressable onPress={() => setConNota(true)} style={styles.enlace} hitSlop={6}>
            <Ionicons name="create-outline" size={14} color={colors.primary} />
            <Text style={[styles.enlaceTexto, { color: colors.primary }]}>Añadir nota</Text>
          </Pressable>
        ) : null}
      </View>
      {conNota ? (
        <TextField
          placeholder="Notas (opcional)"
          value={notas}
          onChangeText={setNotas}
          autoFocus
          style={{ marginBottom: 0 }}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <RegistrosDePeso logs={logs} onBorrarUltimo={borrar} />
    </Card>
  );
}

/**
 * Un cambio de peso. Sin dato no se pinta un cero: quien lleva dos días
 * apuntándose no ha ganado ni perdido nada este mes, es que no hay mes.
 */
function Cambio({ etiqueta, kg }: { etiqueta: string; kg?: number }) {
  return (
    <View style={styles.cambio}>
      <Text style={styles.cambioEtiqueta}>{etiqueta}</Text>
      <Text style={styles.cambioValor}>{kg === undefined ? '—' : conSigno(kg)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  titulo: { ...typography.h3, color: colors.text },
  cifra: { fontSize: 28, lineHeight: 32, fontFamily: fonts.heading, color: colors.text, ...tabularNums },
  unidad: { ...typography.small, color: colors.textMuted, fontFamily: fonts.body },
  vacio: { ...typography.small, color: colors.textMuted, lineHeight: 19, marginTop: spacing.xs },
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  cambio: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  cambioEtiqueta: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 10,
  },
  cambioValor: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, ...tabularNums },
  objetivo: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: 140 },
  objetivoTexto: { ...typography.small, fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  grafica: { marginTop: spacing.sm },
  apuntar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Se parte si no cabe: en un móvil de 320, campo, foto y botón juntos le
    // dejaban al campo 76 px y "Ej. 66,4 kg" no entraba. Partida, el botón
    // baja a su propia línea.
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  campo: { flexGrow: 1, flexBasis: 150, minWidth: 150 },
  botonFoto: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  botonFotoPuesta: { borderColor: colors.primary },
  fotoElegida: { width: '100%', height: '100%' },
  boton: { flexGrow: 1, minWidth: 96 },
  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs, marginBottom: spacing.xs },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  enlaceTexto: { ...typography.small, fontSize: 12, color: colors.textMuted, fontFamily: fonts.semiBold },
  error: { ...typography.small, color: colors.danger, marginTop: spacing.sm },
});
