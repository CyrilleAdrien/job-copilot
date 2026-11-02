import { render, screen } from "@testing-library/react";
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
  experiences: [{ title: "Ingénieur", company: "Nimbus", start: "2024-11", end: "2026-10", technologies: ["Python"], groups: [{ bullets: ["Détail réservé au CV"] }] }],
  education: [{ degree: "Master", school: "ESEO", year: 2024 }],
  skills: [],
  certifications: [],
  projects: [],
  volunteering: [],
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

  it("sums up the profile without the CV details or archived searches", () => {
    render(<ProfileOverview profile={profile} now={new Date(2026, 10, 2)} />);
    expect(screen.getByText("2 ans")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ingénieur/ })).toBeInTheDocument();
    expect(screen.getByText("Master")).toBeInTheDocument();
    expect(screen.getByText("Rigueur")).toBeInTheDocument();
    expect(screen.queryByText("Détail réservé au CV")).not.toBeInTheDocument();
    expect(screen.queryByText("Serveur")).not.toBeInTheDocument();
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
