import { collection, getDocs, limit, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

/** Un error registrado por la app en el móvil de un usuario. */
export interface ErrorLogEntry {
  id: string;
  message: string;
  stack?: string;
  where?: string;
  uid?: string | null;
  fatal?: boolean;
  platform?: string;
  appVersion?: string;
  createdAt: number;
}

/** Cuántos se traen de una vez. Suficiente para ver qué está pasando hoy. */
const MAX = 100;

/** Últimos errores, del más reciente al más antiguo. Solo lo puede leer el CEO. */
export async function getRecentErrorLogs(): Promise<ErrorLogEntry[]> {
  const snap = await getDocs(
    query(collection(db, 'errorLogs'), orderBy('createdAt', 'desc'), limit(MAX))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ErrorLogEntry);
}

export async function deleteErrorLog(id: string): Promise<void> {
  await deleteDoc(doc(db, 'errorLogs', id));
}

/**
 * Agrupa por mensaje para leer de un vistazo qué falla MÁS, en vez de una lista
 * plana donde un mismo fallo repetido 40 veces tapa a los demás.
 */
export interface ErrorGroup {
  message: string;
  count: number;
  lastAt: number;
  where?: string;
  platforms: string[];
  affected: number;
  sample: ErrorLogEntry;
}

export function groupErrors(list: ErrorLogEntry[]): ErrorGroup[] {
  const map = new Map<string, ErrorLogEntry[]>();
  for (const e of list) {
    map.set(e.message, [...(map.get(e.message) ?? []), e]);
  }
  return [...map.values()]
    .map((items) => ({
      message: items[0].message,
      count: items.length,
      lastAt: Math.max(...items.map((i) => i.createdAt ?? 0)),
      where: items[0].where,
      platforms: Array.from(new Set(items.map((i) => i.platform ?? '?'))),
      // Usuarios distintos afectados: distingue "a uno le pasa siempre" de
      // "le pasa a todo el mundo", que exigen reacciones muy distintas.
      affected: new Set(items.map((i) => i.uid ?? 'anónimo')).size,
      sample: items[0],
    }))
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
}
