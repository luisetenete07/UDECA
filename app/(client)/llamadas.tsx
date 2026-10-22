import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/Texto';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Dialogo } from '../../components/Dialogo';
import { EmptyState } from '../../components/EmptyState';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ListSkeleton } from '../../components/Skeleton';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { diaDeLaSemana, diaLargo, horaCorta, nombreDelMes } from '../../lib/fechas';
import { frase, t } from '../../lib/idioma';
import { cancelarAvisoDeLlamada, notifyUser, programarAvisoDeLlamada } from '../../lib/notifications';
import {
  cancelarLlamada,
  getAjustesLlamadas,
  getLlamadasDelAlumno,
  getLlamadasEntre,
  reservarLlamada,
} from '../../lib/firestore/llamadas';
import {
  COMO_SE_HACE,
  delMes,
  huecosLibres,
  loQueTiene,
  proximas,
  puedeCancelar,
  puedeReservar,
  TEXTO_POR_QUE_NO,
  type AjustesLlamadas,
  type Llamada,
} from '../../lib/llamadas';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../../lib/theme';

/**
 * RESERVAR UNA LLAMADA CON TU ENTRENADOR.
 *
 * Arriba, lo que ya tiene reservado (con cómo será la llamada y, si se puede,
 * cancelar). Debajo, los días con huecos libres y, al tocar uno, sus horas.
 * Una hora, un toque, confirmar: sin mensajes para cuadrar agendas.
 *
 * Lo que puede reservar lo decide su plan (cuántas al mes y con cuánta
 * antelación, ver lib/llamadas.ts), y se le dice arriba con cuántas le quedan.
 */
export default function ReservarLlamada() {
  const { profile } = useAuth();
  const router = useRouter();
  const trainerId = profile?.trainerId;
  const [cargando, setCargando] = useState(true);
  const [ajustes, setAjustes] = useState<AjustesLlamadas | null>(null);
  const [mias, setMias] = useState<Llamada[]>([]);
  const [ocupadas, setOcupadas] = useState<Llamada[]>([]);
  const [dia, setDia] = useState<number | null>(null);
  const [elegida, setElegida] = useState<number | null>(null);
  const [reservando, setReservando] = useState(false);
  const [aCancelar, setACancelar] = useState<Llamada | null>(null);

  const cargar = useCallback(async () => {
    if (!profile || !trainerId) {
      setCargando(false);
      return;
    }
    const a = await getAjustesLlamadas(trainerId);
    const suyo = loQueTiene(a, profile.planId);
    const ahora = Date.now();
    const [mis, todas] = await Promise.all([
      getLlamadasDelAlumno(profile.uid, trainerId).catch(() => []),
      getLlamadasEntre(trainerId, ahora - 4 * 3600000, ahora + (suyo.antelacionDias + 1) * 86400000).catch(() => []),
    ]);
    setAjustes(a);
    setMias(mis);
    setOcupadas(todas);
    setCargando(false);
  }, [profile, trainerId]);

  useFocusEffect(
    useCallback(() => {
      cargar().catch(() => setCargando(false));
    }, [cargar])
  );

  const suyo = ajustes ? loQueTiene(ajustes, profile?.planId) : null;
  const dias = useMemo(
    () => (ajustes && suyo ? huecosLibres(ajustes, suyo.antelacionDias, ocupadas) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ajustes, ocupadas, suyo?.antelacionDias]
  );
  const diaElegido = dias.find((d) => d.dia === dia) ?? dias[0] ?? null;

  if (cargando) {
    return (
      <ScreenContainer>
        <ListSkeleton rows={5} />
      </ScreenContainer>
    );
  }

  const volver = (
    <Pressable onPress={() => router.push('/(client)/dashboard')} style={styles.atras} hitSlop={8}>
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );

  if (!ajustes || !suyo || !trainerId) {
    return (
      <ScreenContainer>
        {volver}
        <EmptyState icon="call-outline" title="Sin entrenador" subtitle="Cuando entrenes con alguien, podrás reservar llamadas con él aquí." />
      </ScreenContainer>
    );
  }

  const misProximas = proximas(mias);
  const ahora = Date.now();
  const quedanEsteMes = Math.max(0, suyo.llamadasAlMes - delMes(mias, ahora));
  const cerradas = !ajustes.activas || suyo.llamadasAlMes <= 0;

  const reservar = async () => {
    if (!profile || elegida === null) return;
    const check = puedeReservar({ ajustes, planId: profile.planId, mias, ocupadas, inicio: elegida });
    if (!check.ok) {
      showToast(TEXTO_POR_QUE_NO[check.porque]);
      setElegida(null);
      return;
    }
    setReservando(true);
    try {
      const l = await reservarLlamada({
        trainerId,
        clientId: profile.uid,
        inicio: elegida,
        fin: elegida + ajustes.duracionMin * 60000,
      });
      setMias((prev) => [...prev, l]);
      setOcupadas((prev) => [...prev, l]);
      programarAvisoDeLlamada(l.id, l.inicio, COMO_SE_HACE[ajustes.como]).catch(() => {});
      notifyUser(
        trainerId,
        'Nueva llamada reservada',
        frase`${profile.name.split(' ')[0]} ha reservado una llamada el ${diaLargo(l.inicio)} a las ${horaCorta(l.inicio)}.`
      ).catch(() => {});
      showToast('Llamada reservada');
    } catch (e) {
      showToast(
        e instanceof Error && e.message === 'ocupada' ? TEXTO_POR_QUE_NO.ocupada : 'No se pudo reservar'
      );
      cargar().catch(() => {});
    } finally {
      setReservando(false);
      setElegida(null);
    }
  };

  const cancelar = async () => {
    const l = aCancelar;
    if (!l || !profile) return;
    setACancelar(null);
    setMias((prev) => prev.filter((x) => x.id !== l.id));
    setOcupadas((prev) => prev.filter((x) => x.id !== l.id));
    try {
      await cancelarLlamada(l.id, l);
      cancelarAvisoDeLlamada(l.id).catch(() => {});
      notifyUser(
        trainerId,
        'Llamada cancelada',
        frase`${profile.name.split(' ')[0]} ha cancelado la llamada del ${diaLargo(l.inicio)} a las ${horaCorta(l.inicio)}.`
      ).catch(() => {});
      showToast('Llamada cancelada');
    } catch {
      showToast('No se pudo cancelar');
      cargar().catch(() => {});
    }
  };

  return (
    <ScreenContainer maxWidth={620}>
      {volver}
      <Text style={styles.titulo}>Llamada con tu entrenador</Text>
      <Text style={styles.subtitulo}>
        {suyo.llamadasAlMes > 0
          ? `${suyo.plan ? frase`Tu plan ${suyo.plan.nombre}: ` : ''}${frase`${suyo.llamadasAlMes} al mes`} · ${
              quedanEsteMes === 1 ? t('te queda 1 este mes') : frase`te quedan ${quedanEsteMes} este mes`
            }.`
          : 'Tu plan no incluye llamadas por ahora.'}
      </Text>

      {/* LO RESERVADO, primero: es lo que se viene a mirar después. */}
      {misProximas.map((l) => (
        <Card key={l.id} accent style={styles.reservada}>
          <View style={styles.reservadaCab}>
            <View style={styles.reservadaIcono}>
              <Ionicons name="call" size={17} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reservadaDia}>{diaLargo(l.inicio)}</Text>
              <Text style={styles.reservadaHora}>{`${horaCorta(l.inicio)} – ${horaCorta(l.fin)}`}</Text>
            </View>
          </View>
          <Text style={styles.como}>{COMO_SE_HACE[ajustes.como]}</Text>
          {ajustes.como === 'enlace' && ajustes.enlace ? (
            <Button
              title="Entrar a la llamada"
              variant="secondary"
              compacto
              onPress={() => Linking.openURL(ajustes.enlace!).catch(() => {})}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
          {puedeCancelar(l, ajustes) ? (
            <Pressable onPress={() => setACancelar(l)} hitSlop={8} style={styles.cancelar}>
              <Text style={styles.cancelarTexto}>Cancelar la llamada</Text>
            </Pressable>
          ) : (
            <Text style={styles.noCancelar}>
              {frase`Se puede cancelar hasta ${ajustes.cancelarHastaHoras} h antes.`}
            </Text>
          )}
        </Card>
      ))}

      {cerradas ? (
        <Card style={styles.seccion}>
          <Text style={styles.vacio}>
            {!ajustes.activas ? TEXTO_POR_QUE_NO.apagadas : TEXTO_POR_QUE_NO['sin-llamadas']}
          </Text>
        </Card>
      ) : dias.length === 0 ? (
        <Card style={styles.seccion}>
          <Text style={styles.vacio}>No quedan huecos libres en los próximos días. Vuelve a mirar pronto.</Text>
        </Card>
      ) : (
        <Card style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Reservar</Text>
          {/* Los días con algo libre, deslizando; al tocar uno, sus horas. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dias}>
            {dias.map((d) => {
              const sel = diaElegido?.dia === d.dia;
              return (
                <Pressable key={d.dia} onPress={() => setDia(d.dia)} style={[styles.diaChip, sel && styles.diaChipSel]}>
                  <Text style={[styles.diaChipSemana, sel && styles.diaChipTextoSel]}>{diaDeLaSemana(d.dia)}</Text>
                  <Text style={[styles.diaChipNum, sel && styles.diaChipTextoSel]}>{new Date(d.dia).getDate()}</Text>
                  <Text style={[styles.diaChipCuantos, sel && styles.diaChipTextoSel]}>{d.huecos.length}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {diaElegido ? (
            <>
              <Text style={styles.diaLargo}>{diaLargo(diaElegido.dia)}</Text>
              {delMes(mias, diaElegido.dia) >= suyo.llamadasAlMes ? (
                <Text style={styles.sinCupo}>
                  {frase`Ya has reservado tus ${suyo.llamadasAlMes} llamadas de ${nombreDelMes(diaElegido.dia)}.`}
                </Text>
              ) : (
                <View style={styles.horas}>
                  {diaElegido.huecos.map((h) => (
                    <Pressable key={h} onPress={() => setElegida(h)} style={styles.hora}>
                      <Text style={styles.horaTexto}>{horaCorta(h)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : null}
          <Text style={styles.pie}>
            {frase`Llamadas de ${ajustes.duracionMin} min. ${t(COMO_SE_HACE[ajustes.como])}.`}
          </Text>
        </Card>
      )}

      <Dialogo
        visible={elegida !== null}
        onClose={() => setElegida(null)}
        icono="call-outline"
        tono="normal"
        titulo="¿Reservar esta llamada?"
        texto={
          elegida !== null
            ? frase`${diaLargo(elegida)} a las ${horaCorta(elegida)} (${ajustes.duracionMin} min). Te avisamos una hora antes.`
            : ''
        }
        accion="Reservar"
        onAccion={reservar}
        cargando={reservando}
      />
      <Dialogo
        visible={!!aCancelar}
        onClose={() => setACancelar(null)}
        icono="call-outline"
        titulo="¿Cancelar la llamada?"
        texto={
          aCancelar
            ? frase`La del ${diaLargo(aCancelar.inicio)} a las ${horaCorta(aCancelar.inicio)}. Se le avisa a tu entrenador y recuperas la llamada para reservar otra.`
            : ''
        }
        accion="Sí, cancelarla"
        onAccion={cancelar}
        cancelar="No"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  atras: {
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
  titulo: { ...typography.h1, color: colors.text },
  subtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md, lineHeight: 18 },
  seccion: { marginBottom: spacing.md },
  seccionTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, marginBottom: spacing.sm },
  vacio: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  reservada: { marginBottom: spacing.md },
  reservadaCab: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  reservadaIcono: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successMuted,
  },
  reservadaDia: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  reservadaHora: { ...typography.h3, color: colors.primaryBright, ...tabularNums },
  como: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  cancelar: { alignSelf: 'flex-start', marginTop: spacing.sm },
  cancelarTexto: { ...typography.small, color: colors.textFaint, textDecorationLine: 'underline' },
  noCancelar: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm, fontSize: 12 },
  dias: { gap: spacing.sm, paddingBottom: spacing.xs },
  diaChip: {
    width: 56,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  diaChipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  diaChipSemana: { ...typography.small, color: colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  diaChipNum: { ...typography.h3, color: colors.text, ...tabularNums },
  diaChipCuantos: { ...typography.small, color: colors.textFaint, fontSize: 10 },
  diaChipTextoSel: { color: colors.onPrimary },
  diaLargo: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, marginTop: spacing.md },
  sinCupo: { ...typography.small, color: colors.warning, marginTop: spacing.sm },
  horas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  hora: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  horaTexto: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, ...tabularNums },
  pie: { ...typography.small, color: colors.textFaint, marginTop: spacing.md, fontSize: 12 },
});
