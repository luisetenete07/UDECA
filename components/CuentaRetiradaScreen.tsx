import React from 'react';
import { useRouter } from 'expo-router';
import { Button } from './Button';
import { GateScreen } from './GateScreen';
import { useAuth } from '../lib/auth-context';
import { spacing } from '../lib/theme';

/**
 * Lo que ve una cuenta de un tipo que ya no existe.
 *
 * El perfil de atleta —quien se entrenaba solo, sin entrenador— se quitó para
 * centrar UDECA en los entrenadores y sus alumnos. Una cuenta antigua de ese
 * tipo no tiene grupo de pantallas al que ir: el del alumno la mandaría al del
 * entrenador y el del entrenador de vuelta, en bucle. Esta puerta corta el
 * bucle y le deja las dos salidas que tiene sentido ofrecer: salir, o borrar
 * su cuenta y sus datos.
 */
export function CuentaRetiradaScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  return (
    <GateScreen
      icono="information-circle-outline"
      titulo="Este tipo de cuenta ya no existe"
      texto="UDECA es ahora para entrenadores y sus alumnos. Si entrenas con alguien, pídele que te invite y entra con una cuenta de alumno."
      nota="Si quieres, puedes eliminar esta cuenta y todos sus datos."
      onSalir={signOut}
    >
      <Button
        title="Eliminar mi cuenta"
        variant="secondary"
        onPress={() => router.push('/account-deletion')}
        style={{ marginTop: spacing.md }}
      />
    </GateScreen>
  );
}
