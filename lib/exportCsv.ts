/**
 * Exportación a CSV (solo web): descarga un archivo con los datos del negocio
 * del coach para abrirlo en Excel/Google Sheets. Sin librerías: se construye
 * el CSV a mano con comillas escapadas y BOM para acentos correctos.
 */

function cell(value: string | number | undefined | null): string {
  const s = value == null ? '' : String(value);
  // Entrecomillar si tiene coma, comilla o salto; doblar comillas internas.
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const lines = [headers.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))];
  return lines.join('\n');
}

/** Descarga el CSV con nombre `filename`. Devuelve false si no es web. */
export function downloadCsv(filename: string, csv: string): boolean {
  if (typeof document === 'undefined') return false;
  // BOM (﻿) para que Excel interprete UTF-8 y respete los acentos.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
