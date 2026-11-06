"use client";

import { useCallback, useEffect, useState } from "react";

import { createHistory, pushHistory, redoHistory, undoHistory, type History } from "@/lib/history";

/**
 * L'historique et ses raccourcis clavier. `revision` change à chaque retour en arrière : les champs
 * enrichis, qui gardent leur propre état, repartent alors de la valeur restaurée.
 */
export function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>(() => createHistory(initial));
  const [revision, setRevision] = useState(0);

  const set = useCallback((value: T, group: string | null = null) => {
    setHistory((current) => pushHistory(current, value, Date.now(), group));
  }, []);
  const reset = useCallback((value: T) => setHistory(createHistory(value)), []);
  const undo = useCallback(() => {
    setHistory(undoHistory);
    setRevision((value) => value + 1);
  }, []);
  const redo = useCallback(() => {
    setHistory(redoHistory);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      // Dans un champ, le raccourci reste celui du champ.
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redo, undo]);

  return {
    present: history.present,
    set,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    revision,
  };
}
