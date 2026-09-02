import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { RovingTabList } from "./RovingTabList";

afterEach(() => cleanup());

function NestedTab({
  value,
  active,
  disabled = false,
  onSelect,
}: {
  value: string;
  active: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => onSelect(value)}
    >
      {value}
    </button>
  );
}

function Harness() {
  const [active, setActive] = useState("uno");
  return (
    <RovingTabList aria-label="Secciones de prueba">
      <NestedTab value="uno" active={active === "uno"} onSelect={setActive} />
      <NestedTab
        value="dos"
        active={active === "dos"}
        disabled
        onSelect={setActive}
      />
      <NestedTab value="tres" active={active === "tres"} onSelect={setActive} />
    </RovingTabList>
  );
}

describe("RovingTabList · A11Y-01", () => {
  it("mantiene un solo tab stop aun con botones dentro de componentes hijos", () => {
    render(<Harness />);
    const tabs = screen.getAllByRole("tab");

    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
  });

  it("recorre sólo tabs habilitadas con flechas y activa al enfocar", () => {
    render(<Harness />);
    const [uno, , tres] = screen.getAllByRole("tab");
    uno.focus();

    fireEvent.keyDown(uno, { key: "ArrowRight" });
    expect(tres).toHaveFocus();
    expect(tres).toHaveAttribute("aria-selected", "true");
    expect(tres.tabIndex).toBe(0);

    fireEvent.keyDown(tres, { key: "ArrowDown" });
    expect(uno).toHaveFocus();
    expect(uno).toHaveAttribute("aria-selected", "true");
  });

  it("soporta Home y End sin secuestrar teclas de texto", () => {
    render(<Harness />);
    const [uno, , tres] = screen.getAllByRole("tab");
    uno.focus();

    fireEvent.keyDown(uno, { key: "End" });
    expect(tres).toHaveFocus();

    fireEvent.keyDown(tres, { key: "Home" });
    expect(uno).toHaveFocus();

    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    uno.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
