import { describe, expect, it } from "vitest";

import { cleanCv, contactLabel, contentLines, contentSections, headerElements, layoutOf, normalizeCv, withLayout, type CvContent } from "@/lib/cv-content";

const base: CvContent = {
  language: "fr",
  name: "Alex",
  headline: "Titre",
  show_photo: true,
  contact: [
    { text: "Lyon", kind: "location" },
    { text: "GitHub", url: "https://github.com/a", kind: "github" },
    { text: "LinkedIn", url: "https://linkedin.com/in/a", kind: "linkedin" },
    { text: "1 rue", kind: "address" },
  ],
  details: ["CDI"],
  highlight: "Immédiate",
  summary: "Résumé",
  skills: [{ name: "Data", items: ["SQL"] }],
  experiences: [{ title: "Poste", company: "Acme", period: "2024", groups: [{ bullets: ["Un"] }] }],
  education: [],
  sections: [{ key: "projects", title: "Projets", entries: [{ title: "P", meta: [] }], bullets: [] }],
  extras: [{ key: "languages", label: "Langues", text: "Français" }],
  order: ["experience", "projects", "profile", "skills", "education", "extras"],
  titles: { skills: "Savoir-faire" },
  hidden: ["address"],
  font: "Lato",
  colors: { background: "#FBF7EF", text: null, rule: "#2F6FED" },
};

describe("normalizeCv", () => {
  it("donne des clés et un ordre complet aux anciens CV", () => {
    const old = { ...base, sections: [{ ...base.sections[0], key: null }], extras: [{ label: "Langues", text: "Fr" }], order: [], titles: undefined, hidden: undefined } as unknown as CvContent;
    const cv = normalizeCv(old);
    expect(cv.sections[0].key).toBe("section-0");
    expect(cv.extras[0].key).toBe("line-0");
    expect(cv.order).toEqual(["profile", "skills", "experience", "education", "section-0", "extras"]);
    expect(cv.hidden).toEqual([]);
    expect(cv.titles).toEqual({});
  });

  it("garde l'ordre choisi", () => {
    expect(normalizeCv(base).order).toEqual(base.order);
  });
});

describe("affichage d'un CV généré", () => {
  it("passe du contenu aux réglages et revient sans rien perdre", () => {
    const layout = layoutOf(base);
    expect(layout.labels.skills).toEqual({ fr: "Savoir-faire" });
    expect(layout.font).toBe("Lato");
    expect(withLayout(base, layout)).toEqual(base);
  });

  it("applique un nouveau nom, et un nom vide rend le nom par défaut", () => {
    const layout = layoutOf(base);
    layout.labels.experience = { fr: "Parcours" };
    layout.labels.skills = { fr: null };
    expect(withLayout(base, layout).titles).toEqual({ experience: "Parcours" });
  });

  it("ne propose qu'une seule case pour tous les liens", () => {
    expect(headerElements(base).map((element) => element.key)).toEqual(["photo", "location", "links", "address", "availability", "contracts"]);
    expect(headerElements({ ...base, show_photo: false }).map((element) => element.key)).not.toContain("photo");
  });

  it("suit l'ordre du CV et saute les rubriques vides", () => {
    expect(contentSections(base).map((section) => section.key)).toEqual(["experience", "projects", "profile", "skills", "extras"]);
    expect(contentSections(base).find((section) => section.key === "skills")?.names.fr).toBe("Compétences");
    expect(contentLines(base).map((line) => line.key)).toEqual(["languages"]);
  });
});

describe("cleanCv", () => {
  it("retire les lignes vides et les thèmes sans contenu", () => {
    const cv = cleanCv({
      ...base,
      skills: [{ name: "Data", items: ["SQL", " ", ""] }, { name: "Vide", items: [""] }],
      experiences: [{ ...base.experiences[0], groups: [{ bullets: ["Un", ""] }, { title: "", bullets: [" "] }] }],
    });
    expect(cv.skills).toEqual([{ name: "Data", items: ["SQL"] }]);
    expect(cv.experiences[0].groups).toEqual([{ bullets: ["Un"] }]);
  });
});

describe("contactLabel", () => {
  it("nomme chaque coordonnée", () => {
    expect(base.contact.map(contactLabel)).toEqual(["Ville", "Lien", "Lien", "Adresse complète"]);
    expect(contactLabel({ text: "ancien" })).toBe("Coordonnée");
  });
});
