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
    const alta = screen.getByRole("button", { name: "Crear y vincular" }).closest("form")!;
    const opciones = Array.from(alta.querySelectorAll("option")).map((o) => o.textContent);
    expect(opciones).toContain("Ana Sintética");
    expect(opciones).not.toContain("Operaciones Sintética");
  });

  it("sin nadie para dar de alta: lo dice y no muestra el formulario", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[MIEMBROS[1]]} />);
    expect(screen.getByText("Todos los usuarios que ven la Bandeja ya tienen agente.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Crear y vincular" })).toBeNull();
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

describe("AgentesBandeja · rediseño (SDD-0680, variante 1)", () => {
  const AGENTES = [
    { id: 2, nombre: "Ana Sintética", correo: "ana@ejemplo.test", rol: "administrator" as const },
    { id: 11, nombre: "Zoe Sintética", correo: "zoe@ejemplo.test", rol: "agent" as const },
    { id: 12, nombre: "Luis Sintético", correo: "luis@ejemplo.test", rol: "agent" as const },
  ];

  it("los vínculos van en una tabla: persona ↔ agente con nombre, correo, número y rol; «Desvincular» en su columna", () => {
    render(
      <AgentesBandeja
        vinculos={[{ userId: "u1", nombre: "Ana", chatwootUserId: 2, agente: AGENTES[0] }]}
        miembros={[]}
        agentes={AGENTES}
      />,
    );
    const tabla = screen.getByRole("table");
    const cabeceras = within(tabla).getAllByRole("columnheader").map((c) => c.textContent);
    expect(cabeceras).toEqual(["Persona de Studio", "vinculado con", "Agente en Chatwoot", "Rol", "Acción"]);
    const fila = within(tabla).getAllByRole("row")[1];
    const celdas = within(fila).getAllByRole("cell");
    expect(celdas[0].textContent).toBe("Ana");
    expect(celdas[2].textContent).toContain("Ana Sintética");
    expect(celdas[2].textContent).toContain("#2");
    expect(celdas[2].textContent).toContain("ana@ejemplo.test");
    expect(celdas[3].textContent).toBe("Administrador");
    expect(within(celdas[4]).getByRole("button", { name: "Desvincular" })).toBeTruthy();
  });

  it("vincular y crear son dos tarjetas separadas, cada una con su título", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[{ userId: "u2", nombre: "Luis", puedeBandeja: true }]} agentes={AGENTES} />);
    const vincular = screen.getByRole("region", { name: "Ya tiene agente en Chatwoot: vincularlo" });
    const alta = screen.getByRole("region", { name: "No tiene agente: crearlo en Chatwoot" });
    expect(within(vincular).getByRole("button", { name: "Vincular" })).toBeTruthy();
    expect(within(vincular).queryByRole("button", { name: "Crear y vincular" })).toBeNull();
    expect(within(alta).getByRole("button", { name: "Crear y vincular" })).toBeTruthy();
    expect(within(alta).queryByRole("button", { name: "Vincular" })).toBeNull();
  });

  it("el agente se elige por nombre y correo, sin los ya vinculados; el del mismo correo va primero y queda elegido", async () => {
    render(
      <AgentesBandeja
        vinculos={[{ userId: "u1", nombre: "Ana", chatwootUserId: 2, agente: AGENTES[0] }]}
        miembros={[{ userId: "u3", nombre: "Luis", correo: "LUIS@ejemplo.test" }]}
        agentes={AGENTES}
      />,
    );
    expect(screen.queryByLabelText(/Número del agente/)).toBeNull();
    const vincular = screen.getByRole("region", { name: "Ya tiene agente en Chatwoot: vincularlo" });
    await userEvent.selectOptions(within(vincular).getByLabelText(/^Persona de Studio/), "u3");
    const agente = within(vincular).getByLabelText(/Agente de Chatwoot/) as HTMLSelectElement;
    const opciones = Array.from(agente.querySelectorAll("option")).slice(1).map((o) => o.textContent);
    expect(opciones).toEqual(["Luis Sintético · luis@ejemplo.test (#12)", "Zoe Sintética · zoe@ejemplo.test (#11)"]);
    expect(agente.value).toBe("12");
    expect(agente.name).toBe("chatwoot_user_id");
  });

  it("si Chatwoot no respondió, pide el número con una ayuda que dice dónde verlo", () => {
    render(<AgentesBandeja vinculos={[]} miembros={[{ userId: "u3", nombre: "Luis" }]} agentes={null} />);
    const numero = screen.getByLabelText(/Número del agente en Chatwoot/) as HTMLInputElement;
    expect(numero.name).toBe("chatwoot_user_id");
    const ayuda = document.getElementById(numero.getAttribute("aria-describedby")!)!;
    expect(ayuda.textContent).toContain("Chatwoot › Ajustes › Agentes");
  });

  it("si todos los agentes ya tienen vínculo, lo dice y manda a crear", () => {
    render(
      <AgentesBandeja
        vinculos={[{ userId: "u1", nombre: "Ana", chatwootUserId: 2 }]}
        miembros={[{ userId: "u3", nombre: "Luis" }]}
        agentes={[AGENTES[0]]}
      />,
    );
    expect(screen.getByText(/Todos los agentes de la cuenta ya tienen vínculo/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vincular" })).toBeNull();
  });

  it("los botones conservan el ancho (BTN-01 §5): reposo y espera en la misma celda", () => {
    render(<AgentesBandeja vinculos={[{ userId: "u1", nombre: "Ana", chatwootUserId: 2 }]} miembros={[{ userId: "u3", nombre: "Luis" }]} agentes={AGENTES} />);
    for (const nombre of ["Desvincular", "Vincular", "Crear y vincular"]) {
      const boton = screen.getByRole("button", { name: nombre });
      const [reposo, espera] = Array.from(boton.children) as HTMLElement[];
      expect(reposo.style.gridArea).toBe("1 / 1");
      expect(espera.style.gridArea).toBe("1 / 1");
      expect(espera.style.visibility).toBe("hidden");
    }
  });

  it("con la lista incompleta ofrece «Otro agente», que pide el número y deja el select sin nombre", async () => {
    render(
      <AgentesBandeja
        vinculos={[]}
        miembros={[{ userId: "u3", nombre: "Luis" }]}
        agentes={[AGENTES[1]]}
        agentesCompletos={false}
      />,
    );
    const vincular = screen.getByRole("region", { name: "Ya tiene agente en Chatwoot: vincularlo" });
    await userEvent.selectOptions(within(vincular).getByLabelText(/^Persona de Studio/), "u3");
    const agente = within(vincular).getByLabelText(/Agente de Chatwoot/) as HTMLSelectElement;
    expect(within(vincular).getByText(/No pudimos leer todos los agentes/)).toBeTruthy();
    await userEvent.selectOptions(agente, "otro");
    expect(agente.name).toBe("");
    const numero = within(vincular).getByLabelText(/Número del agente en Chatwoot/) as HTMLInputElement;
    expect(numero.name).toBe("chatwoot_user_id");
  });

  it("con la lista incompleta no dice que todos tienen vínculo: pide el número", () => {
    render(
      <AgentesBandeja
        vinculos={[{ userId: "u1", nombre: "Ana", chatwootUserId: 2 }]}
        miembros={[{ userId: "u3", nombre: "Luis" }]}
        agentes={[AGENTES[0]]}
        agentesCompletos={false}
      />,
    );
    expect(screen.queryByText(/Todos los agentes de la cuenta ya tienen vínculo/)).toBeNull();
    expect(screen.getByRole("button", { name: "Vincular" })).toBeTruthy();
    expect((screen.getByLabelText(/Número del agente en Chatwoot/) as HTMLInputElement).name).toBe("chatwoot_user_id");
  });
});
