import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { MemberCard } from '../../components/MemberCard';
import { SelectorDeIdioma } from '../../components/SelectorDeIdioma';
import { ScreenContainer } from '../../components/ScreenContainer';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { updateUserProfile } from '../../lib/firestore/users';
import { pickAvatar } from '../../lib/image';
import { isAdmin } from '../../lib/subscription';
import { getRecentErrorLogs, groupErrors, type ErrorGroup } from '../../lib/firestore/errorLogs';
import { fechaCorta } from '../../lib/fechas';
import { colors, fonts, spacing, typography } from '../../lib/theme';

export default function TrainerProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Errores reales de los alumnos (solo la cuenta de administración).
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [errorGroups, setErrorGroups] = useState<ErrorGroup[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const admin = isAdmin(profile);

  const openErrors = async () => {
    setErrorsOpen(true);
    setLoadingErrors(true);
    try {
      setErrorGroups(groupErrors(await getRecentErrorLogs()));
    } catch {
      showToast('No se pudieron cargar los errores');
    } finally {
      setLoadingErrors(false);
    }
  };

  const handleChangePhoto = async () => {
    if (!profile) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await pickAvatar();
      if (dataUrl) {
        await updateUserProfile(profile.uid, { photoURL: dataUrl });
        await refreshProfile();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo actualizar la foto.';
      if (Platform.OS !== 'web') Alert.alert('Foto de perfil', message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleShare = async () => {
    // Sin código: quien se registra le manda la solicitud a Luis directamente
    // (lib/coachUnico.ts). Al alumno se le manda donde puede registrarse, no
    // a la web de presentación.
    const message =
      `Te espero en Mastery.\n\n` +
      `1) Entra en app.udeca.app y añádela a tu pantalla de inicio.\n` +
      `2) Crea tu cuenta: me llega tu solicitud y te acepto.\n\n` +
      `¡Nos vemos dentro!`;
    if (Platform.OS === 'web') {
      // Usa el diálogo nativo de compartir del navegador si existe; si no, copia.
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) {
        try {
          await nav.share({ text: message });
          return;
        } catch {
          // cancelado o no soportado: caemos a copiar
        }
      }
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silently ignore clipboard failures (e.g. insecure context).
      }
    } else {
      await Share.share({ message });
    }
  };

  return (
    <ScreenContainer>
      <Pressable
        onPress={() => router.push('/(trainer)/dashboard')}
        style={styles.backBtn}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>

      <View style={styles.hero}>
        <Pressable onPress={handleChangePhoto} style={styles.avatarWrap}>
          <Avatar name={profile?.name} photoURL={profile?.photoURL} size={104} />
          <View style={styles.cameraBadge}>
            <Ionicons
              name={uploadingPhoto ? 'hourglass' : 'camera'}
              size={15}
              color={colors.onPrimary}
            />
          </View>
        </Pressable>
        {/* Ni el nombre ni el distintivo de "Entrenador" salen aquí: los dos
            van impresos dentro de la tarjeta, dos centímetros más abajo. El
            nombre estaba escrito dos veces en la misma pantalla y a la misma
            altura de un dedo. Queda el correo, que es lo único que esto
            responde de verdad: en qué cuenta estoy. */}
        <Text style={styles.email}>{profile?.email}</Text>
      </View>

      {/* El carné: quién es dentro de Mastery. */}
      <MemberCard />

      <SelectorDeIdioma />

      {/* Cómo entra un alumno nuevo: sin código. Se registra, la solicitud
          llega a Inicio y se acepta desde allí. Aquí solo queda mandarle la
          invitación. */}
      <CollapsibleCard
        id="coach-invitacion"
        icon="person-add-outline"
        title="Invitar a un alumno"
        defaultOpen={false}
      >
        <Text style={styles.helperText}>
          Entra en app.udeca.app y crea su cuenta. Su solicitud te llega a Inicio y entra cuando la
          aceptas.
        </Text>
        <Button
          title={copied ? 'Copiado' : Platform.OS === 'web' ? 'Copiar invitación' : 'Compartir invitación'}
          variant="secondary"
          onPress={handleShare}
        />
      </CollapsibleCard>

      {admin ? (
        <Card accent style={styles.section}>
          <View style={styles.subHeader}>
            <Text style={styles.sectionTitle}>Errores de la app</Text>
            <Pressable onPress={errorsOpen ? () => setErrorsOpen(false) : openErrors} hitSlop={8}>
              <Ionicons
                name={errorsOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
          {!errorsOpen ? (
            <Text style={styles.helperText}>
              Qué se ha roto de verdad en el móvil de la gente, agrupado por fallo.
            </Text>
          ) : loadingErrors ? (
            <Text style={styles.helperText}>Cargando errores...</Text>
          ) : errorGroups.length === 0 ? (
            <Text style={styles.helperText}>
              Ningún error registrado. Buena señal.
            </Text>
          ) : (
            errorGroups.map((g) => (
              <View key={g.message} style={styles.errCard}>
                <Text style={styles.errMsg}>{g.message}</Text>
                <Text style={styles.errMeta}>
                  {g.count}× · {g.affected} usuario(s) · {g.platforms.join(', ')}
                  {g.where ? ` · ${g.where}` : ''}
                </Text>
                <Text style={styles.errMeta}>
                  Última vez: {fechaCorta(g.lastAt)} · versión {g.sample.appVersion ?? '—'}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}


      {/* Sin el rojo de lo peligroso: cerrar sesión no borra nada. */}
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} style={{ marginTop: spacing.lg }} />

      {/* Ver el comentario del mismo botón en el perfil del alumno. */}
      <Pressable onPress={() => router.push('/account-deletion')} style={styles.borrarCuenta}>
        <Text style={styles.borrarCuentaTexto}>Eliminar mi cuenta</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  borrarCuenta: { alignSelf: 'center', paddingVertical: spacing.lg },
  borrarCuentaTexto: { ...typography.small, color: colors.textFaint, textDecorationLine: 'underline' },
  backBtn: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  avatarWrap: { marginBottom: spacing.md },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  email: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  errCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  errMsg: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  errMeta: { ...typography.small, color: colors.textMuted, fontSize: 11, marginTop: 2 },
  // Con "flexWrap": en pantalla estrecha los botones bajan a la línea
  // siguiente en vez de salirse o comerse los iconos de revocar y borrar.
  helperText: { ...typography.small, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
});
