import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { DateField, startOfToday } from './DateField';
import { Opciones } from './Opciones';
import { Sheet } from './Sheet';
import { TextField } from './TextField';
import { diaLargo } from '../lib/fechas';
import { conPausaNueva, podarPausas, terminadaHoy, type PausaPlan } from '../lib/pausa';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Poner o quitar una pausa del plan. Lo usan el coach (desde la ficha del
 * alumno) y el propio atleta (desde su perfil), porque es la misma decisión
 * tomada por dos personas distintas: unos días en los que no se entrena.
 *
 * Los atajos de arriba están porque el caso real casi siempre es uno de esos
 * tres —me he puesto malo, me voy el finde, me voy la semana— y elegir dos
 * fechas para decir "hasta el domingo" es trabajo que la app puede ahorrar.
 * Las fechas siguen ahí debajo para cuando no encaje ninguno.
 */

const ATAJOS = [
  { valor: '2', texto: '2 días' },
  { valor: '4', texto: '4 días' },
  { valor: '7', texto: 'Una semana' },
] as const;

const DIA = 24 * 60 * 60 * 1000;

export function PausaPlanSheet({
  visible,
  onClose,
  pausas,
  activa,
  porQuien,
  guardando,
  onGuardar,
}: {
  visible: boolean;
  onClose: () => void;
  pausas: PausaPlan[] | undefined;
  /** La que cubre hoy, si la hay: entonces el panel sirve para terminarla. */
  activa: PausaPlan | null;
  porQuien: 'coach' | 'alumno';
  guardando?: boolean;
  onGuardar: (pausas: PausaPlan[]) => void;
}) {
  const [desde, setDesde] = useState<number>(startOfToday());
  const [hasta, setHasta] = useState<number>(startOfToday() + 2 * DIA);
  const [motivo, setMotivo] = useState('');

  const dias = Math.max(1, Math.round((hasta - desde) / DIA) + 1);

  const aplicarAtajo = (n: string | undefined) => {
    if (!n) return;
    const d = startOfToday();
    setDesde(d);
    setHasta(d + (Number(n) - 1) * DIA);
  };

  const guardar = () => {
    const texto = motivo.trim();
    const nueva: PausaPlan = {
      desde,
      // Una pausa al revés no existe: si las fechas se cruzan, manda la de
      // inicio. Es más útil que un mensaje de error por un dedo torcido.
      hasta: Math.max(desde, hasta),
      // El motivo va o no va, pero nunca va como `undefined`: Firestore no
      // admite undefined dentro de un array y rechaza la escritura entera.
      ...(texto ? { motivo: texto } : {}),
      porQuien,
      creadaEn: Date.now(),
    };
    onGuardar(podarPausas(conPausaNueva(pausas, nueva)));
  };

  if (activa) {
    return (
      <Sheet visible={visible} onClose={onClose} titulo="El plan está en pausa">
        <View style={styles.aviso}>
          <Ionicons name="pause-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.avisoTexto}>
            Hasta el {diaLargo(activa.hasta)}
            {activa.motivo ? ` · ${activa.motivo}` : ''}
          </Text>
        </View>
        <Text style={styles.explicacion}>
          Estos días no se espera ninguna sesión: la racha no se rompe, no llegan
          avisos y el plan se retoma justo donde se dejó. Entrenar sigue estando
          permitido: si un día apetece, cuenta como cualquier otro.
        </Text>
        <Button
          title="Volver al plan hoy"
          onPress={() => onGuardar(podarPausas(terminadaHoy(pausas)))}
          loading={guardando}
          style={{ marginTop: spacing.md }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      titulo="Pausar el plan"
      descripcion="Unos días sin entrenar que no rompen nada. Al terminar, el plan sigue donde se quedó."
    >
      <Text style={fieldLabel}>Cuánto</Text>
      <Opciones
        opciones={ATAJOS.map((a) => ({ valor: a.valor, texto: a.texto }))}
        valor={ATAJOS.find((a) => Number(a.valor) === dias && desde === startOfToday())?.valor}
        onChange={aplicarAtajo}
      />

      <View style={{ marginTop: spacing.md }}>
        <Text style={fieldLabel}>Desde</Text>
        <DateField value={desde} onChange={setDesde} />
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <Text style={fieldLabel}>Hasta (incluido)</Text>
        <DateField value={hasta} onChange={setHasta} />
      </View>

      <TextField
        label="Motivo (opcional)"
        value={motivo}
        onChangeText={setMotivo}
        placeholder={porQuien === 'coach' ? 'Ej. Lesión de hombro' : 'Ej. Viaje de trabajo'}
        containerStyle={{ marginTop: spacing.md }}
      />

      <Text style={styles.resumen}>
        {dias} {dias === 1 ? 'día' : 'días'} en pausa · vuelve el{' '}
        {diaLargo(Math.max(desde, hasta) + DIA)}
      </Text>

      <Button
        title="Pausar el plan"
        onPress={guardar}
        loading={guardando}
        style={{ marginTop: spacing.sm }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  avisoTexto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  explicacion: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  resumen: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
