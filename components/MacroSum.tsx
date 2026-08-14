import React from 'react';
import { frase } from '../lib/idioma';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { CountUp } from './CountUp';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/**
 * Lo que suman los macros, mientras se escriben.
 *
 * Un plan nutricional es la única pantalla de la app donde el entrenador puede
 * equivocarse sin enterarse: pones 2.000 kcal arriba y unos macros que suman
 * 1.940, y nadie avisa. Los números cuadran o no cuadran, y saberlo es cuestión
 * de una resta que la app puede hacer sola.
 *
 * Se enseña siempre, no solo cuando falla: ver la cifra subir mientras tecleas
 * convierte rellenar un formulario en ajustar algo, que se hace con gusto. El
 * aviso solo aparece cuando la diferencia importa de verdad.
 */

const KCAL = { proteina: 4, carbos: 4, grasas: 9 };
/** Por debajo de esto la diferencia es redondeo, no un error. */
const TOLERANCIA = 50;

export function MacroSum({
  calorias,
  proteina,
  carbos,
  grasas,
}: {
  /** Las kcal declaradas arriba. */
  calorias: number;
  proteina: number;
  carbos: number;
  grasas: number;
}) {
  const deProteina = proteina * KCAL.proteina;
  const deCarbos = carbos * KCAL.carbos;
  const deGrasas = grasas * KCAL.grasas;
  const suma = deProteina + deCarbos + deGrasas;
  const diferencia = suma - calorias;
  const cuadra = Math.abs(diferencia) <= TOLERANCIA;

  const partes = [
    { nombre: 'Proteína', kcal: deProteina, color: colors.primaryBright },
    { nombre: 'Carbos', kcal: deCarbos, color: colors.primary },
    { nombre: 'Grasas', kcal: deGrasas, color: colors.warning },
  ];

  return (
    <View style={styles.caja}>
      <View style={styles.cabecera}>
        <Text style={styles.rotulo}>Suman</Text>
        <CountUp value={suma} suffix=" kcal" style={styles.cifra} />
      </View>

      {suma > 0 ? (
        <View style={styles.barra}>
          {partes.map((p) =>
            p.kcal > 0 ? (
              <View
                key={p.nombre}
                style={{ flex: p.kcal, backgroundColor: p.color, height: '100%' }}
              />
            ) : null
          )}
        </View>
      ) : null}

      <View style={styles.leyenda}>
        {partes.map((p) => (
          <View key={p.nombre} style={styles.leyendaItem}>
            <View style={[styles.punto, { backgroundColor: p.color }]} />
            <Text style={styles.leyendaTexto}>
              {p.nombre} {suma > 0 ? `${Math.round((p.kcal / suma) * 100)} %` : '—'}
            </Text>
          </View>
        ))}
      </View>

      {calorias > 0 && !cuadra ? (
        <Text style={styles.aviso}>
          {diferencia > 0
            ? frase`${Math.round(diferencia)} kcal por encima de las ${calorias.toLocaleString('es-ES')} que has puesto arriba.`
            : frase`${Math.round(-diferencia)} kcal por debajo de las ${calorias.toLocaleString('es-ES')} que has puesto arriba.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rotulo: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  cifra: { ...typography.h2, color: colors.text, ...tabularNums },
  barra: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
  },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  punto: { width: 7, height: 7, borderRadius: 4 },
  leyendaTexto: {
    ...typography.small,
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  aviso: {
    ...typography.small,
    color: colors.warning,
    marginTop: spacing.sm,
  },
});
