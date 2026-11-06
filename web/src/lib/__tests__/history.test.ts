import { describe, expect, it } from "vitest";

import { createHistory, GROUP_WINDOW, pushHistory, redoHistory, undoHistory } from "@/lib/history";

describe("historique", () => {
  it("annule puis rétablit", () => {
    let history = pushHistory(createHistory("a"), "b", 1000);
    history = pushHistory(history, "c", 5000);
    history = undoHistory(history);
    expect(history.present).toBe("b");
    history = undoHistory(history);
    expect(history.present).toBe("a");
    expect(undoHistory(history)).toBe(history);
    history = redoHistory(redoHistory(history));
    expect(history.present).toBe("c");
    expect(redoHistory(history)).toBe(history);
  });

  it("une saisie rapide ne fait qu'une étape", () => {
    let history = pushHistory(createHistory(""), "a", 1000, "texte");
    history = pushHistory(history, "ab", 1100, "texte");
    history = pushHistory(history, "abc", 1200, "texte");
    expect(undoHistory(history).present).toBe("");
  });

  it("une pause ou un autre groupe crée une nouvelle étape", () => {
    let history = pushHistory(createHistory(""), "a", 1000, "texte");
    history = pushHistory(history, "ab", 1000 + GROUP_WINDOW + 1, "texte");
    expect(undoHistory(history).present).toBe("a");
    history = pushHistory(history, "abc", 1000 + GROUP_WINDOW + 2, "police");
    expect(undoHistory(history).present).toBe("ab");
  });

  it("un nouveau changement efface ce qu'on pouvait rétablir", () => {
    let history = pushHistory(createHistory("a"), "b", 1000);
    history = undoHistory(history);
    history = pushHistory(history, "c", 5000);
    expect(history.future).toEqual([]);
    expect(redoHistory(history).present).toBe("c");
  });

  it("n'en garde qu'un nombre limité", () => {
    let history = createHistory(0);
    for (let value = 1; value <= 150; value += 1) history = pushHistory(history, value, value * 10000);
    expect(history.past).toHaveLength(100);
  });
});
