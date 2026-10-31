import {
  emptyExperience,
  emptyProfile,
  emptySearch,
  skillPool,
  toPayload,
  validateBackground,
  validateExperiences,
  validateIdentity,
  validateSearch,
} from "@/lib/profile";
import { pickSearch } from "@/lib/search-choice";
import { filterSuggestions } from "@/lib/suggestions";

describe("validation des étapes", () => {
  it("exige le nom et le titre", () => {
    expect(Object.keys(validateIdentity(emptyProfile()))).toEqual(["full_name", "headline"]);
  });

  it("refuse un e-mail mal formé", () => {
    const profile = emptyProfile();
    profile.identity = { ...profile.identity, full_name: "A", headline: "B", email: "alex@" };
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

  it("contrôle les dates du bénévolat", () => {
    const profile = emptyProfile();
    profile.volunteering = [{ role: "Mentor", organization: "Asso", start: "janvier", end: "" }];
    expect(validateBackground(profile)).toEqual({ "volunteering.0.start": "Format AAAA-MM." });
  });

  it("contrôle le format et l'ordre des dates d'expérience", () => {
    const profile = emptyProfile();
    profile.experiences = [
      { ...emptyExperience(), title: "A", company: "B", start: "2024-13" },
      { ...emptyExperience(), title: "A", company: "B", start: "2025-05", end: "2024-01" },
    ];
    expect(validateExperiences(profile)).toEqual({
      "0.start": "Format AAAA-MM.",
      "1.end": "La fin précède le début.",
    });
  });
});

describe("toPayload", () => {
  it("transforme les champs vides en null et retire les lignes vides", () => {
    const profile = emptyProfile();
    profile.identity.links = [{ label: "", url: "" }];
    profile.experiences = [
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
    expect(payload.experiences[0].end).toBeNull();
    expect(payload.experiences[0].groups).toEqual([{ title: null, bullets: ["Réalisation"] }]);
  });

  it("retire les entrées vides des sections secondaires", () => {
    const profile = emptyProfile();
    profile.certifications = [{ name: "CKA", issuer: "", year: 2025 }, { name: " " }];
    profile.projects = [{ name: "", technologies: [] }];
    const payload = toPayload(profile);
    expect(payload.certifications).toEqual([{ name: "CKA", issuer: null, year: 2025, url: null }]);
    expect(payload.projects).toEqual([]);
  });
});

describe("recherches", () => {
  it("propose les technologies de la recherche puis celles du profil, sans doublon", () => {
    const profile = emptyProfile();
    profile.skills = [{ name: "Data", items: ["python", "Airflow"] }];
    const search = { ...emptySearch("Data"), technologies: ["Python", "SQL"] };
    expect(skillPool(profile, search)).toEqual(["Python", "SQL", "Airflow"]);
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
