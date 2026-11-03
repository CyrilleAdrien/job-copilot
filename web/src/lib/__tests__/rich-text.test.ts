import { describe, expect, it } from "vitest";

import { docToRich, parseInline, richToDoc, type RichMode, type RichNode } from "@/lib/rich-text";

const roundTrip = (value: string, mode: RichMode) => docToRich(richToDoc(value, mode), mode);

describe("parseInline", () => {
  it("lit le gras, l'italique et le souligné", () => {
    expect(parseInline("un **gras** et *penché* et __souligné__")).toEqual([
      { type: "text", text: "un " },
      { type: "text", text: "gras", marks: [{ type: "bold" }] },
      { type: "text", text: " et " },
      { type: "text", text: "penché", marks: [{ type: "italic" }] },
      { type: "text", text: " et " },
      { type: "text", text: "souligné", marks: [{ type: "underline" }] },
    ]);
  });

  it("combine les styles", () => {
    expect(parseInline("***deux***")).toEqual([{ type: "text", text: "deux", marks: [{ type: "bold" }, { type: "italic" }] }]);
  });

  it("laisse tels quels les textes techniques sans marque", () => {
    for (const text of ["5 * 3 * 2", "snake_case_name", "note ** seule", "C*", "a_b"]) {
      expect(parseInline(text)).toEqual([{ type: "text", text }]);
    }
  });

  it("respecte les caractères protégés", () => {
    expect(parseInline("\\*\\*pas gras\\*\\*")).toEqual([{ type: "text", text: "**pas gras**" }]);
  });
});

describe("aller-retour avec l'éditeur", () => {
  it.each([
    ["Un **gras** et *penché*.", "text"],
    ["Un __*mélange*__ **et** suite", "text"],
    ["Intro\n- un\n- **deux**\nFin", "text"],
    ["1. un\n2. deux", "text"],
    ["Réalisation **un**\nRéalisation deux", "list"],
    ["Une ligne **forte**", "line"],
    ["Avec \\*étoile\\* et snake\\_case", "text"],
  ] as [string, RichMode][])("garde %s", (value, mode) => {
    expect(roundTrip(value, mode)).toBe(value);
  });

  it("place les espaces hors des marques", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a " }, { type: "text", text: " mot ", marks: [{ type: "bold" as const }] }, { type: "text", text: "b" }] }] };
    expect(docToRich(doc, "text")).toBe("a  **mot** b");
  });

  it("protège une phrase qui ressemble à une liste", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "- pas une liste" }] }] };
    const saved = docToRich(doc, "text");
    expect(saved).toBe("\\- pas une liste");
    expect(richToDoc(saved, "text").content![0].type).toBe("paragraph");
  });

  it("aplatit une liste imbriquée et renumérote", () => {
    const item = (text: string, nested?: RichNode): RichNode => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }, ...(nested ? [nested] : [])] });
    const doc = { type: "doc", content: [{ type: "orderedList", content: [item("a", { type: "orderedList", content: [item("b")] }), item("c")] }] };
    expect(docToRich(doc, "text")).toBe("1. a\n2. b\n3. c");
  });

  it("en mode ligne, tout tient sur une ligne", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }, { type: "paragraph", content: [{ type: "text", text: "b" }] }] };
    expect(docToRich(doc, "line")).toBe("a b");
  });

  it("ne garde pas de ligne vide à la fin", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }, { type: "paragraph" }] };
    expect(docToRich(doc, "text")).toBe("a");
  });
});
