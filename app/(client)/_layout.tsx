import React, { useEffect, useRef, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, View } from 'react-native';
import { markPresence } from '../../lib/presence';
import { TabIcon } from '../../components/TabIcon';
import { GlobalRestTimer } from '../../components/GlobalRestTimer';
import { LinkTrainerScreen } from '../../components/LinkTrainerScreen';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Onboarding } from '../../components/Onboarding';
import { CuentaRetiradaScreen } from '../../components/CuentaRetiradaScreen';
import { ClientLockScreen } from '../../components/ClientLockScreen';
import { VerifyEmailScreen } from '../../components/VerifyEmailScreen';
import { useAuth } from '../../lib/auth-context';
import { clientIsLocked } from '../../lib/subscription';
import { markOnboardingComplete } from '../../lib/firestore/sync';
import { updateUserProfile } from '../../lib/firestore/users';
import { getPublishedCourses } from '../../lib/firestore/courses';
import { getSocialLeaderboard } from '../../lib/firestore/social';
import { cursosParaMi, esVip } from '../../lib/vip';
import { useTabScreenOptions } from '../../lib/navTheme';
import { t, useT  } from '../../lib/idioma';

const onboardingKey = (uid: string) => `udeca-onboarding-${uid}`;
const pestanasKey = (uid: string) => `udeca-pestanas-${uid}`;

/** Qué pestañas tienen algo dentro. `null` mientras no se sabe: se enseñan. */
interface PestanasConAlgo {
  cursos: boolean;
  social: boolean;
}

export default function ClientLayout() {
  const { loading, firebaseUser, profile, emailVerified, refreshProfile } = useAuth();
  // Antes de los `return` de abajo: un hook no puede quedarse sin llamar.
  const tabOptions = useTabScreenOptions();
  const t = useT();
  // null = comprobando; true = ya visto; false = mostrar bienvenida.
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  // Una vez terminado en esta sesión, no dejamos que un refresco del perfil lo
  // vuelva a evaluar (evita que el botón "Guardar y empezar" parezca no hacer nada).
  const doneRef = useRef(false);

  // Presencia "en línea" para el coach: latido al abrir y al volver a la app,
  // más un tic periódico mientras está abierta (limitado dentro de markPresence).
  useEffect(() => {
    if (!profile || profile.role !== 'client') return;
    markPresence(profile);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') markPresence(profile);
    });
    const tick = setInterval(() => markPresence(profile), 4 * 60 * 1000 + 500);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
  }, [profile]);

  /*
   * LAS PESTAÑAS VACÍAS NO SE ENSEÑAN.
   *
   * "Cursos" sin cursos y "Social" sin compañeros eran dos de las cinco
   * pestañas llevando a una pantalla que dice "aún no hay nada". Se miran al
   * entrar y al volver a la app (así aparecen en cuanto el entrenador publica
   * un curso o llega un compañero), y lo último que se supo se guarda para que
   * al abrir no salgan y se vayan. Si la consulta falla, se enseñan: esconder
   * algo que sí existe es peor que enseñar algo vacío.
   */
  const [pestanas, setPestanas] = useState<PestanasConAlgo | null>(null);
  const uid = profile?.uid;
  const trainerId = profile?.trainerId;
  const vip = esVip(profile);
  useEffect(() => {
    if (!uid || !trainerId) return;
    let vivo = true;
    let mirado = false;
    AsyncStorage.getItem(pestanasKey(uid))
      .then((v) => {
        if (vivo && !mirado && v) setPestanas(JSON.parse(v) as PestanasConAlgo);
      })
      .catch(() => {});
    const mirar = () =>
      Promise.all([
        getPublishedCourses(trainerId)
          .then((cs) => cursosParaMi(cs, vip).length > 0)
          .catch(() => true),
        getSocialLeaderboard(trainerId)
          .then((filas) => filas.some((f) => f.uid !== uid))
          .catch(() => true),
      ]).then(([cursos, social]) => {
        if (!vivo) return;
        mirado = true;
        const nuevas = { cursos, social };
        setPestanas(nuevas);
        AsyncStorage.setItem(pestanasKey(uid), JSON.stringify(nuevas)).catch(() => {});
      });
    mirar();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') mirar();
    });
    return () => {
      vivo = false;
      sub.remove();
    };
  }, [uid, trainerId, vip]);

  useEffect(() => {
    if (!profile || doneRef.current) return;
    // La cuenta manda: si ya se completó en cualquier dispositivo, no se repite.
    if (profile.onboardingCompleted) {
      setOnboardingSeen(true);
      return;
    }
    AsyncStorage.getItem(onboardingKey(profile.uid))
      .then((v) => {
        if (v === '1') {
          setOnboardingSeen(true);
          // Este dispositivo ya lo vio: propágalo a la cuenta para el resto.
          markOnboardingComplete(profile.uid).catch(() => {});
        } else {
          setOnboardingSeen(false);
        }
      })
      .catch(() => setOnboardingSeen(true));
  }, [profile]);

  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role === 'trainer') return <Redirect href="/(trainer)/dashboard" />;
  // Un tipo de cuenta que ya no existe (el atleta que se entrenaba solo): ni
  // aquí ni en el grupo del entrenador, que lo devolvería aquí en bucle.
  if (profile.role !== 'client') return <CuentaRetiradaScreen />;
  // Correo sin verificar (cuentas que lo requieren): bloquea hasta verificar.
  if (profile.emailVerificationRequired && !emailVerified) return <VerifyEmailScreen />;
  // Se le acabó el periodo de coaching hace más de los días de margen: la app
  // en pausa hasta que su entrenador lo renueve (ver lib/coaching.ts). Sin
  // fecha de fin no se pausa nunca.
  if (clientIsLocked(profile)) return <ClientLockScreen />;
  // Alumno sin entrenador: pantalla para enviar/esperar la solicitud.
  if (!profile.trainerId) return <LinkTrainerScreen />;
  // Bienvenida de primer uso (una vez por dispositivo).
  if (onboardingSeen === null) return <LoadingScreen />;
  if (!onboardingSeen) {
    return (
      <Onboarding
        name={profile.name}
        onDone={(targets, goal, mainGoal) => {
          doneRef.current = true;
          setOnboardingSeen(true);
          AsyncStorage.setItem(onboardingKey(profile.uid), '1').catch(() => {});
          markOnboardingComplete(profile.uid).catch(() => {});
          // Guardamos lo que el alumno haya definido: sus macros (si los calculó)
          // y su objetivo principal (editable luego desde el perfil).
          const updates: Parameters<typeof updateUserProfile>[1] = {};
          if (targets) updates.nutritionTargets = { ...targets, goal, updatedAt: Date.now() };
          if (mainGoal) updates.goal = mainGoal;
          if (Object.keys(updates).length > 0) {
            updateUserProfile(profile.uid, updates)
              .then(() => refreshProfile())
              .catch(() => {});
          }
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={tabOptions}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('Inicio'),
          tabBarIcon: (props) => <TabIcon {...props} outline="home-outline" filled="home" />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: t('Entreno'),
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="barbell-outline" filled="barbell" />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          href: pestanas?.cursos === false ? null : undefined,
          title: t('Cursos'),
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="school-outline" filled="school" />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('Progreso'),
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="trending-up-outline" filled="trending-up" />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          href: pestanas?.social === false ? null : undefined,
          title: t('Social'),
          tabBarIcon: (props) => <TabIcon {...props} outline="people-outline" filled="people" />,
        }}
      />
      {/* El perfil se abre tocando el avatar en Inicio; lo ocultamos de la
          barra para no saturarla con demasiadas pestañas. */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      {/* Registrar un entreno de otro día (se abre desde Entreno y Progreso). */}
      <Tabs.Screen name="registrar" options={{ href: null }} />
    </Tabs>
    {/* Crono de descanso global: sigue corriendo y visible en cualquier pestaña. */}
    <GlobalRestTimer />
    </View>
  );
}
