import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { SegmentedControl } from "./SegmentedControl";
import { LLMModeToggle, type LLMMode } from "../../(app)/marketing/noticias-web/_components/LLMModeToggle";

afterEach(() => cleanup());

function Harness() {
  const [value, setValue] = useState("auto");
  return (
    <SegmentedControl
      value={value}
      onChange={setValue}
      ariaLabel="Modo de prueba"
      options={[
        { value: "auto", label: "Auto" },
        { value: "blocked", label: "Bloqueado", disabled: true },
        { value: "manual", label: "Manual" },
      ]}
      variant="pills"
    />
  );
}

describe("SegmentedControl · A11Y-01", () => {
  it("expone radiogroup y un solo tab stop", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Modo de prueba" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
  });

  it("recorre opciones habilitadas con flechas y Home/End", () => {
    render(<Harness />);
    const [auto, , manual] = screen.getAllByRole("radio");
    auto.focus();

    fireEvent.keyDown(auto, { key: "ArrowRight" });
    expect(manual).toHaveFocus();
    expect(manual).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(manual, { key: "Home" });
    expect(auto).toHaveFocus();
    expect(auto).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(auto, { key: "End" });
    expect(manual).toHaveFocus();
  });

  it("mantiene accesible el wrapper deprecated durante la migración", () => {
    const onChange = () => {};
    render(
      <LLMModeToggle
        mode={"auto" satisfies LLMMode}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("radiogroup", { name: "Modo de generación" }),
    ).toBeInTheDocument();
  });
});
