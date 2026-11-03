import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfilePhotoCard } from "@/components/profile/profile-photo-card";
import { ProfileOverview } from "@/components/profile/profile-overview";
import { SearchPicker } from "@/components/profile/search-picker";
import type { CvView } from "@/lib/profile";

vi.mock("@/components/profile/profile-identity", () => ({
  ProfileAvatar: () => null,
  useProfileIdentity: () => ({ photoUrl: null, refresh: vi.fn() }),
}));

const profile = {
  identity: { full_name: "Alex Martin", headline: "Data Engineer", email: "alex@b.fr", phone: "06 00", location: "Paris", availability: "Immédiate", summary: "Construit des pipelines.", driving_licence: "B", birth_date: "1998-03-14", nationality: "Française", links: [{ label: "GitHub", url: "https://github.com/alex" }, { label: "Piège", url: "javascript:alert(1)" }] },
  searches: [
    { id: "a", name: "Principal", archived: false, roles: ["Data Engineer"], seniority: "mid", contract_types: ["cdi"], locations: ["Paris"], remote: "any" },
    { id: "b", name: "Ancienne", archived: true, roles: ["Serveur"], seniority: "mid", contract_types: ["cdi"], locations: [], remote: "any" },
  ],
  experiences: [{ title: "Ingénieur", company: "Nimbus", start: "2024-11", end: "2026-10", technologies: ["Python"], context: "Plateforme de paiement", groups: [{ title: "Pipelines", bullets: ["• Migré les flux"] }, { bullets: ["Réduit les coûts"] }] }],
  education: [{ degree: "Master", school: "ESEO", year: 2024, details: "Enseignements clés : Machine Learning" }],
  skills: [],
  certifications: [],
  projects: [{ name: "Copilote", description: "Suit les candidatures.", technologies: [], url: "https://example.org/copilote" }],
  volunteering: [{ role: "Mentor", organization: "Asso", description: "Accompagne des étudiants." }],
  publications: [],
  awards: [{ title: "Prix de l'innovation", issuer: "BPCE", year: 2025 }],
  courses: [{ name: "Kubernetes avancé" }],
  referees: [{ name: "Sam Durand", role: "Responsable" }],
  custom_sections: [{ title: "Conférences", items: ["DevOps Days"] }],
  languages: [{ name: "Anglais", level: "C1" }],
  soft_skills: ["Rigueur"],
  interests: ["Lecture"],
} as unknown as CvView;

describe("profile overview", () => {
  it("shows the identity and only opens web links", () => {
    render(<ProfilePhotoCard profile={profile} />);
    expect(screen.getByRole("heading", { name: "Alex Martin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "alex@b.fr" })).toHaveAttribute("href", "mailto:alex@b.fr");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/alex");
    expect(screen.queryByText("Piège")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Choisir une photo de profil")).toBeInTheDocument();
  });

  it("sums up the profile without archived searches", () => {
    render(<ProfileOverview profile={profile} now={new Date(2026, 10, 2)} />);
    expect(screen.getByText("2 ans")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ingénieur/ })).toBeInTheDocument();
    expect(screen.getByText("Master")).toBeInTheDocument();
    expect(screen.getByText("Rigueur")).toBeInTheDocument();
    expect(screen.queryByText("Serveur")).not.toBeInTheDocument();
  });

  it("details each job: context, titled groups and bullets", () => {
    render(<ProfileOverview profile={profile} />);
    expect(screen.getByText("Plateforme de paiement")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pipelines" })).toBeInTheDocument();
    expect(screen.getByText("Migré les flux")).toBeInTheDocument();
    expect(screen.getByText("Réduit les coûts")).toBeInTheDocument();
  });

  it("shows part of a long job, then the rest on demand", async () => {
    const user = userEvent.setup();
    const bullets = ["Un", "Deux", "Trois", "Quatre", "Cinq"];
    const [job] = profile.experiences;
    render(<ProfileOverview profile={{ ...profile, experiences: [{ ...job, groups: [{ bullets }] }] }} />);
    expect(screen.getByText("Trois")).toBeInTheDocument();
    expect(screen.queryByText("Quatre")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voir plus (2)" }));
    expect(screen.getByText("Cinq")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voir moins" }));
    expect(screen.queryByText("Cinq")).not.toBeInTheDocument();
  });

  it("needs no button when a job is short", () => {
    render(<ProfileOverview profile={profile} />);
    expect(screen.queryByRole("button", { name: /Voir plus/ })).not.toBeInTheDocument();
  });

  it("shows a technology once when skills are deduced from the jobs", () => {
    render(<ProfileOverview profile={profile} />);
    expect(screen.getAllByText("Python")).toHaveLength(1);
  });

  it("hides the sections that have nothing to show", () => {
    render(<ProfileOverview profile={{ ...profile, interests: [], languages: [] }} />);
    expect(screen.queryByRole("heading", { name: "Centres d'intérêt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Langues" })).not.toBeInTheDocument();
  });
});

describe("profile overview sections", () => {
  it("shows education details, descriptions and links", () => {
    render(<ProfileOverview profile={profile} />);
    expect(screen.getByText("Enseignements clés : Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("Suit les candidatures.")).toBeInTheDocument();
    expect(screen.getByText("Accompagne des étudiants.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Copilote" })).toHaveAttribute("href", "https://example.org/copilote");
  });
});

describe("CV details", () => {
  it("shows the licence, birth date and nationality in the header", () => {
    render(<ProfilePhotoCard profile={profile} />);
    expect(screen.getByText("Permis B")).toBeInTheDocument();
    expect(screen.getByText("14 mars 1998")).toBeInTheDocument();
    expect(screen.getByText("Française")).toBeInTheDocument();
  });

  it("shows the extra sections", () => {
    render(<ProfileOverview profile={profile} />);
    expect(screen.getByText("Prix de l'innovation")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes avancé")).toBeInTheDocument();
    expect(screen.getByText("Sam Durand")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conférences" })).toBeInTheDocument();
    expect(screen.getByText("DevOps Days")).toBeInTheDocument();
  });
});

describe("SearchPicker", () => {
  const searches = [
    { name: "Soins", archived: false },
    { name: "Ancienne", archived: true },
    { name: "Vente", archived: false },
  ];

  it("is hidden when a single search is active", () => {
    const { container } = render(<SearchPicker label="CV" searches={searches.slice(0, 2)} value={0} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("leaves out archived searches and reports the position in the full list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchPicker label="CV" searches={searches} value={0} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Soins" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /Ancienne/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vente" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("names the group without showing the label, unless asked", () => {
    const { rerender } = render(<SearchPicker label="CV de la recherche" searches={searches} value={0} onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "CV de la recherche" })).toBeInTheDocument();
    expect(screen.queryByText("CV de la recherche")).not.toBeInTheDocument();
    rerender(<SearchPicker label="CV de la recherche" showLabel searches={searches} value={0} onChange={vi.fn()} />);
    expect(screen.getByText("CV de la recherche")).toBeInTheDocument();
  });
});
