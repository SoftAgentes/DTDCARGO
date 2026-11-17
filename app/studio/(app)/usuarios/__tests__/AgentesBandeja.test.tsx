/**
 * SDD-0585 · paso 2.5 · AgentesBandeja: la salud de la cuenta y el alta de agentes.
 * SDD-0655: el componente (antes VinculosAdmin) se mudó de la Bandeja a Usuarios.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const desvincular = vi.fn<(prev: unknown, fd: FormData) => Promise<{ ok: boolean; error: null }>>(async () => ({ ok: true, error: null }));
vi.mock("../../bandeja/actions", () => ({
  vincularAgente: vi.fn(async () => ({ ok: false, error: null })),
  desvincularAgente: (prev: unknown, fd: FormData) => desvincular(prev, fd),
  altaAgente: vi.fn(async () => ({ ok: false, error: null })),
}));

const { AgentesBandeja } = await import("../_components/AgentesBandeja");

afterEach(cleanup);

const MIEMBROS = [
  { userId: "20000000-0000-4000-8000-000000000003", nombre: "Ana Sintética", puedeBandeja: true },
  { userId: "20000000-0000-4000-8000-000000000006", nombre: "Operaciones Sintética", puedeBandeja: false },
];

describe("AgentesBandeja · 2.5", () => {
  it("salud sana: dice cuántos admins humanos hay", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[]} salud={{ alertas: [], adminsHumanos: 1, vinculosFueraDeCuenta: [] }} />);
    expect(screen.getByText(/hay 1 administrador\(es\) humano\(s\)/)).toBeTruthy();
  });

  it("sin admin humano: lo avisa con texto, no solo con color", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[]} salud={{ alertas: ["sin_admin_humano"], adminsHumanos: 0, vinculosFueraDeCuenta: [] }} />);
    expect(screen.getByText(/La cuenta no tiene ningún administrador humano/)).toBeTruthy();
  });

  it("vínculos fuera de la cuenta: nombra los ids de agente", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[]} salud={{ alertas: ["vinculo_fuera_de_cuenta"], adminsHumanos: 1, vinculosFueraDeCuenta: [7, 8] }} />);
    expect(screen.getByText(/ya no están en la cuenta: #7, #8/)).toBeTruthy();
  });

  it("sin salud (no se pudo calcular): no pinta la sección", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[]} salud={null} />);
    expect(screen.queryByText("Salud de la bandeja")).toBeNull();
  });

  it("el alta ofrece solo a quien ve la Bandeja", () => {
    render(<AgentesBandeja vinculos={[]} miembros={MIEMBROS} />);
    const alta = screen.getByRole("button", { name: "Dar de alta" }).closest("form")!;
    const opciones = Array.from(alta.querySelectorAll("option")).map((o) => o.textContent);
    expect(opciones).toContain("Ana Sintética");
    expect(opciones).not.toContain("Operaciones Sintética");
  });

  it("sin nadie para dar de alta: lo dice y no muestra el formulario", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[MIEMBROS[1]]} />);
    expect(screen.getByText("Todos los usuarios que ven la Bandeja ya tienen agente.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Dar de alta" })).toBeNull();
  });
});

describe("AgentesBandeja en Usuarios (SDD-0655)", () => {
  it("dice qué hace: vincular el usuario de Studio con su agente para abrir la Bandeja con su sesión", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[]} />);
    expect(screen.getByRole("heading", { name: "Agentes vinculados" })).toBeTruthy();
    expect(
      screen.getByText("Vincula tu usuario del Studio con tu agente de Chatwoot para abrir la Bandeja con tu sesión."),
    ).toBeTruthy();
  });

  it("lista los vínculos y ofrece a los miembros sin vínculo (misma lógica que en la Bandeja)", () => {
    render(<AgentesBandeja vinculos={[{ userId: "u1", nombre: "Ana", chatwootUserId: 7 }]} miembros={[{ userId: "u2", nombre: "Luis" }]} />);
    expect(screen.getByText("#7")).toBeTruthy();
    const vincular = screen.getByRole("button", { name: "Vincular" }).closest("form")!;
    expect(within(vincular).getByRole("option", { name: "Luis" })).toBeTruthy();
  });

  it("desvincular pide confirmación y solo borra al confirmar", async () => {
    desvincular.mockClear();
    render(<AgentesBandeja vinculos={[{ userId: "u1", nombre: "Ana", chatwootUserId: 7 }]} miembros={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Desvincular" }));
    expect(desvincular).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).toContain("Ana ya no podrá abrir la bandeja");
    const botones = Array.from(dialogo.querySelectorAll("button")).filter((b) => b.textContent === "Desvincular");
    await userEvent.click(botones[botones.length - 1]);
    await waitFor(() => expect(desvincular).toHaveBeenCalledTimes(1));
    expect((desvincular.mock.calls[0][1] as FormData).get("user_id")).toBe("u1");
  });
});
