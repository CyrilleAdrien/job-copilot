import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { placeFloating } from "@/components/ui/floating";
import { Menu } from "@/components/ui/menu";

const viewport = { width: 1000, height: 800 };
const panel = { width: 240, height: 200 };

describe("placeFloating", () => {
  it("opens under the button when there is room", () => {
    expect(placeFloating({ top: 100, bottom: 140, left: 50, right: 150 }, panel, viewport, "start")).toEqual({ top: 146, left: 50, maxHeight: null });
  });

  it("aligns on the right edge of the button", () => {
    expect(placeFloating({ top: 100, bottom: 140, left: 500, right: 600 }, panel, viewport, "end").left).toBe(360);
  });

  it("opens above the button near the bottom of the screen", () => {
    expect(placeFloating({ top: 700, bottom: 740, left: 50, right: 150 }, panel, viewport, "start")).toEqual({ top: 494, left: 50, maxHeight: null });
  });

  it("stays inside the screen horizontally", () => {
    expect(placeFloating({ top: 100, bottom: 140, left: 900, right: 990 }, panel, viewport, "start").left).toBe(752);
    expect(placeFloating({ top: 100, bottom: 140, left: 10, right: 60 }, panel, viewport, "end").left).toBe(8);
  });

  it("limits the height when neither side has room", () => {
    const tall = { width: 240, height: 700 };
    expect(placeFloating({ top: 380, bottom: 420, left: 50, right: 150 }, tall, viewport, "start")).toEqual({ top: 426, left: 50, maxHeight: 366 });
  });
});

describe("Menu", () => {
  const items = [{ label: "Passer à « Entretien »", onSelect: () => {} }];

  it("is not clipped by a parent that hides its overflow", async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="clipping" style={{ overflow: "hidden" }}>
        <Menu label="Statut" trigger="Statut" items={items} />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Statut" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByTestId("clipping")).not.toContainElement(screen.getByRole("menu"));
  });

  it("closes on an outside click and on Escape", async () => {
    const user = userEvent.setup();
    render(<Menu label="Statut" trigger="Statut" items={items} />);
    await user.click(screen.getByRole("button", { name: "Statut" }));
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Statut" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});
