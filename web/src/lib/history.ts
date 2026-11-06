/** L'historique annuler/rétablir d'un élément modifié. */

export type History<T> = { past: T[]; present: T; future: T[]; group: string | null; at: number };

const LIMIT = 100;
/** Les changements d'un même groupe, à moins de ce délai, ne font qu'une étape : une saisie, pas une lettre. */
export const GROUP_WINDOW = 800;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], group: null, at: 0 };
}

export function pushHistory<T>(history: History<T>, present: T, now: number, group: string | null = null): History<T> {
  const merged = group !== null && group === history.group && now - history.at < GROUP_WINDOW;
  return {
    past: merged ? history.past : [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    group,
    at: now,
  };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    group: null,
    at: 0,
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    group: null,
    at: 0,
  };
}
