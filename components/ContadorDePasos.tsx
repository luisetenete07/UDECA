import React, { useState } from 'react';
import { frase } from '../lib/idioma';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { ProgressRing } from './ProgressRing';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { setStepLog, type StepLog } from '../lib/firestore/steps';
import { inicioDelDia } from '../lib/fechas';
import { conMiles } from '../lib/texto';
import {
  caloriasDePasos,
  mediaSemanal,
  OBJETIVO_POR_DEFECTO,
  pasosAGuardar,
  pasosDeHoy,
  progresoDePasos,
  sinElPasoFantasma,
  textoDePasos,
  ultimosSieteDias,
} from '../lib/pasos';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Los pasos del día, DENTRO de la tarjeta de hoy.
 *
 * Aquí y no en Progreso a propósito: los pasos no son entrenamiento, son el
 * gasto del resto del día, y es al lado de las calorías donde esa cifra
 * significa algo. Alguien que entrena cuatro horas a la semana y pasa las
 * otras ciento sesenta y cuatro sentado no tiene un problema de entrenamiento.
 *
 * Ya no es una tarjeta suya: eran tres tarjetas seguidas —peso, pasos,
 * macros— contando la misma historia por partes. Ahora los pasos suman a las
 * calorías del día en la misma cifra grande, que es lo único que se hace con
 * ellos.
 *
 * Quién guarda los registros: el padre. Los necesita para calcular el
 * presupuesto de calorías, y tenerlos cargados dos veces —aquí y allí— era
 * pedirle dos veces lo mismo a Firestore y arriesgarse a que las dos copias
 * no dijeran lo mismo.
 *
 * La cifra puede venir del contador del propio teléfono o escribirse a mano.
 * Lo segundo no es el plan B de lo primero: mucha gente lleva reloj, y un
 * contador que solo acepte lo que mide él deja fuera justo a quien más anda.
 */
export function ContadorDePasos({
  profile,
  pesoKg,
  registros,
  onCambio,
}: {
  profile: UserProfile;
  /** Último peso registrado, para estimar el gasto. Sin él no se estima nada. */
  pesoKg?: number;
  registros: StepLog[];
  /** Se llama tras guardar, para que el padre recargue y recalcule el día. */
  onCambio: () => void | Promise<void>;
}) {
  const [aMano, setAMano] = useState('');
  const [leyendo, setLeyendo] = useState(false);

  const cargar = onCambio;

  const hoy = pasosDeHoy(registros);
  const objetivo = profile.stepGoal ?? OBJETIVO_POR_DEFECTO;
  const p = progresoDePasos(hoy?.steps ?? 0, objetivo);
  const semana = ultimosSieteDias(registros);
  const media = mediaSemanal(registros);
  const kcal = caloriasDePasos(p.pasos, pesoKg);

  const guardar = async (pasos: number, origen: 'telefono' | 'mano') => {
    await setStepLog(profile.uid, Date.now(), pasos, origen, profile.trainerId);
    await cargar();
  };

  /**
   * Lee del contador del teléfono.
   *
   * En iPhone se puede preguntar por el día entero, incluido lo andado con la
   * app cerrada. En Android el sistema solo cuenta mientras la app está
   * abierta, así que se escucha un momento y lo que salga se SUMA a lo que ya
   * hubiera: sustituirlo borraría la mañana de quien abre la app por la tarde.
   */
  const leerDelTelefono = async () => {
    if (Platform.OS === 'web') {
      showToast('El contador del móvil solo está en la app de iPhone o Android');
      return;
    }
    setLeyendo(true);
    try {
      const Pedometer = require('expo-sensors').Pedometer;
      if (!(await Pedometer.isAvailableAsync())) {
        showToast('Este móvil no tiene contador de pasos');
        return;
      }
      const permiso = await Pedometer.requestPermissionsAsync();
      if (!permiso.granted) {
        showToast('Sin permiso de actividad no se pueden leer los pasos');
        return;
      }
      if (Platform.OS === 'ios') {
        /*
         * En iPhone se le puede preguntar al teléfono por el día entero, con
         * la app cerrada incluida: esta cifra es la buena y manda sobre lo que
         * hubiera (salvo que sea menor, ver `pasosAGuardar`).
         */
        const { steps } = await Pedometer.getStepCountAsync(
          new Date(inicioDelDia(Date.now())),
          new Date()
        );
        const leidos = Math.max(0, Math.round(Number(steps) || 0));
        // Cero no es un éxito: o no se ha andado, o el teléfono no lo está
        // guardando. Decir "actualizado" ahí es lo que hace que alguien se
        // quede pensando que la app cuenta mal.
        if (leidos === 0) {
          showToast(
            'Tu iPhone no tiene pasos guardados de hoy. Comprueba en Ajustes › Privacidad › Movimiento y forma física.'
          );
          return;
        }
        await guardar(pasosAGuardar(hoy, leidos, { acumulativo: false }), 'telefono');
        showToast(frase`Traídos ${conMiles(leidos)} pasos de tu iPhone`);
        return;
      }

      /*
       * Android no deja preguntar por el día: su `getStepCountAsync` ni
       * siquiera existe, lanza "not supported". Lo único que hay es escuchar el
       * sensor, y ese solo cuenta mientras la app está delante.
       *
       * Se escucha un momento y lo andado se SUMA a lo que ya hubiera, porque
       * sustituirlo borraría la mañana de quien abre UDECA por la tarde. Y se
       * descuenta el paso fantasma que regala el módulo (ver
       * `sinElPasoFantasma` en lib/pasos.ts): era el que ponía "1 paso" a todo
       * el mundo.
       */
      const contados = sinElPasoFantasma(
        await new Promise<number>((resolve) => {
          let ultimo = 0;
          const sub = Pedometer.watchStepCount((r: { steps: number }) => {
            ultimo = r.steps;
          });
          setTimeout(() => {
            sub.remove();
            resolve(ultimo);
          }, 4000);
        })
      );
      if (contados === 0) {
        // Sin dar nada por leído: guardar un cero no aporta y encima marca el
        // día como si viniera del teléfono.
        showToast(
          'Android solo cuenta los pasos con la app abierta. Escríbelos a mano si llevas reloj o usas otra app.'
        );
        return;
      }
      await guardar(pasosAGuardar(hoy, contados, { acumulativo: true }), 'telefono');
      showToast(frase`Sumados ${conMiles(contados)} pasos andados con la app abierta`);
    } catch {
      showToast('No se ha podido leer el contador del móvil');
    } finally {
      setLeyendo(false);
    }
  };

  const guardarAMano = async () => {
    const n = Number.parseInt(aMano, 10);
    if (!Number.isFinite(n) || n < 0) {
      showToast('Escribe cuántos pasos has dado');
      return;
    }
    await guardar(n, 'mano');
    setAMano('');
    showToast('Pasos guardados');
  };

  const maximo = Math.max(objetivo, ...semana.map((d) => d.steps), 1);

  return (
    <View style={styles.bloque}>
      <Text style={styles.titulo}>Pasos de hoy</Text>

      <View style={styles.cabecera}>
        <ProgressRing
          size={92}
          thickness={7}
          progress={p.ratio}
          value={conMiles(p.pasos)}
          label={frase`de ${conMiles(p.objetivo)}`}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.texto}>{textoDePasos(p)}</Text>
          {/* La estimación se presenta como tal. Nadie sabe de verdad cuántas
              calorías quema alguien andando, y dar una cifra exacta sería
              inventarse una precisión que no existe. */}
          {kcal > 0 ? (
            <Text style={styles.kcal}>≈ {conMiles(kcal)} kcal de gasto, aproximadas</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.semana}>
        {semana.map((d, i) => (
          <View key={d.date} style={styles.diaColumna}>
            <View style={styles.barraFondo}>
              <View
                style={[
                  styles.barra,
                  { height: `${Math.round((d.steps / maximo) * 100)}%` },
                  d.steps >= objetivo && styles.barraCumplida,
                ]}
              />
            </View>
            <Text style={[styles.diaLetra, i === 6 && styles.diaHoy]}>
              {DIAS[(new Date(d.date).getDay() + 6) % 7]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.media}>Media de la semana: {conMiles(media)} pasos al día</Text>

      <Pressable onPress={leerDelTelefono} disabled={leyendo} style={styles.conectar} hitSlop={6}>
        <Ionicons
          name={leyendo ? 'hourglass-outline' : 'phone-portrait-outline'}
          size={15}
          color={colors.primary}
        />
        <Text style={styles.conectarTexto}>
          {leyendo ? 'Leyendo…' : 'Traer los pasos del móvil'}
        </Text>
      </Pressable>

      <View style={styles.filaMano}>
        <TextField
          value={aMano}
          onChangeText={setAMano}
          placeholder="Ej. 9500"
          keyboardType="number-pad"
          containerStyle={styles.campo}
          style={{ marginBottom: 0 }}
          onSubmitEditing={guardarAMano}
          returnKeyType="done"
        />
        <Pressable onPress={guardarAMano} style={styles.botonMano}>
          <Text style={styles.botonManoTexto}>Apuntar a mano</Text>
        </Pressable>
      </View>
      {hoy?.source === 'mano' ? (
        <Text style={styles.origen}>Los de hoy los has escrito tú.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  titulo: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texto: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  kcal: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: 4 },
  semana: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    height: 76,
    marginTop: spacing.md,
  },
  diaColumna: { flex: 1, alignItems: 'center', gap: 4 },
  barraFondo: {
    width: '100%',
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barra: { width: '100%', backgroundColor: colors.primaryDark, borderRadius: radius.sm },
  barraCumplida: { backgroundColor: colors.primary },
  diaLetra: { fontSize: 10, color: colors.textFaint },
  diaHoy: { color: colors.primaryBright, fontFamily: fonts.semiBold },
  media: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: spacing.sm },
  conectar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  conectarTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  filaMano: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  campo: { flex: 1, marginBottom: 0 },
  botonMano: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  botonManoTexto: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  origen: { ...typography.small, color: colors.textFaint, fontSize: 11, marginTop: spacing.sm },
});
