import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/Texto';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip, ChipRow } from '../../components/Chip';
import { Dialogo } from '../../components/Dialogo';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { Avatar } from '../../components/Avatar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ListSkeleton } from '../../components/Skeleton';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { diaLargo, horaCorta, inicioDelDia, masDias, zonaDelDispositivo } from '../../lib/fechas';
import { frase, t } from '../../lib/idioma';
import { notifyUser } from '../../lib/notifications';
import { getClientsForTrainer } from '../../lib/firestore/users';
import {
  cancelarLlamada,
  getAjustesLlamadas,
  getLlamadasEntre,
  guardarAjustesLlamadas,
  setPlanDelAlumno,
} from '../../lib/firestore/llamadas';
import {
  DURACIONES,
  franjaValida,
  huecosLibres,
  INICIAL_DEL_DIA,
  MARGENES_HORAS,
  minutosDe,
  NOMBRE_DEL_DIA,
  normalizarHora,
  nuevoIdDePlan,
  proximas,
  type AjustesLlamadas,
  type ComoEsLaLlamada,
  type Franja,
  type Llamada,
  type PlanDelCoach,
} from '../../lib/llamadas';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../../lib/theme';
import type { UserProfile } from '../../lib/types';

const ANTELACIONES = [7, 14, 21, 30, 60];

/**
 * LLAMADAS 1:1: LO QUE DECIDE EL ENTRENADOR.
 *
 * Arriba, lo que ya está reservado (que es lo que se viene a mirar casi
 * siempre). Debajo, de una vez y para siempre: cuándo está disponible, cuánto
 * dura cada llamada, cómo se hace, y los planes de sus alumnos con lo que
 * incluye cada uno, por prioridad.
 *
 * Los cambios se guardan con un botón que solo aparece si hay algo que
 * guardar: una pantalla de ajustes que guarda sola a cada tecla deja al
 * entrenador sin saber si lo de ahora ya cuenta.
 */
export default function LlamadasDelCoach() {
  const { profile } = useAuth();
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [guardado, setGuardado] = useState<AjustesLlamadas | null>(null);
  const [a, setA] = useState<AjustesLlamadas | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [alumnos, setAlumnos] = useState<UserProfile[]>([]);
  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  // Añadir una franja: en qué día está abierto el formulario y lo escrito.
  const [anadiendo, setAnadiendo] = useState<number | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [aCancelar, setACancelar] = useState<Llamada | null>(null);
  const [planABorrar, setPlanABorrar] = useState<PlanDelCoach | null>(null);

  const cargar = useCallback(async () => {
    if (!profile) return;
    const hoy = inicioDelDia(Date.now());
    const [ajustes, lista, gente] = await Promise.all([
      getAjustesLlamadas(profile.uid),
      getLlamadasEntre(profile.uid, masDias(hoy, -1), masDias(hoy, 90)).catch(() => []),
      getClientsForTrainer(profile.uid).catch(() => []),
    ]);
    setGuardado(ajustes);
    setA(ajustes);
    setLlamadas(lista);
    setAlumnos(gente);
    setCargando(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      cargar().catch(() => setCargando(false));
    }, [cargar])
  );

  const cambiado = useMemo(() => JSON.stringify(a) !== JSON.stringify(guardado), [a, guardado]);
  const cambia = (parte: Partial<AjustesLlamadas>) => setA((prev) => (prev ? { ...prev, ...parte } : prev));
  const cambiaPlan = (id: string, parte: Partial<PlanDelCoach>) =>
    setA((prev) =>
      prev ? { ...prev, planes: prev.planes.map((p) => (p.id === id ? { ...p, ...parte } : p)) } : prev
    );

  const guardar = async () => {
    if (!a) return;
    if (a.como === 'enlace' && !/^https?:\/\//i.test(a.enlace?.trim() ?? '')) {
      showToast('Pon el enlace de la llamada (https://…)');
      return;
    }
    setGuardando(true);
    try {
      // La zona, la de quien guarda: las franjas están en su hora.
      const nuevo = { ...a, zona: zonaDelDispositivo(), enlace: a.enlace?.trim() || undefined };
      await guardarAjustesLlamadas(nuevo);
      // Lo que cambió en un plan llega a sus alumnos: el plan borrado los deja
      // sin plan, y si el plan pasa a incluir (o no) lo VIP, ellos también.
      const antes = new Map((guardado?.planes ?? []).map((p) => [p.id, p]));
      const tocados = alumnos.flatMap((x): UserProfile[] => {
        if (!x.planId) return [];
        const p = nuevo.planes.find((q) => q.id === x.planId);
        if (!p) return [{ ...x, planId: undefined }];
        return antes.get(p.id)?.vip !== p.vip ? [{ ...x, vip: p.vip }] : [];
      });
      await Promise.all(tocados.map((x) => setPlanDelAlumno(x.uid, x.planId ?? null, x.planId ? x.vip : undefined)));
      if (tocados.length) setAlumnos((prev) => prev.map((x) => tocados.find((y) => y.uid === x.uid) ?? x));
      setGuardado(nuevo);
      setA(nuevo);
      showToast('Llamadas guardadas');
    } catch {
      showToast('No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const anadirFranja = (dia: number) => {
    if (!a) return;
    const d = normalizarHora(desde);
    const h = normalizarHora(hasta);
    const f: Franja = { dia, desde: d ?? '', hasta: h ?? '' };
    if (!d || !h || !franjaValida(f, a.duracionMin)) {
      showToast(frase`Escribe la hora de inicio y de fin (que quepa una llamada de ${a.duracionMin} min)`);
      return;
    }
    const pisa = a.franjas.some(
      (x) => x.dia === dia && minutosDe(x.desde)! < minutosDe(h)! && minutosDe(x.hasta)! > minutosDe(d)!
    );
    if (pisa) {
      showToast('Se solapa con otra franja de ese día');
      return;
    }
    cambia({
      franjas: [...a.franjas, f].sort((x, y) => x.dia - y.dia || minutosDe(x.desde)! - minutosDe(y.desde)!),
    });
    setAnadiendo(null);
    setDesde('');
    setHasta('');
  };

  /** Lo del lunes, a los demás días laborables (el caso de casi todos). */
  const copiarLunesALaborables = () => {
    if (!a) return;
    const lunes = a.franjas.filter((f) => f.dia === 0);
    if (lunes.length === 0) {
      showToast('Pon primero el horario del lunes');
      return;
    }
    const resto = a.franjas.filter((f) => f.dia === 0 || f.dia > 4);
    const copias = [1, 2, 3, 4].flatMap((dia) => lunes.map((f) => ({ ...f, dia })));
    cambia({ franjas: [...resto, ...copias].sort((x, y) => x.dia - y.dia || minutosDe(x.desde)! - minutosDe(y.desde)!) });
    showToast('Copiado de martes a viernes');
  };

  const moverPlan = (i: number, j: number) => {
    if (!a || j < 0 || j >= a.planes.length) return;
    const planes = [...a.planes];
    const [p] = planes.splice(i, 1);
    planes.splice(j, 0, p);
    cambia({ planes });
  };

  const nuevoPlan = () => {
    if (!a) return;
    const p: PlanDelCoach = {
      id: nuevoIdDePlan(),
      nombre: a.planes.length === 0 ? 'Premium' : frase`Plan ${a.planes.length + 1}`,
      llamadasAlMes: 2,
      antelacionDias: 14,
      vip: false,
    };
    cambia({ planes: [...a.planes, p] });
  };

  const confirmarCancelar = async () => {
    const l = aCancelar;
    if (!l) return;
    setACancelar(null);
    setLlamadas((prev) => prev.filter((x) => x.id !== l.id));
    try {
      await cancelarLlamada(l.id);
      notifyUser(
        l.clientId,
        'Llamada cancelada',
        frase`Tu entrenador ha cancelado la llamada del ${diaLargo(l.inicio)} a las ${horaCorta(l.inicio)}. Puedes reservar otra.`
      ).catch(() => {});
      showToast('Llamada cancelada');
    } catch {
      setLlamadas((prev) => [...prev, l].sort((x, y) => x.inicio - y.inicio));
      showToast('No se pudo cancelar');
    }
  };

  if (cargando || !a) {
    return (
      <ScreenContainer>
        <ListSkeleton rows={6} />
      </ScreenContainer>
    );
  }

  const nombreDe = (uid: string) => alumnos.find((x) => x.uid === uid)?.name ?? 'Alumno';
  const planDe = (uid: string) => {
    const pid = alumnos.find((x) => x.uid === uid)?.planId;
    return a.planes.find((p) => p.id === pid) ?? null;
  };
  const cuantosConPlan = (id: string) => alumnos.filter((x) => x.planId === id).length;
  const lasProximas = proximas(llamadas).slice(0, 8);
  // Cuántas llamadas caben a la semana con este horario (para que se vea al momento).
  const porSemana = a.franjas.reduce((n, f) => {
    const d = minutosDe(f.desde);
    const h = minutosDe(f.hasta);
    return d === null || h === null ? n : n + Math.floor((h - d) / a.duracionMin);
  }, 0);
  // La agenda que verá el de mejor plan, para avisar si está vacía.
  const huecosAhora = huecosLibres(a, Math.max(a.sinPlan.antelacionDias, ...a.planes.map((p) => p.antelacionDias)), llamadas).reduce(
    (n, d) => n + d.huecos.length,
    0
  );

  return (
    <ScreenContainer maxWidth={720}>
      <Pressable onPress={() => router.push('/(trainer)/agenda')} style={styles.atras} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.titulo}>Llamadas 1:1</Text>
      <Text style={styles.subtitulo}>
        Tus alumnos reservan en tus huecos libres y te sale en el calendario. La llamada, por WhatsApp,
        teléfono o tu enlace.
      </Text>

      {/* ENCENDIDAS O NO: mientras se monta el horario, mejor apagadas. */}
      <Card style={styles.seccion}>
        <View style={styles.fila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.seccionTitulo}>Reservas abiertas</Text>
            <Text style={styles.ayuda}>
              {a.activas
                ? frase`Tus alumnos ven ${huecosAhora} huecos libres ahora mismo.`
                : 'Apagadas: tus alumnos no pueden reservar.'}
            </Text>
          </View>
          <Switch
            value={a.activas}
            onValueChange={(v) => cambia({ activas: v })}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      {/* LO RESERVADO: lo que se viene a mirar casi siempre. */}
      <Card style={styles.seccion}>
        <View style={styles.cab}>
          <Ionicons name="call-outline" size={16} color={colors.success} />
          <Text style={styles.seccionTitulo}>Próximas llamadas</Text>
        </View>
        {lasProximas.length === 0 ? (
          <Text style={styles.ayuda}>Aún no hay ninguna reservada.</Text>
        ) : (
          lasProximas.map((l) => {
            const plan = planDe(l.clientId);
            return (
              <View key={l.id} style={styles.llamada}>
                <Avatar name={nombreDe(l.clientId)} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.llamadaNombre} numberOfLines={1}>
                    {nombreDe(l.clientId)}
                    {plan ? <Text style={styles.llamadaPlan}>{`  ${plan.nombre}`}</Text> : null}
                  </Text>
                  <Text style={styles.llamadaHora}>
                    {`${diaLargo(l.inicio)} · ${horaCorta(l.inicio)} – ${horaCorta(l.fin)}`}
                  </Text>
                </View>
                <Pressable onPress={() => setACancelar(l)} hitSlop={8}>
                  <Text style={styles.cancelar}>Cancelar</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </Card>

      {/* CUÁNDO: franjas por día de la semana, en su hora. */}
      <Card style={styles.seccion}>
        <View style={styles.cab}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={styles.seccionTitulo}>Cuándo estás disponible</Text>
        </View>
        <Text style={styles.ayuda}>
          {porSemana > 0
            ? frase`${porSemana} llamadas de ${a.duracionMin} min a la semana.`
            : 'Añade tus franjas: los huecos se crean solos.'}
        </Text>
        {NOMBRE_DEL_DIA.map((nombre, dia) => {
          const delDia = a.franjas.filter((f) => f.dia === dia);
          return (
            <View key={dia} style={styles.dia}>
              <View style={styles.diaCab}>
                <View style={[styles.diaInicial, delDia.length > 0 && styles.diaInicialSi]}>
                  <Text style={[styles.diaInicialTexto, delDia.length > 0 && styles.diaInicialTextoSi]}>
                    {INICIAL_DEL_DIA[dia]}
                  </Text>
                </View>
                <Text style={[styles.diaNombre, delDia.length === 0 && styles.diaNombreVacio]}>{nombre}</Text>
                <Pressable
                  onPress={() => {
                    setAnadiendo(anadiendo === dia ? null : dia);
                    setDesde('');
                    setHasta('');
                  }}
                  hitSlop={8}
                  style={styles.anadirFranja}
                >
                  <Ionicons name={anadiendo === dia ? 'close' : 'add'} size={16} color={colors.primary} />
                  <Text style={styles.anadirTexto}>{anadiendo === dia ? 'Cerrar' : 'Franja'}</Text>
                </Pressable>
              </View>
              {delDia.length > 0 ? (
                <View style={styles.franjas}>
                  {delDia.map((f) => (
                    <Chip
                      key={`${f.desde}-${f.hasta}`}
                      texto={`${f.desde} – ${f.hasta}`}
                      compacto
                      accion="close-circle"
                      colorAccion={colors.textFaint}
                      onAccion={() => cambia({ franjas: a.franjas.filter((x) => x !== f) })}
                    />
                  ))}
                </View>
              ) : null}
              {anadiendo === dia ? (
                <View style={styles.nuevaFranja}>
                  <TextInput
                    value={desde}
                    onChangeText={setDesde}
                    placeholder="09:00"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="numbers-and-punctuation"
                    style={styles.hora}
                    maxLength={5}
                  />
                  <Text style={styles.guion}>a</Text>
                  <TextInput
                    value={hasta}
                    onChangeText={setHasta}
                    placeholder="13:00"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="numbers-and-punctuation"
                    style={styles.hora}
                    maxLength={5}
                    onSubmitEditing={() => anadirFranja(dia)}
                  />
                  <Button title="Añadir" compacto onPress={() => anadirFranja(dia)} style={{ flex: 1 }} />
                </View>
              ) : null}
            </View>
          );
        })}
        <Pressable onPress={copiarLunesALaborables} hitSlop={6} style={styles.copiar}>
          <Ionicons name="copy-outline" size={14} color={colors.primary} />
          <Text style={styles.anadirTexto}>Copiar el lunes de martes a viernes</Text>
        </Pressable>
      </Card>

      {/* CADA LLAMADA: duración, margen y hasta cuándo se cancela. */}
      <Card style={styles.seccion}>
        <View style={styles.cab}>
          <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
          <Text style={styles.seccionTitulo}>Cada llamada</Text>
        </View>
        <Text style={styles.etiqueta}>Duración</Text>
        <ChipRow>
          {DURACIONES.map((m) => (
            <Chip key={m} texto={`${m} min`} activo={a.duracionMin === m} onPress={() => cambia({ duracionMin: m })} />
          ))}
        </ChipRow>
        <Text style={styles.etiqueta}>Se reserva con al menos</Text>
        <ChipRow>
          {MARGENES_HORAS.map((h) => (
            <Chip key={h} texto={`${h} h`} activo={a.margenHoras === h} onPress={() => cambia({ margenHoras: h })} />
          ))}
        </ChipRow>
        <Text style={styles.etiqueta}>El alumno puede cancelar hasta</Text>
        <ChipRow>
          {MARGENES_HORAS.map((h) => (
            <Chip
              key={h}
              texto={frase`${h} h antes`}
              activo={a.cancelarHastaHoras === h}
              onPress={() => cambia({ cancelarHastaHoras: h })}
            />
          ))}
        </ChipRow>
      </Card>

      {/* CÓMO: CALICO no hace la llamada; dice por dónde va. */}
      <Card style={styles.seccion}>
        <View style={styles.cab}>
          <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
          <Text style={styles.seccionTitulo}>Cómo es la llamada</Text>
        </View>
        <Segmented
          opciones={[
            { valor: 'whatsapp' as ComoEsLaLlamada, texto: 'WhatsApp', icono: 'logo-whatsapp' },
            { valor: 'telefono' as ComoEsLaLlamada, texto: 'Teléfono', icono: 'call-outline' },
            { valor: 'enlace' as ComoEsLaLlamada, texto: 'Enlace', icono: 'videocam-outline' },
          ]}
          valor={a.como}
          onChange={(v) => cambia({ como: v })}
        />
        {a.como === 'enlace' ? (
          <TextField
            label="Enlace de la llamada"
            value={a.enlace ?? ''}
            onChangeText={(v) => cambia({ enlace: v })}
            placeholder="https://meet.google.com/…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            containerStyle={{ marginTop: spacing.md, marginBottom: 0 }}
          />
        ) : (
          <Text style={[styles.ayuda, { marginTop: spacing.sm }]}>
            {a.como === 'whatsapp'
              ? 'A la hora de la llamada, le llamas tú por WhatsApp.'
              : 'A la hora de la llamada, le llamas tú por teléfono.'}
          </Text>
        )}
      </Card>

      {/* PLANES: lo que incluye cada uno, por prioridad. */}
      <Card style={styles.seccion}>
        <View style={styles.cab}>
          <Ionicons name="ribbon-outline" size={16} color={colors.primary} />
          <Text style={styles.seccionTitulo}>Planes de tus alumnos</Text>
        </View>
        <Text style={styles.ayuda}>
          Ordenados por prioridad: el de arriba, el más alto. Cada alumno tiene el suyo (se pone en su ficha).
        </Text>
        {a.planes.map((p, i) => (
          <View key={p.id} style={styles.plan}>
            <View style={styles.planCab}>
              <View style={styles.prioridad}>
                <Text style={styles.prioridadTexto}>{i + 1}</Text>
              </View>
              <TextInput
                value={p.nombre}
                onChangeText={(v) => cambiaPlan(p.id, { nombre: v.slice(0, 24) })}
                placeholder={t('Nombre del plan')}
                placeholderTextColor={colors.textFaint}
                style={styles.planNombre}
              />
              <Pressable onPress={() => moverPlan(i, i - 1)} disabled={i === 0} hitSlop={6} style={styles.planBtn}>
                <Ionicons name="chevron-up" size={17} color={i === 0 ? colors.textFaint : colors.text} />
              </Pressable>
              <Pressable
                onPress={() => moverPlan(i, i + 1)}
                disabled={i === a.planes.length - 1}
                hitSlop={6}
                style={styles.planBtn}
              >
                <Ionicons
                  name="chevron-down"
                  size={17}
                  color={i === a.planes.length - 1 ? colors.textFaint : colors.text}
                />
              </Pressable>
              <Pressable onPress={() => setPlanABorrar(p)} hitSlop={6} style={styles.planBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
            <Text style={styles.planAlumnos}>
              {cuantosConPlan(p.id) === 1 ? '1 alumno' : frase`${cuantosConPlan(p.id)} alumnos`}
            </Text>
            <Contador
              etiqueta="Llamadas al mes"
              valor={p.llamadasAlMes}
              onChange={(n) => cambiaPlan(p.id, { llamadasAlMes: n })}
            />
            <Text style={styles.etiqueta}>Reserva con hasta</Text>
            <ChipRow>
              {ANTELACIONES.map((d) => (
                <Chip
                  key={d}
                  texto={frase`${d} días`}
                  compacto
                  activo={p.antelacionDias === d}
                  onPress={() => cambiaPlan(p.id, { antelacionDias: d })}
                />
              ))}
            </ChipRow>
            <View style={[styles.fila, { marginTop: spacing.sm }]}>
              <Text style={[styles.planVip, { flex: 1 }]}>Incluye las clases VIP de tus cursos</Text>
              <Switch
                value={p.vip}
                onValueChange={(v) => cambiaPlan(p.id, { vip: v })}
                trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        ))}
        <Pressable onPress={nuevoPlan} style={styles.nuevoPlan} hitSlop={6}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.anadirTexto}>Nuevo plan</Text>
        </Pressable>
        {/* Los que no tienen plan: casi siempre, nada o una llamada de bienvenida. */}
        <View style={[styles.plan, styles.sinPlan]}>
          <Text style={styles.planNombreFijo}>Sin plan</Text>
          <Contador
            etiqueta="Llamadas al mes"
            valor={a.sinPlan.llamadasAlMes}
            onChange={(n) => cambia({ sinPlan: { ...a.sinPlan, llamadasAlMes: n } })}
          />
          <Text style={styles.etiqueta}>Reserva con hasta</Text>
          <ChipRow>
            {ANTELACIONES.map((d) => (
              <Chip
                key={d}
                texto={frase`${d} días`}
                compacto
                activo={a.sinPlan.antelacionDias === d}
                onPress={() => cambia({ sinPlan: { ...a.sinPlan, antelacionDias: d } })}
              />
            ))}
          </ChipRow>
        </View>
      </Card>

      {cambiado ? (
        <Button title="Guardar cambios" onPress={guardar} loading={guardando} style={styles.guardar} />
      ) : (
        <View style={{ height: spacing.xl }} />
      )}

      <Dialogo
        visible={!!aCancelar}
        onClose={() => setACancelar(null)}
        icono="call-outline"
        titulo="¿Cancelar la llamada?"
        texto={
          aCancelar
            ? frase`La de ${nombreDe(aCancelar.clientId)}, el ${diaLargo(aCancelar.inicio)} a las ${horaCorta(aCancelar.inicio)}. Le avisamos y le devolvemos la llamada a su cupo del mes.`
            : ''
        }
        accion="Sí, cancelarla"
        onAccion={confirmarCancelar}
        cancelar="No"
      />
      <Dialogo
        visible={!!planABorrar}
        onClose={() => setPlanABorrar(null)}
        icono="trash-outline"
        titulo={frase`¿Borrar el plan ${planABorrar?.nombre ?? ''}?`}
        texto={
          planABorrar && cuantosConPlan(planABorrar.id) > 0
            ? frase`Lo tienen ${cuantosConPlan(planABorrar.id)} alumnos: pasarán a "Sin plan". Se guarda al pulsar Guardar cambios.`
            : 'Se guarda al pulsar Guardar cambios.'
        }
        accion="Borrar"
        onAccion={() => {
          if (planABorrar) cambia({ planes: a.planes.filter((x) => x.id !== planABorrar.id) });
          setPlanABorrar(null);
        }}
      />
    </ScreenContainer>
  );
}

/** − 2 +: para números pequeños, más rápido que un teclado. */
function Contador({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={[styles.fila, { marginTop: spacing.sm }]}>
      <Text style={[styles.planVip, { flex: 1 }]}>{t(etiqueta)}</Text>
      <Pressable
        onPress={() => onChange(Math.max(0, valor - 1))}
        style={styles.contadorBtn}
        hitSlop={6}
        disabled={valor <= 0}
      >
        <Ionicons name="remove" size={16} color={valor <= 0 ? colors.textFaint : colors.text} />
      </Pressable>
      <Text style={styles.contadorValor}>{valor}</Text>
      <Pressable onPress={() => onChange(Math.min(30, valor + 1))} style={styles.contadorBtn} hitSlop={6}>
        <Ionicons name="add" size={16} color={colors.text} />
      </Pressable>
    </View>
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
  cab: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  seccionTitulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  ayuda: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  etiqueta: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  llamada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  llamadaNombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  llamadaPlan: { ...typography.small, color: colors.primaryBright, fontSize: 11 },
  llamadaHora: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  cancelar: { ...typography.small, color: colors.textFaint },
  dia: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  diaCab: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  diaInicial: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  diaInicialSi: { backgroundColor: colors.primaryMuted },
  diaInicialTexto: { ...typography.small, color: colors.textFaint, fontFamily: fonts.heading, fontSize: 12 },
  diaInicialTextoSi: { color: colors.primaryBright },
  diaNombre: { ...typography.body, color: colors.text, flex: 1 },
  diaNombreVacio: { color: colors.textMuted },
  anadirFranja: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  anadirTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  franjas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm, marginLeft: 34 },
  nuevaFranja: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginLeft: 34 },
  hora: {
    width: 64,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    textAlign: 'center',
    fontSize: 15,
    ...tabularNums,
  },
  guion: { ...typography.small, color: colors.textMuted },
  copiar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  plan: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  sinPlan: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  planCab: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  prioridad: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  prioridadTexto: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.heading, fontSize: 12 },
  planNombre: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.semiBold,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  planNombreFijo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  planBtn: { padding: 4 },
  planAlumnos: { ...typography.small, color: colors.textFaint, fontSize: 12, marginLeft: 32 },
  planVip: { ...typography.small, color: colors.text },
  nuevoPlan: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  contadorBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  contadorValor: {
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.heading,
    minWidth: 24,
    textAlign: 'center',
    ...tabularNums,
  },
  guardar: { marginTop: spacing.sm, marginBottom: spacing.xl },
});
