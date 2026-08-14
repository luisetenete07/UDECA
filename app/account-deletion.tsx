import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Texto';
import { t } from '../lib/idioma';
import { esLaPalabra } from '../lib/i18n';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { TextField } from '../components/TextField';
import { showToast } from '../components/Toast';
import { useAuth } from '../lib/auth-context';
import { eraseMyData, RESTOS_TRAS_BORRAR } from '../lib/firestore/eraseAccount';
import { CONTACT_EMAIL } from '../lib/subscription';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/** Lo que hay que escribir para confirmar. En mayúsculas y sin acentos. */
const PALABRA = 'ELIMINAR MI CUENTA';
/** Segundos de espera antes de que el último botón se active. */
const ESPERA_SEGUNDOS = 20;

const MOTIVOS = [
  'Ya no entreno',
  'Uso otra aplicación',
  'Me parece cara',
  'Le falta algo que necesito',
  'Prefiero no decirlo',
];

/**
 * Eliminar la cuenta, desde dentro de la app y para cualquier perfil.
 *
 * Existe porque tiene que existir: Google Play (desde 2023) y Apple (norma
 * 5.1.1) obligan a que quien puede crearse una cuenta pueda borrarla sin salir
 * de la app, y el RGPD da derecho a que se borren los datos. Enviar a la gente
 * a escribir un correo no cumple ninguna de las dos cosas.
 *
 * Ahora bien: borrarse es irreversible y aquí hay años de entrenamiento de por
 * medio, así que el camino es largo a propósito. Cinco pasos, una palabra
 * escrita a mano, la contraseña y una espera final. Cada paso dice algo que el
 * usuario necesita saber —qué se borra, qué alternativas tiene, qué queda—, de
 * forma que la fricción informa en vez de solo estorbar; poner obstáculos por
 * poner sería, además, justo lo que el RGPD llama obstaculizar el derecho.
 *
 * Lo que NO se hace: pedir el motivo como obligatorio para seguir, esconder el
 * botón final, ni prometer un borrado total que no ocurre (ver el paso 4).
 */
export default function AccountDeletionScreen() {
  const router = useRouter();
  const { profile, signOut, deleteAccount, reauthenticate } = useAuth();
  const [paso, setPaso] = React.useState(0);
  const [motivo, setMotivo] = React.useState<string | null>(null);
  const [palabra, setPalabra] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [segundos, setSegundos] = React.useState(ESPERA_SEGUNDOS);
  const [borrando, setBorrando] = React.useState(false);
  const [avance, setAvance] = React.useState<string | null>(null);

  const esEntrenador = profile?.role === 'trainer';
  const esAtleta = profile?.role === 'athlete';

  // La cuenta atrás del último paso: empieza al llegar, no antes.
  React.useEffect(() => {
    if (paso !== 4) return;
    setSegundos(ESPERA_SEGUNDOS);
    const id = setInterval(() => setSegundos((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [paso]);

  const salir = () => router.back();

  const borrar = async () => {
    if (!profile) return;
    setBorrando(true);
    setError(null);
    try {
      // 1) La contraseña. Si es incorrecta no se ha tocado nada todavía.
      await reauthenticate(password);
      // 2) Los datos, con la sesión aún viva (después ya no habría permisos).
      setAvance('Borrando tus datos...');
      await eraseMyData(profile, (p) => setAvance(`${p.texto}: ${p.hechos}`));
      // 3) El perfil y el usuario.
      setAvance('Cerrando tu cuenta...');
      await deleteAccount();
      showToast('Tu cuenta ha sido eliminada');
      router.replace('/(auth)/login');
    } catch (e) {
      const codigo = (e as { code?: string })?.code;
      setError(
        codigo === 'auth/wrong-password' || codigo === 'auth/invalid-credential'
          ? 'La contraseña no es correcta.'
          : codigo === 'auth/too-many-requests'
            ? 'Demasiados intentos. Espera unos minutos y vuelve a probar.'
            : 'No se ha podido completar. Inténtalo de nuevo o escríbenos.'
      );
      setAvance(null);
    } finally {
      setBorrando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.cabecera}>
        <Pressable onPress={salir} hitSlop={10} style={styles.volver}>
          <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          <Text style={styles.volverTexto}>Volver</Text>
        </Pressable>
        <Text style={styles.pasoTexto}>Paso {paso + 1} de 5</Text>
      </View>
      <View style={styles.progreso}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.tramo, i <= paso && styles.tramoHecho]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.cuerpo}>
        {paso === 0 ? (
          <>
            <Text style={styles.titulo}>Vas a eliminar tu cuenta</Text>
            <Text style={styles.parrafo}>
              Esto no se puede deshacer. No hay papelera, ni copia que podamos devolverte
              después. Antes de seguir, mira lo que desaparece:
            </Text>
            <Card style={styles.tarjeta}>
              {(esEntrenador
                ? [
                    'Tu perfil, tu foto y tu código de entrenador',
                    'Tu biblioteca de ejercicios, rutinas y plantillas',
                    'Tus cursos, tus notas y tus tareas',
                    'El historial de cobros de tus alumnos',
                  ]
                : [
                    'Tu perfil, tu foto y tus objetivos',
                    'Todos tus entrenamientos y tus marcas',
                    'Tu peso, tus fotos de progreso y tus tests de nivel',
                    esAtleta ? 'Tu plan y tu nutrición' : 'Tu sitio en la clasificación del grupo',
                  ]
              ).map((t) => (
                <View key={t} style={styles.punto}>
                  <Ionicons name="close-circle" size={16} color={colors.danger} />
                  <Text style={styles.puntoTexto}>{t}</Text>
                </View>
              ))}
            </Card>
            {esEntrenador ? (
              <Card style={[styles.tarjeta, styles.aviso]}>
                <Text style={styles.avisoTitulo}>Tus alumnos</Text>
                <Text style={styles.parrafo}>
                  Sus cuentas y su historial NO se borran, pero se quedan sin entrenador y
                  tendrán que vincularse a otro con un código nuevo. Avísales antes: para
                  ellos esto llega sin previo aviso.
                </Text>
              </Card>
            ) : null}
            <Button title="Lo entiendo, seguir" variant="danger" onPress={() => setPaso(1)} />
            <Button title="Mejor no" variant="ghost" onPress={salir} />
          </>
        ) : null}

        {paso === 1 ? (
          <>
            <Text style={styles.titulo}>¿Seguro que es esto lo que quieres?</Text>
            <Text style={styles.parrafo}>
              Casi siempre hay una opción menos definitiva. Si vuelves dentro de un año, tu
              historial seguirá donde lo dejaste... salvo que lo borres hoy.
            </Text>
            <Card style={styles.tarjeta}>
              <Opcion
                icono="log-out-outline"
                titulo="Solo quiero salir de la app"
                texto="Cierra sesión y ya está. Tus datos te esperan."
              />
              {esEntrenador ? (
                <Opcion
                  icono="people-outline"
                  titulo="No quiero seguir con un alumno"
                  texto="Puedes sacarlo de tu grupo desde su ficha, sin tocar tu cuenta."
                />
              ) : (
                <Opcion
                  icono="swap-horizontal-outline"
                  titulo="Quiero cambiar de entrenador"
                  texto="Pídele que te saque de su grupo y entra en otro con su código."
                />
              )}
              <Opcion
                icono="notifications-off-outline"
                titulo="Recibo demasiados avisos"
                texto="Se apagan uno a uno desde tu perfil."
              />
            </Card>
            <Button title="Cerrar sesión y quedarme" onPress={signOut} />
            <Button
              title="Quiero eliminar mi cuenta igualmente"
              variant="ghost"
              onPress={() => setPaso(2)}
            />
          </>
        ) : null}

        {paso === 2 ? (
          <>
            <Text style={styles.titulo}>¿Por qué te vas?</Text>
            <Text style={styles.parrafo}>
              Nos ayuda a no repetir el mismo error con el siguiente. Puedes saltártelo.
            </Text>
            <View style={styles.motivos}>
              {MOTIVOS.map((m) => {
                const on = motivo === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMotivo(on ? null : m)}
                    style={[styles.motivo, on && styles.motivoOn]}
                  >
                    <Ionicons
                      name={on ? 'radio-button-on' : 'radio-button-off'}
                      size={17}
                      color={on ? colors.primary : colors.textFaint}
                    />
                    <Text style={[styles.motivoTexto, on && styles.motivoTextoOn]}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button title="Continuar" variant="danger" onPress={() => setPaso(3)} />
            <Button title="Volver atrás" variant="ghost" onPress={() => setPaso(1)} />
          </>
        ) : null}

        {paso === 3 ? (
          <>
            <Text style={styles.titulo}>Escríbelo con tus manos</Text>
            <Text style={styles.parrafo}>
              Para que no pase por un toque sin querer, escribe exactamente:
            </Text>
            <Text style={styles.palabraClave}>{PALABRA}</Text>
            <TextField
              placeholder={t(PALABRA)}
              value={palabra}
              onChangeText={setPalabra}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Card style={[styles.tarjeta, styles.aviso]}>
              <Text style={styles.avisoTitulo}>Lo que no se borra al instante</Text>
              {RESTOS_TRAS_BORRAR.map((t) => (
                <View key={t} style={styles.punto}>
                  <Ionicons name="ellipse-outline" size={13} color={colors.textFaint} />
                  <Text style={styles.puntoTexto}>{t}</Text>
                </View>
              ))}
              <Text style={styles.parrafoFino}>
                Nada de eso lleva tu nombre ni tu correo una vez desaparece tu perfil. Si
                quieres que se borre también, escríbenos a {CONTACT_EMAIL} y lo hacemos a
                mano en un máximo de 30 días.
              </Text>
            </Card>
            <Button
              title="Continuar"
              variant="danger"
              disabled={!esLaPalabra(palabra, PALABRA)}
              onPress={() => setPaso(4)}
            />
            <Button title="Volver atrás" variant="ghost" onPress={() => setPaso(2)} />
          </>
        ) : null}

        {paso === 4 ? (
          <>
            <Text style={styles.titulo}>Último paso</Text>
            <Text style={styles.parrafo}>
              Confirma que eres tú con tu contraseña. Al pulsar el botón, tu cuenta y tus
              datos se borran inmediatamente.
            </Text>
            <TextField
              placeholder="Tu contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {avance ? <Text style={styles.avance}>{avance}</Text> : null}
            <Button
              title={
                segundos > 0
                  ? `Espera ${segundos} s...`
                  : borrando
                    ? 'Borrando...'
                    : 'Eliminar mi cuenta para siempre'
              }
              variant="danger"
              disabled={segundos > 0 || password.length === 0 || borrando}
              loading={borrando}
              onPress={borrar}
            />
            <Text style={styles.parrafoFino}>
              La espera está para darte veinte segundos de arrepentimiento. Todavía puedes
              volver atrás.
            </Text>
            <Button
              title="No, quiero conservar mi cuenta"
              variant="ghost"
              onPress={salir}
              disabled={borrando}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Opcion({
  icono,
  titulo,
  texto,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto: string;
}) {
  return (
    <View style={styles.opcion}>
      <Ionicons name={icono} size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.opcionTitulo}>{titulo}</Text>
        <Text style={styles.opcionTexto}>{texto}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  volver: { flexDirection: 'row', alignItems: 'center' },
  volverTexto: { ...typography.body, color: colors.textMuted },
  pasoTexto: { ...typography.small, color: colors.textFaint },
  progreso: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  tramo: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceAlt },
  tramoHecho: { backgroundColor: colors.danger },
  cuerpo: {
    padding: spacing.lg,
    gap: spacing.sm,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  titulo: { ...typography.h1, color: colors.text, marginTop: spacing.md },
  parrafo: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  parrafoFino: { ...typography.small, color: colors.textFaint, lineHeight: 18, marginTop: spacing.sm },
  tarjeta: { marginVertical: spacing.sm },
  aviso: { borderColor: colors.warningMuted, borderWidth: 1 },
  avisoTitulo: {
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.semiBold,
    marginBottom: spacing.xs,
  },
  punto: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 4 },
  puntoTexto: { ...typography.small, color: colors.textMuted, flex: 1, lineHeight: 19 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  opcionTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  opcionTexto: { ...typography.small, color: colors.textMuted, marginTop: 1, lineHeight: 18 },
  motivos: { gap: 6, marginVertical: spacing.sm },
  motivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  motivoOn: { borderColor: colors.hairline },
  motivoTexto: { ...typography.body, color: colors.textMuted },
  motivoTextoOn: { color: colors.text },
  palabraClave: {
    ...typography.h3,
    color: colors.danger,
    fontFamily: fonts.heading,
    letterSpacing: 1,
    marginVertical: spacing.sm,
  },
  error: { ...typography.small, color: colors.danger, marginTop: spacing.xs },
  avance: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
});
