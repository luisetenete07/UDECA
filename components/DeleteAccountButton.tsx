import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { useAuth } from '../lib/auth-context';
import { friendlyAuthError } from '../lib/firebase-errors';
import { colors, spacing, typography } from '../lib/theme';

/**
 * Botón de "Eliminar cuenta" con doble confirmación. Borra el perfil y la
 * cuenta de acceso. Si Firebase exige reautenticación reciente, avisa de
 * que hay que cerrar sesión y volver a entrar antes de borrar.
 */
export function DeleteAccountButton() {
  const { deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = (msg: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      return Promise.resolve(window.confirm(msg));
    }
    return new Promise((resolve) => {
      Alert.alert('Eliminar cuenta', msg, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  };

  const handleDelete = async () => {
    if (!(await confirm('¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')))
      return;
    if (!(await confirm('Confirmación final: se borrará tu cuenta de forma permanente.'))) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // Al borrarse el usuario, el listener de auth redirige al login solo.
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        setError(
          'Por seguridad, cierra sesión, vuelve a entrar y prueba de nuevo a eliminar la cuenta.'
        );
      } else {
        setError(friendlyAuthError(e));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title="Eliminar cuenta"
        variant="ghost"
        onPress={handleDelete}
        loading={deleting}
        style={styles.btn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, marginBottom: spacing.xl },
  btn: { alignSelf: 'center' },
  error: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
