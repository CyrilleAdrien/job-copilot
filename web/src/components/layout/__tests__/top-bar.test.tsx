import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreateMenu } from "@/components/layout/create-menu";
import { TopBar } from "@/components/layout/top-bar";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/", useSearchParams: () => new URLSearchParams("q=data") }));
vi.mock("@/components/ui/theme-toggle", () => ({ ThemeToggle: () => null }));

describe("TopBar", () => {
  it("shows the current search and sends a new one to the offers", async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    const box = screen.getByRole("searchbox", { name: "Rechercher une offre" });
    expect(box).toHaveValue("data");
    await user.clear(box);
    await user.type(box, "data & cloud{Enter}");
    expect(push).toHaveBeenLastCalledWith("/offres?q=data%20%26%20cloud");
    await user.clear(box);
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenLastCalledWith("/offres");
  });
});

describe("CreateMenu", () => {
  it("offers what can be created, each with its own page", async () => {
    const user = userEvent.setup();
    render(<CreateMenu collapsed={false} />);
    await user.click(screen.getByRole("button", { name: "Créer" }));
    expect(screen.getByRole("menuitem", { name: "Nouveau message" })).toHaveAttribute("href", "/boite-de-reception?nouveau=1");
    expect(screen.getByRole("menuitem", { name: "Nouvelle candidature" })).toHaveAttribute("href", "/candidatures?nouveau=1");
    expect(screen.getByRole("menuitem", { name: "Nouvel événement" })).toHaveAttribute("href", "/calendrier?nouveau=1");
    expect(screen.getByRole("menuitem", { name: "Nouvelle recherche" })).toHaveAttribute("href", "/bienvenue?recherche=nouvelle");
  });
});
