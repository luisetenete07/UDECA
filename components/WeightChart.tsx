import React from 'react';
import { LineChart } from './LineChart';
import type { WeightLog } from '../lib/types';

export function WeightChart({ logs }: { logs: WeightLog[] }) {
  return (
    <LineChart
      points={logs.map((log) => ({ date: log.date, value: log.weightKg }))}
      unit="kg"
      emptyMessage="Registra al menos dos pesajes para ver tu gráfica de evolución."
    />
  );
}
