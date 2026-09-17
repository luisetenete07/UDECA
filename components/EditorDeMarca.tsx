import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { TextField } from './TextField';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { setBrandName } from '../lib/firestore/users';
import { frase } from '../lib/idioma';
import {
  LARGO_DE_LA_MARCA,
  MARCA_POR_DEFECTO,
  limpiarMarca,
  tieneMarcaPropia,
} from '../lib/marcaPropia';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * "Pon tu nombre donde pone UDECA."
 *
 * UNA PANTALLA PARA LOS DOS, y no es por ahorrar: entrenador y atleta hacen
 * exactamente lo mismo aquí, y con dos copias la que menos se usa se queda
 * vieja sin que nadie lo note. Lo único que cambia es la frase que explica a
 * quién le llega, porque el entrenador tiene alumnos y el atleta no.
 *
 * LA VISTA PREVIA NO ES ADORNO. El tope son doce letras, y doce letras es un
 * número que no significa nada mientras no ves tu palabra puesta en grande. Con
 * la muestra delante, quien escribe decide si le gusta antes de guardar, en vez
 * de guardar, salir, mirar y volver.
 */
export function EditorDeMarca() {
  const { profile, refreshProfile } = useAuth();
  const [texto, setTexto] = useState(profile?.brandName ?? '');
  const [guardando, setGuardando] = useState(false);

  if (!profile) return null;
  const esEntrenador = profile.role === 'trainer';
  const limpio = limpiarMarca(texto);
  const guardado = limpiarMarca(profile.brandName ?? '');
  const muestra = limpio || MARCA_POR_DEFECTO;
  // Sin cambios no hay nada que guardar, y un botón que se puede pulsar sin que
  // pase nada enseña a desconfiar del resto de botones.
  const cambiado = limpio !== guardado;

  const guardar = async () => {
    setGuardando(true);
    try {
      // Vacío BORRA el campo, no lo deja a ''. Es la misma decisión que en los
      // comentarios de la libreta: una cadena vacía no se ve, pero se queda
      // escrita para siempre y `tieneMarcaPropia` tendría que salir a
      // desmentirla.
      await setBrandName(profile.uid, limpio);
      await refreshProfile();
      showToast(limpio ? frase`Tu marca es ${limpio}` : 'Vuelve a verse UDECA');
    } catch {
      showToast('No se pudo guardar tu marca');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.cabecera}>
        <Ionicons name="pricetag-outline" size={17} color={colors.primary} />
        <Text style={styles.titulo}>Tu marca</Text>
      </View>
      <Text style={styles.ayuda}>
        {esEntrenador
          ? 'La palabra que sustituye a UDECA dentro de la app. La verás tú y la verán todos tus alumnos.'
          : 'La palabra que sustituye a UDECA dentro de la app, para que sea la tuya.'}
      </Text>

      <View style={styles.muestra}>
        <Text style={styles.muestraRotulo}>Así se verá</Text>
        <Text style={styles.muestraTexto} numberOfLines={1}>
          {muestra}
        </Text>
      </View>

      <TextField
        value={texto}
        onChangeText={setTexto}
        placeholder={MARCA_POR_DEFECTO}
        maxLength={LARGO_DE_LA_MARCA}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Text style={styles.cuenta}>
        {limpio.length}/{LARGO_DE_LA_MARCA}
      </Text>

      <Button
        title={limpio ? 'Guardar mi marca' : 'Volver a UDECA'}
        onPress={guardar}
        loading={guardando}
        disabled={!cambiado}
      />
      {tieneMarcaPropia(profile) ? (
        <Text style={styles.pie}>
          Déjalo vacío y guarda para volver a UDECA.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  titulo: { ...typography.h3, color: colors.text },
  ayuda: { ...typography.small, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  /*
   * La muestra se pinta con LA MISMA letra y el MISMO espaciado que la marca de
   * la barra lateral. Con otra tipografía sería una promesa que no se cumple:
   * cabría aquí y se saldría allí.
   */
  muestra: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  muestraRotulo: {
    ...typography.small,
    color: colors.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  muestraTexto: {
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: 2,
    color: colors.primary,
  },
  cuenta: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  pie: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm, textAlign: 'center' },
});
