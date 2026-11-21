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

export function WidgetHoy({ datos, ahora }: { datos: DatosDelWidget | null; ahora: number }) {
  // Lo apuntado es de otro día: mejor decirlo que enseñar lo de ayer.
  const vigente = datos && datos.dia === inicioDelDia(ahora) ? datos : null;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        backgroundColor: FONDO,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: BORDE,
        padding: 14,
      }}
    >
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        <TextWidget text="MASTERY · HOY" style={{ fontSize: 11, color: ORO, letterSpacing: 0.12, fontWeight: '600' }} />
        <TextWidget
          text={vigente ? vigente.titulo : 'Abre MASTERY'}
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
    </FlexWidget>
  );
}

/** Para `renderWidget`: el widget con los datos de ahora. */
export function pintarWidgetHoy(datos: DatosDelWidget | null, ahora: number) {
  return <WidgetHoy datos={datos} ahora={ahora} />;
}
