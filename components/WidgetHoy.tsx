import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { inicioDelDia } from '../lib/fechas';
import type { DatosDelWidget } from '../lib/widgetDatos';

/*
 * El dibujo del widget "Hoy" (ver lib/widgetHoy.ts).
 *
 * Solo con las piezas de react-native-android-widget: un widget no es una
 * pantalla de la app, se pinta fuera de ella y no entiende sus componentes.
 * Los colores son los de la marca, escritos a mano por lo mismo.
 */
const FONDO = '#0D0D0D';
const BORDE = '#262626';
const ORO = '#C9BDB0';
const TEXTO = '#FFFFFF';
const SUAVE = '#9A9A9A';
const PISTA = '#2A2A2A';

function conMiles(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function WidgetHoy({ datos, ahora }: { datos: DatosDelWidget | null; ahora: number }) {
  // Lo apuntado es de otro día: mejor decirlo que enseñar lo de ayer.
  const vigente = datos && datos.dia === inicioDelDia(ahora) ? datos : null;
  const pasos = vigente?.pasos ?? null;
  const progreso = pasos !== null && vigente ? Math.min(1, pasos / Math.max(1, vigente.objetivoPasos)) : 0;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: FONDO,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: BORDE,
        padding: 14,
      }}
    >
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        <TextWidget text="CALICO · HOY" style={{ fontSize: 11, color: ORO, letterSpacing: 0.12, fontWeight: '600' }} />
        <TextWidget
          text={vigente ? vigente.titulo : 'Abre CALICO'}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 19, color: TEXTO, fontWeight: '700', marginTop: 4 }}
        />
        <TextWidget
          text={vigente ? (vigente.hecho ? `✓ ${vigente.detalle}` : vigente.detalle) : 'para ver tu día'}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 13, color: vigente?.hecho ? ORO : SUAVE, marginTop: 2 }}
        />
      </FlexWidget>
      {pasos !== null && vigente ? (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          <TextWidget
            text={`${conMiles(pasos)} / ${conMiles(vigente.objetivoPasos)} pasos`}
            style={{ fontSize: 12, color: SUAVE }}
          />
          <FlexWidget
            style={{ flexDirection: 'row', width: 'match_parent', height: 5, marginTop: 5, backgroundColor: PISTA, borderRadius: 3 }}
          >
            <FlexWidget style={{ height: 5, flex: Math.max(0.0001, progreso), backgroundColor: ORO, borderRadius: 3 }} />
            <FlexWidget style={{ height: 5, flex: Math.max(0.0001, 1 - progreso) }} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

/** Para `renderWidget`: el widget con los datos de ahora. */
export function pintarWidgetHoy(datos: DatosDelWidget | null, ahora: number) {
  return <WidgetHoy datos={datos} ahora={ahora} />;
}
