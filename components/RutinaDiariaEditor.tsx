import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { DragList } from './DragList';
import { Sheet } from './Sheet';
import { showToast } from './Toast';
import { getExerciseLibrary } from '../lib/firestore/exercises';
import { getRutinaDiaria, setRutinaDiaria } from '../lib/firestore/rutinaDiaria';
import { frase, t } from '../lib/idioma';
import { nuevoId } from '../lib/ids';
import {
  cuentaTiempo,
  deLaBiblioteca,
  minutosDeTexto,
  moverEjercicio,
  NOMBRE_POR_DEFECTO,
  seriesDeTexto,
  textoDelEjercicio,
  yaEstaPuesto,
} from '../lib/rutinaDiaria';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { EjercicioDiario, Exercise } from '../lib/types';

/**
 * Lo que este alumno hace TODOS los días, aparte de su plan.
 *
 * QUÉ ES
 *
 * El pino, la movilidad de cadera, los estiramientos. Cosas cortas que no son
 * "el entreno del martes" sino algo que se repite a diario y que, justo por
 * repetirse, es lo que más cambia a alguien en seis meses.
 *
 * POR QUÉ NO ES EL EDITOR DE RUTINAS OTRA VEZ
 *
 * Cada ejercicio lleva tres cosas y ninguna es obligatoria: un objetivo en
 * TEXTO LIBRE, las series si se quieren contar, y el vídeo de la técnica. Nada
 * de repeticiones, descansos, RIR ni progresión: poner "movilidad de cadera, un
 * par de minutos" en esos campos obliga a inventarse números que nadie va a
 * cumplir ni mirar.
 *
 * El objetivo es texto libre justo por eso: cabe un aguante, unos minutos o
 * "hasta que deje de tirar", que es como se explican de verdad estas cosas.
 *
 * LAS SERIES, CUANDO SE QUIEREN CONTAR
 *
 * En el grease the groove las series no van seguidas: se reparten por el día.
 * Con un número aquí, el alumno las marca de una en una y sabe cuántas le
 * quedan. Sin número, el ejercicio se marca entero de un toque — y eso es lo
 * correcto para dos minutos de movilidad, que no se cuentan por series.
 *
 * O POR TIEMPO
 *
 * Hay cosas que no se cuentan por series sino por rato: "20-30 min de pino".
 * Cada ejercicio elige: Series o Tiempo. Con tiempo, un número de minutos o un
 * margen, y el alumno los va sumando a lo largo del día.
 *
 * Y EL ORDEN SE ARRASTRA
 *
 * Porque no es decorativo: quien pone las muñecas antes del pino lo hace para
 * llegar al pino con las muñecas calientes.
 *
 * SE APAGA SIN PERDER NADA
 *
 * El interruptor deja de enseñársela al alumno pero no borra los ejercicios:
 * una rutina diaria se quita en una semana de mucha carga y se vuelve a poner
 * después, y volver a escribirla entera cada vez es lo que hace que no se
 * vuelva a poner.
 */
export function RutinaDiariaEditor({
  trainerId,
  clientId,
  /** Cómo se llama a esta persona en los textos. */
  paraMi = false,
}: {
  trainerId: string;
  clientId: string;
  paraMi?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [activa, setActiva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [indicaciones, setIndicaciones] = useState('');
  const [ejercicios, setEjercicios] = useState<EjercicioDiario[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoObjetivo, setNuevoObjetivo] = useState('');
  const [nuevasSeries, setNuevasSeries] = useState('');
  // Al añadir: si se cuenta por series o por tiempo, y el máximo del margen.
  const [nuevoModo, setNuevoModo] = useState<ModoDeCuenta>('series');
  const [nuevoMax, setNuevoMax] = useState('');
  // El modo de cada ejercicio mientras se edita (sin número puesto aún, el
  // ejercicio no dice si iba a ser por series o por tiempo).
  const [modos, setModos] = useState<Record<string, ModoDeCuenta>>({});
  /** Cuál se está editando. Solo uno a la vez: la tarjeta es pequeña. */
  const [editando, setEditando] = useState<string | null>(null);
  /*
   * LA BIBLIOTECA, PARA NO ESCRIBIRLO TODO OTRA VEZ
   *
   * Los ejercicios ya existen: tienen su nombre escrito como toca y su vídeo de
   * técnica puesto. Escribirlos de nuevo aquí —y volver a pegar el enlace— es
   * trabajo repetido para cada alumno, y además es donde se cuelan las erratas
   * y los vídeos que nadie llega a poner.
   *
   * Se carga solo al abrir el selector: la mayoría de las veces que se toca
   * esta tarjeta es para marcar el interruptor o cambiar un objetivo, y pedir
   * la biblioteca entera para eso sería una lectura de más en cada visita.
   */
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false);
  const [biblioteca, setBiblioteca] = useState<Exercise[] | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let vivo = true;
    getRutinaDiaria(clientId)
      .then((r) => {
        if (!vivo) return;
        if (r) {
          setActiva(r.activa);
          setNombre(r.nombre ?? '');
          setIndicaciones(r.indicaciones ?? '');
          setEjercicios(r.ejercicios ?? []);
          // Si ya tiene una puesta, se abre: es lo que se viene a mirar.
          setAbierto(r.activa && r.ejercicios.length > 0);
        }
        setCargando(false);
      })
      .catch(() => setCargando(false));
    return () => {
      vivo = false;
    };
  }, [clientId]);

  /**
   * Guarda entero, siempre.
   *
   * Se guarda en cada cambio y no con un botón de "Guardar": esto es una lista
   * de cuatro cosas, y un botón aparte solo sirve para que un día se salga de
   * la pantalla sin pulsarlo y se pierda lo escrito.
   */
  const guardar = async (
    cambios: Partial<{ activa: boolean; nombre: string; indicaciones: string; ejercicios: EjercicioDiario[] }>
  ) => {
    const siguiente = {
      activa: cambios.activa ?? activa,
      nombre: cambios.nombre ?? nombre,
      indicaciones: cambios.indicaciones ?? indicaciones,
      ejercicios: cambios.ejercicios ?? ejercicios,
    };
    try {
      await setRutinaDiaria({
        trainerId,
        clientId,
        activa: siguiente.activa,
        nombre: siguiente.nombre.trim() || NOMBRE_POR_DEFECTO,
        // Vacío y no sin campo: el guardado mezcla, y sin el campo se quedaría
        // la indicación de antes después de borrarla.
        indicaciones: siguiente.indicaciones.trim(),
        ejercicios: siguiente.ejercicios,
      });
    } catch {
      showToast('No se ha podido guardar');
    }
  };

  const anadir = () => {
    const n = nuevoNombre.trim();
    if (!n) return;
    const cuenta = cuentaNueva();
    const lista = [
      ...ejercicios,
      // `series` (o `minutos`) solo si de verdad hay un número: sin poner y
      // "una serie" son cosas distintas, y un campo vacío ensucia el documento.
      { id: nuevoId(), nombre: n, objetivo: nuevoObjetivo.trim(), ...cuenta },
    ];
    setEjercicios(lista);
    limpiarNuevo();
    // El primero que se añade la enciende: nadie escribe una lista para dejarla
    // apagada, y obligar a buscar el interruptor después es un paso de más.
    const encender = !activa && lista.length === 1;
    if (encender) setActiva(true);
    void guardar({ ejercicios: lista, activa: encender ? true : activa });
  };

  /** Lo escrito abajo para el ejercicio nuevo: sus series o sus minutos. */
  const cuentaNueva = (): Pick<EjercicioDiario, 'series' | 'minutos'> => {
    if (nuevoModo === 'tiempo') {
      const minutos = minutosDeTexto(nuevasSeries, nuevoMax);
      return minutos ? { minutos } : {};
    }
    const series = seriesDeTexto(nuevasSeries);
    return series ? { series } : {};
  };

  const limpiarNuevo = () => {
    setNuevoNombre('');
    setNuevoObjetivo('');
    setNuevasSeries('');
    setNuevoMax('');
  };

  /**
   * Cambia un ejercicio de series a tiempo o al revés. Lo del otro modo se
   * quita: es una cosa u otra, y dejar las dos haría dudar al alumno.
   */
  const cambiarModo = (id: string, modo: ModoDeCuenta) => {
    setModos((prev) => ({ ...prev, [id]: modo }));
    setEjercicios((prev) => {
      const lista = prev.map((e) =>
        e.id !== id ? e : modo === 'tiempo' ? { ...e, series: undefined } : { ...e, minutos: undefined }
      );
      void guardar({ ejercicios: lista });
      return lista;
    });
  };

  const modoDe = (e: EjercicioDiario): ModoDeCuenta => modos[e.id] ?? (cuentaTiempo(e) ? 'tiempo' : 'series');

  const abrirBiblioteca = async () => {
    setBusca('');
    setBibliotecaAbierta(true);
    if (biblioteca) return;
    try {
      setBiblioteca(await getExerciseLibrary(trainerId));
    } catch {
      setBiblioteca([]);
      showToast('No se ha podido cargar tu biblioteca');
    }
  };

  /**
   * Trae uno de la biblioteca con su nombre y su vídeo ya puestos.
   *
   * El panel NO se cierra al elegir: lo normal es poner tres o cuatro cosas
   * seguidas —pino, muñecas, movilidad de cadera— y tener que abrirlo otra vez
   * cada vez es lo que hace que se acabe escribiendo a mano.
   *
   * Lo que sí se lleva es el objetivo y las series (o minutos) escritos abajo,
   * si los hay: quien ha tecleado "30 s" y luego elige el ejercicio espera que
   * se aplique, no que se pierda.
   */
  const anadirDeBiblioteca = (ej: Exercise) => {
    if (yaEstaPuesto(ejercicios, ej.id)) {
      showToast(frase`${ej.name} ya está en la rutina`);
      return;
    }
    const lista = [
      ...ejercicios,
      deLaBiblioteca(ej, nuevoId(), { objetivo: nuevoObjetivo, ...cuentaNueva() }),
    ];
    setEjercicios(lista);
    limpiarNuevo();
    const encender = !activa && lista.length === 1;
    if (encender) setActiva(true);
    void guardar({ ejercicios: lista, activa: encender ? true : activa });
    showToast(ej.videoUrl?.trim() ? frase`${ej.name} añadido, con su vídeo` : frase`${ej.name} añadido`);
  };

  const quitar = (id: string) => {
    const lista = ejercicios.filter((e) => e.id !== id);
    setEjercicios(lista);
    if (editando === id) setEditando(null);
    void guardar({ ejercicios: lista });
  };

  /**
   * Cambia UN campo de UN ejercicio. Solo en pantalla, sin guardar.
   *
   * Se guarda al salir del campo, con `guardarLista`. Guardar en cada letra
   * sería una escritura por pulsación; y guardar en `onEndEditing`, como estaba,
   * se perdía el vídeo entero: al tocar la cabecera para salir del campo, el
   * campo se desmonta y ese aviso no llega a saltar nunca.
   */
  const cambiar = (id: string, campos: Partial<EjercicioDiario>) => {
    setEjercicios((prev) => prev.map((e) => (e.id === id ? { ...e, ...campos } : e)));
  };

  /** Guarda lo que haya ahora en pantalla. Se llama al salir de un campo. */
  const guardarLista = () => {
    setEjercicios((prev) => {
      void guardar({ ejercicios: prev });
      return prev;
    });
  };

  const reordenar = (desde: number, hasta: number) => {
    const lista = moverEjercicio(ejercicios, desde, hasta);
    if (lista === ejercicios) return;
    setEjercicios(lista);
    void guardar({ ejercicios: lista });
  };

  const alternar = () => {
    const v = !activa;
    setActiva(v);
    void guardar({ activa: v });
  };

  if (cargando) return null;

  const resumen = !activa
    ? 'apagada'
    : ejercicios.length === 0
      ? 'sin ejercicios'
      : `${ejercicios.length} ${ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}`;

  return (
    <Card style={styles.tarjeta}>
      <Pressable style={styles.cabecera} onPress={() => setAbierto((v) => !v)} hitSlop={6}>
        <Ionicons name="repeat-outline" size={16} color={colors.primary} />
        {/* La pista DEBAJO del título, igual que en el resto de paneles
            plegables: al lado no caben los dos en un móvil estrecho y "Rutina
            diaria" se partía en "Rutina / diaria". */}
        <View style={styles.cabeceraTextos}>
          <Text style={styles.titulo}>Rutina diaria</Text>
          <Text style={styles.pista}>{resumen}</Text>
        </View>
        <Ionicons
          name={abierto ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textFaint}
        />
      </Pressable>

      {abierto ? (
        <>
          <Text style={styles.explica}>
            {paraMi
              ? 'Lo que harás todos los días aparte de tu plan: pino, movilidad, lo que se repite. Corto y a diario.'
              : 'Lo que hará todos los días aparte de su plan: pino, movilidad, lo que se repite. Corto y a diario.'}
          </Text>

          <Pressable style={styles.interruptor} onPress={alternar} hitSlop={6}>
            <View style={[styles.casilla, activa && styles.casillaOn]}>
              {activa ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
            </View>
            <Text style={styles.interruptorTexto}>
              {activa
                ? paraMi
                  ? 'Activa: la ves en tu Entreno'
                  : 'Activa: la ve en su Entreno'
                : 'Apagada. Los ejercicios se guardan igual.'}
            </Text>
          </Pressable>

          <TextInput
            style={styles.campoNombre}
            value={nombre}
            onChangeText={setNombre}
            onBlur={() => guardar({ nombre })}
            placeholder={t(NOMBRE_POR_DEFECTO)}
            placeholderTextColor={colors.textFaint}
          />
          {/* Lo que vale para toda la rutina: cada cuánto, cuánto dejar en la
              recámara, qué hacer el día que no sale. Lo de un ejercicio va en
              ese ejercicio. */}
          <TextInput
            style={[styles.campoEjercicio, styles.campoIndicaciones, { marginTop: spacing.sm }]}
            value={indicaciones}
            onChangeText={setIndicaciones}
            onBlur={() => guardar({ indicaciones })}
            placeholder={t(
              paraMi
                ? 'Indicaciones para toda la rutina (opcional)'
                : 'Indicaciones para toda la rutina: cada cuánto, cuánto dejar en la recámara… (opcional)'
            )}
            placeholderTextColor={colors.textFaint}
            multiline
          />

          {/* El arrastre sale SOLO del asa (`handleOnly`): la fila lleva campos
              de texto dentro, y sin eso colocar el cursor en uno la movería. */}
          <DragList
            items={ejercicios}
            keyOf={(e) => e.id}
            onReorder={reordenar}
            handleOnly
            gap={0}
            style={styles.lista}
            renderItem={(e, _i, arrastrando, asa) => (
              <View style={[styles.fila, arrastrando && styles.filaArrastrando]}>
                <View style={styles.filaCabecera}>
                  {/* Con nombre: para quien usa lector de pantalla, un icono
                      sin etiqueta es un elemento mudo en medio de la fila. */}
                  <View
                    {...asa}
                    style={styles.asa}
                    accessibilityLabel="Mover de sitio"
                    accessibilityRole="adjustable"
                  >
                    <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
                  </View>
                  <Pressable
                    style={styles.filaTextos}
                    onPress={() => {
                      if (editando === e.id) guardarLista();
                      setEditando((v) => (v === e.id ? null : e.id));
                    }}
                    hitSlop={4}
                  >
                    <Text style={styles.filaNombre}>{e.nombre}</Text>
                    {textoDelEjercicio(e) ? (
                      <Text style={styles.filaObjetivo}>{textoDelEjercicio(e)}</Text>
                    ) : null}
                  </Pressable>
                  {/* Que se vea desde fuera si tiene vídeo: entrar a cada uno a
                      comprobarlo es lo que hace que no se rellene nunca. */}
                  {e.indicaciones?.trim() ? (
                    <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                  ) : null}
                  {e.video?.trim() ? (
                    <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
                  ) : null}
                  <Pressable
                    onPress={() => {
                      // Cerrar también guarda: es la otra forma de salir de los
                      // campos, y perder lo escrito por cerrar sería lo peor.
                      if (editando === e.id) guardarLista();
                      setEditando((v) => (v === e.id ? null : e.id));
                    }}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={editando === e.id ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textFaint}
                    />
                  </Pressable>
                  <Pressable onPress={() => quitar(e.id)} hitSlop={10}>
                    <Ionicons name="close" size={16} color={colors.textFaint} />
                  </Pressable>
                </View>

                {editando === e.id ? (
                  <View style={styles.edicion}>
                    <TextInput
                      style={styles.campoEjercicio}
                      defaultValue={e.objetivo}
                      onChangeText={(t) => cambiar(e.id, { objetivo: t })}
                      onBlur={guardarLista}
                      placeholder={t('Objetivo (p. ej. 30 s por lado)')}
                      placeholderTextColor={colors.textFaint}
                    />
                    {/* Series o tiempo: "5 series de pino" o "20-30 min de pino". */}
                    <View style={styles.edicionFila}>
                      <SelectorDeCuenta modo={modoDe(e)} onCambiar={(m) => cambiarModo(e.id, m)} />
                      {modoDe(e) === 'tiempo' ? (
                        <CamposDeMinutos
                          // Con clave propia: al cambiar de modo los campos
                          // vuelven a nacer con lo que haya guardado.
                          key={`${e.id}-tiempo`}
                          min={e.minutos ? String(e.minutos.min) : ''}
                          max={e.minutos?.max ? String(e.minutos.max) : ''}
                          onCambiar={(min, max) => cambiar(e.id, { minutos: minutosDeTexto(min, max), series: undefined })}
                          onSalir={guardarLista}
                        />
                      ) : (
                        <TextInput
                          key={`${e.id}-series`}
                          style={[styles.campoEjercicio, styles.campoSeries]}
                          defaultValue={e.series ? String(e.series) : ''}
                          onChangeText={(t) => cambiar(e.id, { series: seriesDeTexto(t), minutos: undefined })}
                          onBlur={guardarLista}
                          placeholder={t('Series')}
                          placeholderTextColor={colors.textFaint}
                          keyboardType="number-pad"
                        />
                      )}
                    </View>
                    <Text style={styles.pistaSeries}>
                      {modoDe(e) === 'tiempo'
                        ? 'Minutos al día, o un margen (de 20 a 30). Los va sumando y, al llegar al mínimo, queda hecho.'
                        : 'Con series, se marcan de una en una a lo largo del día.'}
                    </Text>
                    <TextInput
                      style={[styles.campoEjercicio, styles.campoIndicaciones]}
                      defaultValue={e.indicaciones ?? ''}
                      onChangeText={(t) => cambiar(e.id, { indicaciones: t.trim() ? t : undefined })}
                      onBlur={guardarLista}
                      placeholder={t('Indicaciones: técnica, cómo repartirlo, qué notar (opcional)')}
                      placeholderTextColor={colors.textFaint}
                      multiline
                    />
                    <TextInput
                      style={styles.campoEjercicio}
                      defaultValue={e.video ?? ''}
                      onChangeText={(t) => cambiar(e.id, { video: t.trim() || undefined })}
                      onBlur={guardarLista}
                      placeholder={t('Enlace del vídeo (YouTube o Vimeo)')}
                      placeholderTextColor={colors.textFaint}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                  </View>
                ) : null}
              </View>
            )}
          />

          <View style={styles.anadir}>
            {/* Primero la biblioteca y después el campo de escribir: lo normal
                es que el ejercicio YA exista con su nombre y su vídeo, y
                escribirlo a mano sea la excepción. Puesto debajo, se escribía
                a mano por inercia y los vídeos no se ponían nunca. */}
            <Pressable onPress={abrirBiblioteca} style={styles.botonBiblioteca} hitSlop={4}>
              <Ionicons name="library-outline" size={16} color={colors.primary} />
              {/* La biblioteca es del entrenador, y cuando el atleta se
                  autoentrena es la suya: en los dos casos "mi biblioteca". */}
              <Text style={styles.botonBibliotecaTexto}>Elegir de mi biblioteca</Text>
            </Pressable>
            <Text style={styles.oEscribe}>o escríbelo a mano:</Text>
            <TextInput
              style={styles.campoEjercicio}
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
              /*
               * Corto a propósito: "Ejercicio (p. ej. Pino contra pared)" no
               * cabía en un móvil de 320 px y se leía a medias, sin cerrar el
               * paréntesis. La palabra "Ejercicio" sobra: el campo está debajo
               * de la lista de ejercicios y encima del botón de añadir.
               */
              placeholder={t('Ej. Pino contra pared')}
              placeholderTextColor={colors.textFaint}
              returnKeyType="next"
            />
            {/* Cuánto: series o un rato ("20-30 min de pino"). */}
            <View style={styles.filaObjetivoNuevo}>
              <SelectorDeCuenta modo={nuevoModo} onCambiar={setNuevoModo} />
              {nuevoModo === 'tiempo' ? (
                <CamposDeMinutos
                  min={nuevasSeries}
                  max={nuevoMax}
                  controlado
                  onCambiar={(min, max) => {
                    setNuevasSeries(min);
                    setNuevoMax(max);
                  }}
                />
              ) : (
                <TextInput
                  style={[styles.campoEjercicio, styles.campoSeries]}
                  value={nuevasSeries}
                  onChangeText={setNuevasSeries}
                  placeholder={t('Series')}
                  placeholderTextColor={colors.textFaint}
                  keyboardType="number-pad"
                />
              )}
            </View>
            {/* Y el objetivo, con "Añadir" al lado: es lo último que se escribe. */}
            <View style={styles.filaObjetivoNuevo}>
              <TextInput
                style={[styles.campoEjercicio, styles.campoObjetivoNuevo]}
                value={nuevoObjetivo}
                onChangeText={setNuevoObjetivo}
                placeholder={t('Objetivo (p. ej. 30 s)')}
                placeholderTextColor={colors.textFaint}
                onSubmitEditing={anadir}
                returnKeyType="done"
              />
              <Pressable
                onPress={anadir}
                style={[styles.botonAnadir, !nuevoNombre.trim() && styles.botonApagado]}
                disabled={!nuevoNombre.trim()}
              >
                <Text style={styles.botonAnadirTexto}>Añadir</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}

      {/* Los ejercicios que ya existen, con su vídeo. Se eligen de aquí en vez
          de volver a escribirlos: ver `deLaBiblioteca` en lib/rutinaDiaria.ts. */}
      <Sheet
        visible={bibliotecaAbierta}
        onClose={() => {
          setBibliotecaAbierta(false);
          setBusca('');
        }}
        titulo="Elegir de tu biblioteca"
        descripcion="Se traen con su nombre y su vídeo. Puedes elegir varios seguidos."
      >
        <TextInput
          style={styles.campoEjercicio}
          value={busca}
          onChangeText={setBusca}
          placeholder={t('Buscar')}
          placeholderTextColor={colors.textFaint}
          autoFocus
        />
        {biblioteca === null ? (
          <Text style={styles.vacioBiblioteca}>Cargando tu biblioteca…</Text>
        ) : biblioteca.length === 0 ? (
          <Text style={styles.vacioBiblioteca}>
            Todavía no tienes ejercicios en tu biblioteca. Créalos en Ejercicios y aparecerán aquí.
          </Text>
        ) : (
          (() => {
            const busqueda = busca.trim().toLowerCase();
            const encontrados = biblioteca.filter((e) =>
              busqueda ? e.name.toLowerCase().includes(busqueda) : true
            );
            if (encontrados.length === 0) {
              return <Text style={styles.vacioBiblioteca}>Ninguno se llama así.</Text>;
            }
            /*
             * Un tope de doce: la lista va dentro de un panel y con biblioteca
             * de doscientos ejercicios se convierte en un scroll interminable.
             * Para eso está el buscador de arriba.
             */
            return encontrados.slice(0, 12).map((e) => {
              const puesto = yaEstaPuesto(ejercicios, e.id);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => anadirDeBiblioteca(e)}
                  style={[styles.filaBiblioteca, puesto && styles.filaBibliotecaPuesta]}
                >
                  <Ionicons
                    name={puesto ? 'checkmark-circle' : 'add-circle-outline'}
                    size={18}
                    color={puesto ? colors.primary : colors.textMuted}
                  />
                  <Text style={styles.filaBibliotecaTexto} numberOfLines={1}>
                    {e.name}
                  </Text>
                  {/* Que se vea de antemano cuáles traen vídeo: si no, hay que
                      añadirlo para descubrir que no lo tiene. */}
                  {e.videoUrl?.trim() ? (
                    <Ionicons name="play-circle-outline" size={15} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            });
          })()
        )}
      </Sheet>
    </Card>
  );
}

type ModoDeCuenta = 'series' | 'tiempo';

/** "Series" o "Tiempo": cómo se cuenta un ejercicio de la rutina diaria. */
function SelectorDeCuenta({ modo, onCambiar }: { modo: ModoDeCuenta; onCambiar: (m: ModoDeCuenta) => void }) {
  return (
    <View style={styles.selector} accessibilityRole="radiogroup">
      {(
        [
          ['series', 'Series'],
          ['tiempo', 'Tiempo'],
        ] as const
      ).map(([valor, texto]) => {
        const on = modo === valor;
        return (
          <Pressable
            key={valor}
            onPress={() => onCambiar(valor)}
            style={[styles.selectorOpcion, on && styles.selectorOpcionOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            hitSlop={4}
          >
            <Text style={[styles.selectorTexto, on && styles.selectorTextoOn]}>{texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Los minutos: "de [20] a [30] min". El "a" es opcional: con uno solo es un
 * tiempo fijo. Dos casillas numéricas y no "20-30" en una, porque el teclado
 * numérico del móvil no tiene guion.
 */
function CamposDeMinutos({
  min,
  max,
  onCambiar,
  onSalir,
  controlado = false,
}: {
  min: string;
  max: string;
  onCambiar: (min: string, max: string) => void;
  onSalir?: () => void;
  /** En el formulario de añadir, los valores los lleva quien lo usa. */
  controlado?: boolean;
}) {
  // Sin controlar (la fila de un ejercicio): se recuerda lo escrito aquí, y se
  // guarda al salir del campo, como el resto de la fila.
  const [a, setA] = useState(min);
  const [b, setB] = useState(max);
  const va = controlado ? min : a;
  const vb = controlado ? max : b;
  return (
    <View style={styles.minutos}>
      <TextInput
        style={[styles.campoEjercicio, styles.campoMinutos]}
        value={va}
        onChangeText={(v) => {
          setA(v);
          onCambiar(v, vb);
        }}
        onBlur={onSalir}
        placeholder="20"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        accessibilityLabel={t('Minutos (mínimo)')}
      />
      <Text style={styles.minutosTexto}>a</Text>
      <TextInput
        style={[styles.campoEjercicio, styles.campoMinutos]}
        value={vb}
        onChangeText={(v) => {
          setB(v);
          onCambiar(va, v);
        }}
        onBlur={onSalir}
        placeholder="30"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        accessibilityLabel={t('Minutos (máximo, opcional)')}
      />
      <Text style={styles.minutosTexto}>min</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  selector: {
    flexDirection: 'row',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: 2,
  },
  selectorOpcion: { paddingHorizontal: 12, height: 32, borderRadius: radius.full, justifyContent: 'center' },
  selectorOpcionOn: { backgroundColor: colors.primary },
  selectorTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  selectorTextoOn: { color: colors.onPrimary },
  minutos: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  campoMinutos: { width: 60, textAlign: 'center' },
  minutosTexto: { ...typography.small, color: colors.textMuted },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cabeceraTextos: { flex: 1, minWidth: 0 },
  titulo: { ...typography.h3, color: colors.text },
  pista: { ...typography.small, color: colors.textFaint, fontSize: 12, marginTop: 1 },
  explica: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  interruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  interruptorTexto: { ...typography.small, color: colors.text, flex: 1 },
  campoNombre: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  lista: { marginTop: spacing.sm },
  fila: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Mientras se arrastra, la fila se despega del fondo para que se vea cuál va
  // en el dedo y dónde va a caer.
  filaArrastrando: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // El asa se coge con el dedo: pequeña no se acierta, y fallar al arrastrar
  // acaba moviendo la pantalla en vez del ejercicio.
  asa: { paddingVertical: 4, paddingRight: 2 },
  filaTextos: { flex: 1, minWidth: 0 },
  filaNombre: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  filaObjetivo: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  edicion: { gap: spacing.sm, marginTop: spacing.sm, paddingLeft: 26 },
  edicionFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  campoSeries: { width: 84, flexGrow: 0, flexShrink: 0 },
  pistaSeries: { ...typography.small, color: colors.textFaint, flex: 1, minWidth: 140 },
  anadir: { marginTop: spacing.md, gap: spacing.sm },
  campoEjercicio: {
    ...typography.small,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceAlt,
  },
  campoIndicaciones: { minHeight: 64, textAlignVertical: 'top' },
  filaObjetivoNuevo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Tres cosas en una fila no caben en un móvil estrecho: que bajen en vez de
    // encogerse hasta que el objetivo se quede en dos letras.
    flexWrap: 'wrap',
  },
  // Base cero: en la web un campo de texto pide de por sí un ancho que, con el
  // salto de línea, mandaba "Añadir" a la fila de abajo.
  campoObjetivoNuevo: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 130 },
  botonAnadir: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  botonApagado: { opacity: 0.4 },
  botonAnadirTexto: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
  botonBiblioteca: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  botonBibliotecaTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  oEscribe: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm },
  filaBiblioteca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  filaBibliotecaPuesta: { opacity: 0.55 },
  filaBibliotecaTexto: { ...typography.body, color: colors.text, flex: 1 },
  vacioBiblioteca: { ...typography.small, color: colors.textFaint, paddingVertical: spacing.md },
});
