import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Button } from '../../components/Button';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { nombreParaEmpezar, nombreRecordado } from '../../lib/nombreDelProveedor';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';

/**
 * El último paso de entrar con Google o con Apple.
 *
 * El proveedor da una identidad —nombre, correo, foto— y aquí se crea con ella
 * la cuenta de alumno. No se pregunta nada más: Maestría en Calistenia tiene un
 * solo entrenador, así que no hay rol que elegir ni código que escribir. Crear
 * la cuenta le manda la solicitud a Luis, y se entra cuando la acepta.
 *
 * Quien ya tenía cuenta no ve esta pantalla nunca: su perfil ya existe y entra
 * directo.
 */

export default function CompletarCuentaScreen() {
  const { firebaseUser, completarPerfilDeGoogle, signOut } = useAuth();
  /*
   * EL NOMBRE NO SE PIDE. NUNCA. ES LA NORMA 4 DE APPLE.
   *
   * Costó DOS rechazos, el de la 1.1.2 y el de la 1.1.3, con el mismo texto:
   * "users are required to provide their name ... even though that information
   * is already provided by the Authentication Services framework".
   *
   * En la 1.1.3 se intentó arreglar enseñando el nombre en vez del campo
   * cuando el proveedor lo daba. No bastó, porque había DOS agujeros distintos
   * y los dos acaban en el mismo campo obligatorio:
   *
   *  1. UNA CARRERA. La pantalla se pintaba antes de que terminara de
   *     escribirse el nombre, leía vacío, y su estado inicial no se recalcula.
   *     (Cerrado en lib/appleAuth.ts, guardándolo antes de llamar a Firebase.)
   *  2. APPLE SOLO LO MANDA UNA VEZ. En la primera autorización y nunca más:
   *     ni al volver a entrar, ni después de borrar la cuenta en la app. El
   *     revisor ya había entrado con esa cuenta al mirar la 1.1.2, así que en
   *     la 1.1.3 llegó sin nombre — y NO HAY FORMA de volver a pedírselo a
   *     Apple.
   *
   * Contra el segundo no vale "conseguir el nombre": hay que DEJAR DE
   * NECESITARLO. Así que aquí se llega siempre con uno puesto (el del
   * proveedor, o uno sacado del correo) y se enseña como un dato con un enlace
   * para cambiarlo. Guardar no comprueba el nombre: no hay nada que se pueda
   * rellenar mal y no hay forma de quedarse atrapado en esta pantalla.
   *
   * Si de todo eso no sale nada —correo escondido de Apple y sin nombre— sale
   * el campo, pero OPCIONAL: se puede crear la cuenta sin tocarlo.
   */
  const nombreDePartida = nombreParaEmpezar(
    firebaseUser?.displayName,
    nombreRecordado(),
    firebaseUser?.email
  );
  const [name, setName] = useState(nombreDePartida);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Cerrar la sesión para entrar con otra cuenta.
   *
   * Si falla hay que DECIRLO. Antes se llamaba a `signOut` directamente desde
   * el `onPress`, así que un error se perdía en una promesa sin recoger y la
   * pantalla se quedaba igual: exactamente lo mismo que se ve cuando funciona
   * pero no te sacan de aquí, y sin forma de distinguir un caso del otro.
   */
  const salir = async () => {
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido cerrar la sesión.');
    }
  };

  const guardar = async () => {
    /*
     * NO SE COMPRUEBA EL NOMBRE. Antes esto cortaba con "Pon tu nombre", y era
     * la cara visible de la norma 4: quien entraba con Apple sin que Apple
     * mandara nombre no podía pasar de aquí sin escribirlo.
     */
    setError(null);
    setGuardando(true);
    try {
      // Vacío no es un fallo: se guarda con el de partida, y si tampoco lo hay
      // lo resuelve el contexto. Es un dato que se cambia en el perfil en dos
      // toques; dejar a alguien fuera de su cuenta por él, no.
      await completarPerfilDeGoogle(name.trim() || nombreDePartida);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido crear la cuenta.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.contenido}>
      <Text style={styles.titulo}>Ya casi</Text>
      <Text style={styles.subtitulo}>
        {/* Ni "Google" ni "Apple" a fuego: aquí se llega por los dos, y decir
            el que no es hace dudar de si la cuenta es la correcta. */}
        Has entrado como {firebaseUser?.email ?? 'tu cuenta'}. Al crear tu cuenta, Luis recibe
        tu solicitud para entrar en el grupo.
      </Text>

      {editandoNombre || !nombreDePartida ? (
        <TextField
          // "Opcional" escrito donde se lee. Este campo solo sale cuando no ha
          // habido forma de sacar un nombre de ningún sitio, y aun así no
          // impide crear la cuenta.
          label={nombreDePartida ? 'Tu nombre' : 'Tu nombre (opcional)'}
          value={name}
          onChangeText={setName}
          placeholder="Nombre y apellido"
          autoFocus={editandoNombre || undefined}
        />
      ) : (
        <View style={styles.nombreFila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombreEtiqueta}>Tu nombre</Text>
            <Text style={styles.nombreValor} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <Pressable onPress={() => setEditandoNombre(true)} hitSlop={8}>
            <Text style={styles.nombreCambiar}>Cambiar</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Crear mi cuenta"
        onPress={guardar}
        loading={guardando}
        style={{ marginTop: spacing.md }}
      />
      {/* Salida para quien entró con la cuenta equivocada: sin esto se
          quedaría atrapado aquí, con sesión abierta y sin poder cambiarla.
          Quien saca de esta pantalla al cerrar la sesión es (auth)/_layout. */}
      <Pressable onPress={salir} hitSlop={8} style={styles.salir}>
        <Text style={styles.salirTexto}>Entrar con otra cuenta</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'center' },
  titulo: { ...typography.h1, color: colors.text, textAlign: 'center' },
  // El nombre ya sabido: se enseña como un dato, no como un formulario. La
  // altura es parecida a la del campo para que la pantalla no dé un salto al
  // pulsar "Cambiar".
  nombreFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  nombreEtiqueta: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  nombreValor: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, marginTop: 1 },
  nombreCambiar: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  subtitulo: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  error: { ...typography.small, color: colors.danger, marginTop: spacing.sm },
  salir: { alignSelf: 'center', paddingVertical: spacing.md },
  salirTexto: { ...typography.small, color: colors.textFaint },
});
