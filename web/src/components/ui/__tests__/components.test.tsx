import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StepProgress } from "@/components/ui/step-progress";
import { Modal } from "@/components/ui/modal";
import { splitTags, TagInput } from "@/components/ui/tag-input";
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

describe("splitTags", () => {
  it("does not split on a comma inside parentheses", () => {
    expect(splitTags("Python (pandas, PySpark, FastAPI), SQL, ")).toEqual(["Python (pandas, PySpark, FastAPI)", "SQL"]);
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

  it("keeps typing a comma inside parentheses", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.type(screen.getByRole("combobox", { name: "Langues" }), "Python (pandas, SQL),");
    expect(screen.getByRole("button", { name: "Retirer Python (pandas, SQL)" })).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("keeps the focus in a field when the parent renders again", async () => {
    const user = userEvent.setup();
    function Parent() {
      const [count, setCount] = useState(0);
      return (
        <Modal open onClose={() => setCount(0)} title="Fenêtre">
          <input aria-label="Nom" onChange={(event) => setCount(event.target.value.length + count)} />
        </Modal>
      );
    }
    render(<Parent />);
    await user.type(screen.getByRole("textbox", { name: "Nom" }), "abc");
    expect(screen.getByRole("textbox", { name: "Nom" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Nom" })).toHaveValue("abc");
  });

  it("closes with Escape using the latest handler", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<Modal open onClose={vi.fn()} title="Fenêtre">x</Modal>);
    rerender(<Modal open onClose={onClose} title="Fenêtre">x</Modal>);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders above the page, out of any parent", () => {
    render(
      <div data-testid="parent">
        <Modal open onClose={vi.fn()} title="Fenêtre">
          x
        </Modal>
      </div>,
    );
    expect(screen.getByTestId("parent")).not.toContainElement(screen.getByRole("dialog"));
  });
});
