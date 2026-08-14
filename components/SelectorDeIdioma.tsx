import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from './Texto';
import { Card } from './Card';
import { Segmented } from './Segmented';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth-context';
import { updateUserProfile } from '../lib/firestore/users';
import { t, setIdioma, useIdioma, useT  } from '../lib/idioma';
import { IDIOMAS, type Idioma } from '../lib/i18n';
import { colors, spacing, typography } from '../lib/theme';

/**
 * Elegir idioma.
 *
 * Se aplica al instante y se guarda detrás: nadie debería esperar a la red
 * para ver su app en otro idioma, y si el guardado falla lo peor que pasa es
 * que al reinstalar vuelva al idioma del móvil.
 *
 * Cada idioma se ofrece escrito en sí mismo ("English", no "Inglés"): quien
 * busca el inglés porque no entiende el español no va a reconocer la palabra
 * "Inglés".
 */
export function SelectorDeIdioma() {
  const { profile, refreshProfile } = useAuth();
  const idioma = useIdioma();
  const t = useT();
  const [guardando, setGuardando] = useState(false);

  const cambiar = async (nuevo: Idioma) => {
    setIdioma(nuevo);
    if (!profile || guardando) return;
    setGuardando(true);
    try {
      await updateUserProfile(profile.uid, { language: nuevo });
      await refreshProfile();
    } catch {
      showToast(t('No se pudo guardar'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card style={styles.tarjeta}>
      <Text style={styles.titulo}>{t('Idioma')}</Text>
      <Segmented opciones={IDIOMAS} valor={idioma} onChange={cambiar} />
      <Text style={styles.pista}>
        {/* Lo que NO se traduce es lo que escribís vosotros: el nombre de un
            ejercicio, el título de un curso, una nota. Decirlo evita la
            sensación de que la traducción se ha dejado cosas a medias. */}
        Tus ejercicios, tus rutinas y tus notas se quedan como las escribiste.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  titulo: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  pista: { ...typography.small, color: colors.textFaint, lineHeight: 18 },
});
