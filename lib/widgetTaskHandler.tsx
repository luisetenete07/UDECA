import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { pintarWidgetHoy } from '../components/WidgetHoy';
import { leerDatosDelWidget, NOMBRE_DEL_WIDGET } from './widgetHoy';

/**
 * Lo que hace Android con el widget cuando la app está cerrada: al ponerlo,
 * cada media hora y al cambiarle el tamaño, lo repinta con lo último que dejó
 * apuntado la app. Tocarlo abre la app (lo hace solo, con OPEN_APP).
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  if (props.widgetInfo.widgetName !== NOMBRE_DEL_WIDGET) return;
  props.renderWidget(pintarWidgetHoy(await leerDatosDelWidget(), Date.now()));
}
