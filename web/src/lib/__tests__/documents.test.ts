import { describe, expect, it } from "vitest";

import {
  currentStep,
  paragraphsToText,
  textToParagraphs,
  type Generation,
  type GenerationStep,
} from "@/lib/documents";

function generation(states: GenerationStep["state"][]): Generation {
  return {
    steps: states.map((state, index) => ({ key: String(index), label: String(index), state })),
  } as Generation;
}

describe("currentStep", () => {
  it("pointe la première étape non terminée", () => {
    expect(currentStep(generation(["done", "running", "pending", "pending"]))).toBe(1);
  });
  it("vaut le nombre d'étapes quand tout est fini", () => {
    expect(currentStep(generation(["done", "done"]))).toBe(2);
  });
});

describe("paragraphes de la lettre", () => {
  it("sépare sur les lignes vides et recolle les retours simples", () => {
    expect(textToParagraphs("Un\ndeux.\n\n\nTrois.\n  \n")).toEqual(["Un deux.", "Trois."]);
  });
  it("fait l'aller-retour", () => {
    const paragraphs = ["Premier.", "Second."];
    expect(textToParagraphs(paragraphsToText(paragraphs))).toEqual(paragraphs);
  });
});
