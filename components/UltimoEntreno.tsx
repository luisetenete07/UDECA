import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { frase } from '../lib/idioma';
import { nombreDelDia } from '../lib/schedule';
import { unido } from '../lib/texto';
import { haceCuanto, siguienteDelCiclo, type UltimoEntreno as Ultimo } from '../lib/ultimoEntreno';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { Routine } from '../lib/types';

/**
 * "Lo último que hiciste fue el Día 3, hace seis días. ¿Sigues por el 4?"
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * Un plan por ciclos rueda solo, con el calendario: si te saltas dos días, el
 * ciclo no te espera. Vuelves y te encuentras en el Día 4 sin haber hecho el 2
 * ni el 3, sin que nada te explique por qué. Y lo único que había para
 * arreglarlo era "reiniciar el ciclo", que te devuelve al Día 1 y tira lo que
 * llevabas.
 *
 * Aquí se dice las dos cosas que hacen falta para decidir: por dónde ibas y por
 * dónde sigue. Y se puede seguir de verdad, en un toque.
 *
 * POR QUÉ EL BOTÓN GRANDE ES "SEGUIR" Y NO "REINICIAR"
 *
 * Porque es lo que quiere el noventa por ciento de las veces quien ha faltado
 * unos días: retomar donde lo dejó. Reiniciar sigue existiendo, en el menú de
 * la sesión, para quien de verdad quiere empezar el ciclo otra vez.
 *
 * EN EL PLAN SEMANAL SOLO SE INFORMA
 *
 * Ahí manda el día de la semana y no hay nada que retomar: el lunes toca lo del
 * lunes, faltes o no. Se enseña igualmente cuándo fue el último entreno, porque
 * eso vale en los dos casos y es la mitad de lo que se preguntó.
 */
export function UltimoEntreno({
  ultimo,
  routine,
  onSeguirPor,
  onElegirDia,
}: {
  ultimo: Ultimo | null;
  routine: Routine;
  /** Fija ese día del ciclo como el de hoy. */
  onSeguirPor: (indice: number) => void;
  /** Abre el selector para elegir cualquier otro día. */
  onElegirDia: () => void;
}) {
  if (!ultimo) return null;

  const esCiclo = routine.schedule === 'cycle';
  const siguiente = esCiclo ? siguienteDelCiclo(ultimo, routine.days.length) : null;
  const dia = siguiente !== null ? routine.days[siguiente] : null;
  const nombreSiguiente = dia ? nombreDelDia(dia.name, siguiente!) : null;

  return (
    <View style={styles.caja}>
      <View style={styles.cabecera}>
        <View style={styles.icono}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.etiqueta}>Tu último entreno</Text>
          {/* Con `unido` y no con `frase`: las dos mitades ya vienen
              traducidas, y una clave de diccionario que fuera "{0} · {1}" no
              diría nada a quien tuviera que traducirla. */}
          <Text style={styles.titulo}>{unido(ultimo.nombre, haceCuanto(ultimo.hace))}</Text>
        </View>
      </View>

      {esCiclo && siguiente !== null && nombreSiguiente ? (
        <>
          {/* Se dice si el siguiente es descanso ANTES de que lo pulse: es la
              diferencia entre "sigo por el 4" y encontrarse una pantalla de
              descanso sin saber por qué. */}
          <Text style={styles.explica}>
            {dia?.isRest
              ? frase`Tu ciclo sigue por el ${nombreSiguiente}, que es descanso.`
              : frase`Tu ciclo sigue por el ${nombreSiguiente}.`}
          </Text>
          <View style={styles.botones}>
            <Pressable onPress={() => onSeguirPor(siguiente)} style={styles.principal}>
              <Text style={styles.principalTexto}>
                {frase`Seguir por el ${nombreSiguiente}`}
              </Text>
            </Pressable>
            <Pressable onPress={onElegirDia} style={styles.secundario} hitSlop={6}>
              <Text style={styles.secundarioTexto}>Elegir otro día</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  icono: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  etiqueta: {
    ...typography.small,
    color: colors.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: fonts.semiBold,
  },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, marginTop: 1 },
  explica: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  botones: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  principal: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
  },
  principalTexto: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
  secundario: { paddingVertical: 9 },
  secundarioTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
