import React from 'react';
import { LineChart } from './LineChart';
import type { WeightLog } from '../lib/types';

/**
 * La gráfica del peso. `compacto`: más baja y sin la fila de resumen, para la
 * tarjeta del peso, donde la cifra y los cambios ya están escritos encima.
 */
export function WeightChart({ logs, compacto = false }: { logs: WeightLog[]; compacto?: boolean }) {
  return (
    <LineChart
      points={logs.map((log) => ({ date: log.date, value: log.weightKg }))}
      unit="kg"
      labeled
      alto={compacto ? 120 : undefined}
      showSummary={!compacto}
      emptyMessage="Registra al menos dos pesajes para ver tu gráfica de evolución."
    />
  );
}
