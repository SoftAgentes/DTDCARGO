/**
 * SDD-0585 · paso 2.5 · VinculosAdmin: la salud de la cuenta y el alta de agentes.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  vincularAgente: vi.fn(async () => ({ ok: false, error: null })),
  desvincularAgente: vi.fn(async () => ({ ok: false, error: null })),
  altaAgente: vi.fn(async () => ({ ok: false, error: null })),
}));

const { VinculosAdmin } = await import("../_components/VinculosAdmin");

afterEach(cleanup);

const MIEMBROS = [
  { userId: "20000000-0000-4000-8000-000000000003", nombre: "Ana Sintética", puedeBandeja: true },
  { userId: "20000000-0000-4000-8000-000000000006", nombre: "Operaciones Sintética", puedeBandeja: false },
];

describe("VinculosAdmin · 2.5", () => {
  it("salud sana: dice cuántos admins humanos hay", () => {
    render(<VinculosAdmin vinculos={[]} miembros={[]} salud={{ alertas: [], adminsHumanos: 1, vinculosFueraDeCuenta: [] }} />);
    expect(screen.getByText(/hay 1 administrador\(es\) humano\(s\)/)).toBeTruthy();
  });

  it("sin admin humano: lo avisa con texto, no solo con color", () => {
    render(<VinculosAdmin vinculos={[]} miembros={[]} salud={{ alertas: ["sin_admin_humano"], adminsHumanos: 0, vinculosFueraDeCuenta: [] }} />);
    expect(screen.getByText(/La cuenta no tiene ningún administrador humano/)).toBeTruthy();
  });

  it("vínculos fuera de la cuenta: nombra los ids de agente", () => {
    render(<VinculosAdmin vinculos={[]} miembros={[]} salud={{ alertas: ["vinculo_fuera_de_cuenta"], adminsHumanos: 1, vinculosFueraDeCuenta: [7, 8] }} />);
    expect(screen.getByText(/ya no están en la cuenta: #7, #8/)).toBeTruthy();
  });

  it("sin salud (no se pudo calcular): no pinta la sección", () => {
    render(<VinculosAdmin vinculos={[]} miembros={[]} salud={null} />);
    expect(screen.queryByText("Salud de la bandeja")).toBeNull();
  });

  it("el alta ofrece solo a quien ve la Bandeja", () => {
    render(<VinculosAdmin vinculos={[]} miembros={MIEMBROS} />);
    const alta = screen.getByRole("button", { name: "Dar de alta" }).closest("form")!;
    const opciones = Array.from(alta.querySelectorAll("option")).map((o) => o.textContent);
    expect(opciones).toContain("Ana Sintética");
    expect(opciones).not.toContain("Operaciones Sintética");
  });

  it("sin nadie para dar de alta: lo dice y no muestra el formulario", () => {
    render(<VinculosAdmin vinculos={[]} miembros={[MIEMBROS[1]]} />);
    expect(screen.getByText("Todos los usuarios que ven la Bandeja ya tienen agente.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Dar de alta" })).toBeNull();
  });
});
