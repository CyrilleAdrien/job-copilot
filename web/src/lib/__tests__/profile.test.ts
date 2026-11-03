import {
  addSearch,
  applyCvView,
  cvView,
  emptyExperience,
  emptyProfile,
  emptySearch,
  mainSearch,
  skillPool,
  toPayload,
  validateBackground,
  validateExperiences,
  validateIdentity,
  validateSearch,
} from "@/lib/profile";
import { pickSearch } from "@/lib/search-choice";
import { filterSuggestions, places } from "@/lib/suggestions";

describe("validation des étapes", () => {
  it("exige le nom dans l'identité et le titre dans le CV", () => {
    const profile = emptyProfile();
    expect(Object.keys(validateIdentity(profile))).toEqual(["full_name"]);
    expect(Object.keys(validateExperiences(cvView(profile, 0)))).toEqual(["headline"]);
  });

  it("refuse un e-mail mal formé", () => {
    const profile = emptyProfile();
    profile.identity = { ...profile.identity, full_name: "A", email: "alex@" };
    expect(validateIdentity(profile)).toEqual({ email: "Adresse e-mail invalide." });
  });

  it("exige au moins un poste pour chaque recherche", () => {
    const profile = emptyProfile();
    profile.searches[0].roles = ["DevOps"];
    profile.searches.push(emptySearch("Data"));
    expect(Object.keys(validateSearch(profile))).toEqual(["1.roles"]);
  });

  it("demande les compétences à faire ressortir en mode compétences", () => {
    const profile = emptyProfile();
    profile.searches[0] = { ...profile.searches[0], roles: ["Data Engineer"], match_mode: "skills" };
    expect(validateSearch(profile)).toHaveProperty("0.focus_skills");
    profile.searches[0].technologies = ["Python"];
    expect(validateSearch(profile)).toEqual({});
  });

  it("garde au moins une recherche active", () => {
    const profile = emptyProfile();
    profile.searches[0] = { ...profile.searches[0], roles: ["DevOps"], archived: true };
    expect(validateSearch(profile)).toHaveProperty("0.archived");
    profile.searches.push({ ...emptySearch("Data"), roles: ["Data Engineer"] });
    expect(validateSearch(profile)).toEqual({});
  });

  it("contrôle les dates du bénévolat", () => {
    const profile = emptyProfile();
    profile.searches[0].cv.volunteering = [{ role: "Mentor", organization: "Asso", start: "janvier", end: "" }];
    expect(validateBackground(cvView(profile, 0))).toEqual({ "volunteering.0.start": "Format AAAA-MM." });
  });

  it("contrôle le format et l'ordre des dates d'expérience", () => {
    const profile = emptyProfile();
    profile.searches[0].cv.headline = "Titre";
    profile.searches[0].cv.experiences = [
      { ...emptyExperience(), title: "A", company: "B", start: "2024-13" },
      { ...emptyExperience(), title: "A", company: "B", start: "2025-05", end: "2024-01" },
    ];
    expect(validateExperiences(cvView(profile, 0))).toEqual({
      "0.start": "Format AAAA-MM.",
      "1.end": "La fin précède le début.",
    });
  });
});

describe("toPayload", () => {
  it("transforme les champs vides en null et retire les lignes vides", () => {
    const profile = emptyProfile();
    profile.identity.links = [{ label: "", url: "" }];
    profile.searches[0].cv.experiences = [
      {
        ...emptyExperience(),
        title: "A",
        company: "B",
        start: "2024-01",
        groups: [
          { title: "", bullets: ["Réalisation", "  ", ""] },
          { title: "", bullets: [] },
        ],
      },
    ];
    const payload = toPayload(profile);
    expect(payload.identity.email).toBeNull();
    expect(payload.identity.links).toEqual([]);
    const [experience] = payload.searches[0].cv.experiences;
    expect(experience.end).toBeNull();
    expect(experience.groups).toEqual([{ title: null, bullets: ["Réalisation"] }]);
  });

  it("retire les entrées vides des sections secondaires", () => {
    const profile = emptyProfile();
    profile.searches[0].cv.certifications = [{ name: "CKA", issuer: "", year: 2025 }, { name: " " }];
    profile.searches[0].cv.projects = [{ name: "", technologies: [] }];
    const { cv } = toPayload(profile).searches[0];
    expect(cv.certifications).toEqual([{ name: "CKA", issuer: null, year: 2025, url: null }]);
    expect(cv.projects).toEqual([]);
  });
});

describe("recherches", () => {
  it("propose les technologies de la recherche puis celles de son CV, sans doublon", () => {
    const search = { ...emptySearch("Data"), technologies: ["Python", "SQL"] };
    search.cv.skills = [{ name: "Data", items: ["python", "Airflow"] }];
    expect(skillPool(search)).toEqual(["Python", "SQL", "Airflow"]);
  });

  it("ajoute une recherche vide ou copiée d'une autre", () => {
    const profile = emptyProfile();
    profile.searches[0] = { ...profile.searches[0], id: "data", name: "Data Engineer", roles: ["Data Engineer"] };
    expect(addSearch(profile)).toBe(1);
    expect(profile.searches[1].roles).toEqual([]);
    expect(addSearch(profile, "data")).toBe(2);
    expect(profile.searches[2]).toMatchObject({ id: "", name: "Data Engineer (copie)", roles: ["Data Engineer"] });
    profile.searches[2].roles.push("Analytics Engineer");
    expect(profile.searches[0].roles).toEqual(["Data Engineer"]);
    expect(addSearch(profile, 0)).toBe(3);
  });

  it("une recherche vide part d'un CV vide, une copie reprend le CV sans le partager", () => {
    const profile = emptyProfile();
    profile.searches[0] = { ...profile.searches[0], id: "data" };
    profile.searches[0].cv.headline = "Data Engineer";
    profile.searches[0].cv.skills = [{ name: "Données", items: ["SQL"] }];
    addSearch(profile);
    expect(profile.searches[1].cv.headline).toBe("");
    addSearch(profile, "data");
    const copy = profile.searches[2];
    expect(copy.cv.headline).toBe("Data Engineer");
    copy.cv.skills[0].items.push("Airflow");
    expect(profile.searches[0].cv.skills[0].items).toEqual(["SQL"]);
  });

  it("trouve la recherche principale, jamais une archivée", () => {
    const searches = [{ ...emptySearch("A"), archived: true }, emptySearch("B"), { ...emptySearch("C"), primary: true }];
    expect(mainSearch({ searches })).toBe(2);
    searches[2] = { ...searches[2], archived: true };
    expect(mainSearch({ searches })).toBe(1);
  });

  it("une copie n'est jamais la recherche principale", () => {
    const profile = emptyProfile();
    profile.searches[0] = { ...profile.searches[0], id: "data", primary: true };
    addSearch(profile, "data");
    expect(profile.searches[1].primary).toBe(false);
  });

  it("montre le CV de la recherche choisie et les parties communes", () => {
    const profile = emptyProfile();
    profile.identity.full_name = "Alex";
    profile.languages = [{ name: "Français", level: "Natif" }];
    profile.searches = [emptySearch("Soins"), emptySearch("Vente")];
    profile.searches[0].cv.headline = "Infirmière";
    profile.searches[1].cv.headline = "Commerciale";
    const view = cvView(profile, 1);
    expect(view.identity).toMatchObject({ full_name: "Alex", headline: "Commerciale" });
    expect(view.languages).toEqual(profile.languages);
    expect(cvView(profile, 9).identity.headline).toBe("Commerciale");
  });

  it("ne reporte une modification que dans le CV de la recherche choisie", () => {
    const profile = emptyProfile();
    profile.searches = [emptySearch("Soins"), emptySearch("Vente")];
    profile.searches[0].cv.headline = "Infirmière";
    const view = cvView(structuredClone(profile), 1);
    view.identity.headline = "Commerciale";
    view.identity.full_name = "Alex";
    view.skills = [{ name: "Vente", items: ["Négociation"] }];
    view.languages = [{ name: "Anglais", level: "B2" }];
    const saved = applyCvView(view, 1);
    expect(saved.searches[0].cv.headline).toBe("Infirmière");
    expect(saved.searches[0].cv.skills).toEqual([]);
    expect(saved.searches[1].cv.headline).toBe("Commerciale");
    expect(saved.searches[1].cv.skills).toEqual(view.skills);
    expect(saved.identity.full_name).toBe("Alex");
    expect(saved.identity).not.toHaveProperty("headline");
    expect(saved.languages).toEqual(view.languages);
  });

  it("garde la recherche retenue si elle existe encore", () => {
    expect(pickSearch(["devops", "data"], "data")).toBe("data");
    expect(pickSearch(["devops", "data"], "ancienne")).toBe("devops");
    expect(pickSearch([], null)).toBeUndefined();
  });
});

describe("suggestions", () => {
  it("place d'abord ce qui commence par la saisie, sans tenir compte des accents", () => {
    expect(filterSuggestions(["Anglais", "Français", "Néerlandais"], "an")).toEqual(["Anglais", "Français", "Néerlandais"]);
    expect(filterSuggestions(["Français", "Anglais"], "fran")).toEqual(["Français"]);
  });

  it("écarte les valeurs déjà choisies", () => {
    expect(filterSuggestions(["Python", "SQL"], "", ["python"])).toEqual(["SQL"]);
  });
});

describe("places", () => {
  it("propose régions, départements et pays en plus des villes", () => {
    expect(filterSuggestions(places, "gironde")).toEqual(["Gironde (33)"]);
    expect(filterSuggestions(places, "ile")).toContain("Île-de-France");
    expect(filterSuggestions(places, "belg")).toEqual(["Belgique"]);
  });
});
