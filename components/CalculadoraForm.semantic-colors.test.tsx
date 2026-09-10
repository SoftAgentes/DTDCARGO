import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CalculadoraForm } from "./CalculadoraForm";
afterEach(cleanup);
function fill(cbm: string, weight: string) {
  fireEvent.change(screen.getByPlaceholderText("12"), { target: { value: cbm } });
  fireEvent.change(screen.getByPlaceholderText("4800"), { target: { value: weight } });
}
describe("SDD-0441 · avisos comerciales sin falsa alarma", () => {
  it("asocia el recargo al campo sin marcarlo como inválido y lo retira al corregir el peso", () => {
    render(<CalculadoraForm directWhatsApp />);
    fill("1", "1500");
    const input = screen.getByPlaceholderText("4800");
    const message = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(message).toHaveTextContent(/el estimado incluye su recargo/i);
    expect(message).toHaveAttribute("role", "status");
    expect(message).toHaveStyle({color: "var(--color-on-accent)"});
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    fill("1", "500");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
  it("conserva la derivación al asesor y usa advertencia dorada al superar el contenedor", () => {
    render(<CalculadoraForm directWhatsApp />);
    fill("1", "30000");
    const input = screen.getByPlaceholderText("4800");
    const message = document.getElementById(input.getAttribute("aria-describedby")!)!;
    expect(message).toHaveTextContent(/consulta a tu asesor/);
    expect(message.querySelector("svg")).toHaveStyle({color: "var(--color-status-warning)"});
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(message).toHaveAttribute("role", "status");
  });
  it("dejar el peso pendiente no activa error ni colorea el aviso como marca", () => {
    render(<CalculadoraForm directWhatsApp />);
    fill("1", "");
    const input = screen.getByPlaceholderText("4800");
    const message = document.getElementById(input.getAttribute("aria-describedby")!)!;
    expect(message).not.toBeNull();
    expect(message.querySelector("svg")).toHaveStyle({color: "var(--color-on-accent)"});
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
