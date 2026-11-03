import { describe, expect, it } from "vitest";

import { defaultLayout, EXTRA_LINES, HEADER_ELEMENTS, moveKey, orderedSections, setLabel, toggleHidden } from "@/lib/cv-layout";
import { cvView, emptyProfile, emptySearch, emptyExperience } from "@/lib/profile";

function view() {
  const profile = emptyProfile();
  const { cv } = profile.searches[0];
  cv.summary = "Résumé";
  cv.experiences = [{ ...emptyExperience(), title: "A", company: "B", start: "2024-01" }];
  cv.projects = [{ name: "Projet", technologies: [] }];
  cv.custom_sections = [{ title: "Conférences", items: ["DevOps Days"] }, { title: "Vide", items: [] }];
  cv.interests = ["Football"];
  return cvView(profile, 0);
}

const keys = (sections: { key: string }[]) => sections.map((section) => section.key);

describe("disposition du CV", () => {
  it("masque par défaut les informations privées", () => {
    expect(defaultLayout().hidden).toEqual(["address", "birth_date", "nationality", "referees"]);
    expect(emptySearch().cv_layout.hidden).toEqual(defaultLayout().hidden);
  });

  it("ne propose que les rubriques qui ont un contenu, dans l'ordre classique", () => {
    expect(keys(orderedSections(view(), defaultLayout()))).toEqual(["profile", "experience", "projects", "custom:Conférences", "extras"]);
  });

  it("suit l'ordre choisi et complète avec les rubriques oubliées", () => {
    const layout = { ...defaultLayout(), order: ["projects", "ancienne", "experience"] };
    expect(keys(orderedSections(view(), layout))).toEqual(["projects", "experience", "profile", "custom:Conférences", "extras"]);
  });

  it("coche et décoche sans toucher au reste", () => {
    const hidden = toggleHidden(defaultLayout(), "photo");
    expect(hidden.hidden).toContain("photo");
    expect(toggleHidden(hidden, "photo").hidden).not.toContain("photo");
    expect(toggleHidden(defaultLayout(), "referees").hidden).not.toContain("referees");
  });

  it("déplace une rubrique d'un cran, sans sortir de la liste", () => {
    expect(moveKey(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveKey(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveKey(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveKey(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });

  it("garde un nom par langue, et un nom vide rend le nom par défaut", () => {
    let layout = setLabel(defaultLayout(), "skills", "fr", "Savoir-faire");
    layout = setLabel(layout, "skills", "en", "Know-how");
    expect(layout.labels.skills).toEqual({ fr: "Savoir-faire", en: "Know-how" });
    layout = setLabel(layout, "skills", "fr", "  ");
    expect(layout.labels.skills).toEqual({ fr: null, en: "Know-how" });
    expect(setLabel(layout, "skills", "en", "").labels.skills).toBeUndefined();
  });

  it("n'affiche dans l'en-tête que ce que le profil contient", () => {
    const current = view();
    const search = current.searches[0];
    const shown = HEADER_ELEMENTS.filter((element) => element.present(current, search)).map((element) => element.key);
    expect(shown).toEqual(["photo", "contracts"]);
    expect(EXTRA_LINES.filter((line) => line.present(current)).map((line) => line.key)).toEqual(["interests"]);
  });
});
