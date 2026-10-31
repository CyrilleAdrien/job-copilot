import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StepProgress } from "@/components/ui/step-progress";
import { TagInput } from "@/components/ui/tag-input";
import { isActive } from "@/lib/navigation";

describe("Button", () => {
  it("is disabled and busy while loading", () => {
    render(<Button loading>Enregistrer</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("StatusBadge", () => {
  it("shows the French label of the status", () => {
    render(<StatusBadge status="interview" />);
    expect(screen.getByText("Entretien")).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("links the error message to the field", () => {
    render(<Input label="Rayon" error="Saisis un nombre." />);
    const input = screen.getByLabelText("Rayon");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Saisis un nombre.");
  });
});

describe("SegmentedControl", () => {
  function Demo() {
    const [value, setValue] = useState<"1" | "7">("7");
    return (
      <SegmentedControl
        label="Date de publication"
        value={value}
        onChange={setValue}
        segments={[
          { value: "1", label: "24 h" },
          { value: "7", label: "7 j" },
        ]}
      />
    );
  }

  it("selects the clicked segment", async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole("radio", { name: "24 h" }));
    expect(screen.getByRole("radio", { name: "24 h" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "7 j" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("StepProgress", () => {
  it("marks steps as done, active and pending", () => {
    const steps = [
      { id: "a", label: "Lecture" },
      { id: "b", label: "Rédaction" },
      { id: "c", label: "Mise en page" },
    ];
    render(<StepProgress steps={steps} current={1} />);
    expect(screen.getByText("Lecture").closest("li")).toHaveAttribute("data-state", "done");
    expect(screen.getByText("Rédaction").closest("li")).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Mise en page").closest("li")).toHaveAttribute("data-state", "pending");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });
});

describe("isActive", () => {
  it("matches the home route exactly and nested routes by prefix", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/offres", "/")).toBe(false);
    expect(isActive("/offres/42", "/offres")).toBe(true);
    expect(isActive("/offres-archive", "/offres")).toBe(false);
  });
});

describe("TagInput", () => {
  function Demo() {
    const [value, setValue] = useState<string[]>([]);
    return <TagInput label="Langues" value={value} onChange={setValue} suggestions={["Français", "Anglais"]} />;
  }

  it("adds a suggestion picked with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.type(screen.getByRole("combobox", { name: "Langues" }), "ang");
    expect(screen.getByRole("option", { name: "Anglais" })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByRole("button", { name: "Retirer Anglais" })).toBeInTheDocument();
  });
});
