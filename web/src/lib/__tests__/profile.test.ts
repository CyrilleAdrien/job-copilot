import {
  emptyExperience,
  emptyProfile,
  toPayload,
  validateExperiences,
  validateIdentity,
  validateSearch,
} from "@/lib/profile";

describe("validation des étapes", () => {
  it("exige le nom et le titre", () => {
    expect(Object.keys(validateIdentity(emptyProfile()))).toEqual(["full_name", "headline"]);
  });

  it("refuse un e-mail mal formé", () => {
    const profile = emptyProfile();
    profile.identity = { ...profile.identity, full_name: "A", headline: "B", email: "alex@" };
    expect(validateIdentity(profile)).toEqual({ email: "Adresse e-mail invalide." });
  });

  it("exige au moins un poste recherché", () => {
    expect(validateSearch(emptyProfile())).toHaveProperty("roles");
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
});
