import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clavePanel, mezclarOrden } from './panelOrder';

/**
 * El orden de los bloques de un panel, guardado en el dispositivo.
 *
 * Mismo criterio que el plegado de las tarjetas (`CollapsibleCard`): es una
 * preferencia de cómo miras ESTA pantalla en ESTE móvil, no un ajuste de tu
 * cuenta. Si se sincronizara, reordenar en el ordenador te cambiaría el móvil,
 * y son dos sitios donde el panel se mira de maneras distintas.
 *
 * La regla de qué se ve y en qué orden vive aparte, en `panelOrder.ts`, para
 * poder comprobarla sin levantar la app.
 */
export function usePanelOrder(panel: string, ids: string[]) {
  const [orden, setOrden] = useState<string[]>(ids);
  const [listo, setListo] = useState(false);

  // `ids` llega como array nuevo en cada render; se compara por contenido para
  // no releer el almacén en bucle.
  const clave = ids.join('|');

  useEffect(() => {
    let vivo = true;
    AsyncStorage.getItem(clavePanel(panel))
      .then((v) => {
        if (!vivo) return;
        let guardado: unknown = [];
        try {
          guardado = v ? JSON.parse(v) : [];
        } catch {
          guardado = [];
        }
        setOrden(
          mezclarOrden(
            Array.isArray(guardado) ? (guardado as string[]) : [],
            clave.split('|')
          )
        );
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setListo(true);
      });
    return () => {
      vivo = false;
    };
  }, [panel, clave]);

  const mover = useCallback(
    (desde: number, hasta: number) => {
      setOrden((prev) => {
        const siguiente = [...prev];
        const [x] = siguiente.splice(desde, 1);
        siguiente.splice(hasta, 0, x);
        AsyncStorage.setItem(clavePanel(panel), JSON.stringify(siguiente)).catch(() => {});
        return siguiente;
      });
    },
    [panel]
  );

  const restaurar = useCallback(() => {
    setOrden(clave.split('|'));
    AsyncStorage.removeItem(clavePanel(panel)).catch(() => {});
  }, [panel, clave]);

  return { orden, mover, restaurar, listo };
}
