import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfilePhotoCard } from "@/components/profile/profile-photo-card";
import { ProfileOverview } from "@/components/profile/profile-overview";
import type { Profile } from "@/lib/profile";

vi.mock("@/components/profile/profile-identity", () => ({
  ProfileAvatar: () => null,
  useProfileIdentity: () => ({ photoUrl: null, refresh: vi.fn() }),
}));

const profile = {
  identity: { full_name: "Alex Martin", headline: "Data Engineer", email: "alex@b.fr", phone: "06 00", location: "Paris", availability: "Immédiate", summary: "Construit des pipelines.", links: [{ label: "GitHub", url: "https://github.com/alex" }, { label: "Piège", url: "javascript:alert(1)" }] },
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
  languages: [{ name: "Anglais", level: "C1" }],
  soft_skills: ["Rigueur"],
  interests: ["Lecture"],
} as unknown as Profile;

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
