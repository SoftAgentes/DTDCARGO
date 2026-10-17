/**
 * SDD-0507 · «Todos los adjuntos» en la ficha del cliente: estados, grupos y
 * «Ver». Los datos vienen hechos (la lectura se prueba en
 * lib/studio/documents/__tests__/adjuntos-queries.test.ts).
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Adjunto, AdjuntosDelCliente } from "@/lib/studio/documents/adjuntos";
import { agruparAdjuntos } from "@/lib/studio/documents/adjuntos";

const firmar = vi.fn();
vi.mock("../../adjuntos-actions", () => ({
  firmarAdjuntoAction: (...a: unknown[]) => firmar(...a),
}));
// DocsPanel (de donde sale VersionChip) importa las acciones del hub.
vi.mock("@/app/studio/(app)/documentos/actions", () => ({
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  addDocumentVersion: vi.fn(),
  listDocumentVersionsAction: vi.fn(async () => []),
  signDocumentUrl: vi.fn(async () => null),
}));

const { TodosLosAdjuntos } = await import("../TodosLosAdjuntos");

const T = "11111111-1111-4111-8111-111111111111";
const E1 = "22222222-2222-4222-8222-222222222222";

function adj(over: Partial<Adjunto>): Adjunto {
  return {
    id: "d", bucket: "documents", visibilidad: "interno", nombre: "RIF vigente",
    tipo: "RIF", carpeta: "op-kyc", contentType: "application/pdf", sizeBytes: 320_000,
    storagePath: `${T}/client/${E1}/a.pdf`, createdAt: "2026-09-14T10:00:00Z", version: 2,
    embarqueId: null, ...over,
  };
}

function datos(): AdjuntosDelCliente {
  return agruparAdjuntos(
    [
      adj({ id: "f1" }),
      adj({
        id: "p1", bucket: "shipment-docs", visibilidad: "portal", nombre: "BL marítimo",
        tipo: "bl", carpeta: null, version: null, embarqueId: E1,
        storagePath: `${T}/${E1}/p1.pdf`, createdAt: "2026-10-06T10:00:00Z",
      }),
    ],
    [{ id: E1, code: "S-2026-0412", origin: "Yiwu", destination: "Valencia" }],
  );
}

let open: ReturnType<typeof vi.fn>;
beforeEach(() => {
  firmar.mockReset();
  open = vi.fn();
  vi.stubGlobal("open", open);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<TodosLosAdjuntos>", () => {
  it("si no se pudo leer, lo dice con role=alert", () => {
    render(<TodosLosAdjuntos datos={null} />);
    expect(screen.getByRole("alert").textContent).toContain("No se pudieron cargar los adjuntos.");
  });

  it("sin adjuntos, lo dice con palabras", () => {
    render(<TodosLosAdjuntos datos={{ total: 0, grupos: [] }} />);
    expect(
      screen.getByText("Este cliente todavía no tiene adjuntos, ni en su ficha ni en sus embarques."),
    ).toBeTruthy();
  });

  it("agrupa por origen, enlaza el embarque y marca quién lo ve", () => {
    render(<TodosLosAdjuntos datos={datos()} />);
    const seccion = screen.getByRole("region", { name: "Todos los adjuntos" });
    expect(within(seccion).getByText("2")).toBeTruthy(); // total junto al título

    const grupos = within(seccion).getAllByRole("heading", { level: 3 });
    expect(grupos[0].textContent).toBe("En la ficha del cliente1");
    expect(within(grupos[1]).getByRole("link").getAttribute("href")).toBe(`/studio/tracking/${E1}`);
    expect(grupos[1].textContent).toContain("S-2026-0412");
    expect(grupos[1].textContent).toContain("Yiwu → Valencia");

    const filas = within(seccion).getAllByRole("listitem");
    expect(within(filas[0]).getByText("Interno")).toBeTruthy();
    expect(within(filas[0]).getByText("v2")).toBeTruthy();
    expect(filas[0].textContent).toContain("RIF · Clientes · KYC & RIF · 313 KB");
    expect(within(filas[1]).getByText("Portal")).toBeTruthy();
    expect(filas[1].textContent).toContain("BL marítimo");
  });

  it("«Ver» firma con el bucket y la ruta de la fila y abre la URL", async () => {
    firmar.mockResolvedValue("https://firmada.local/x");
    render(<TodosLosAdjuntos datos={datos()} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver BL marítimo" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(firmar).toHaveBeenCalledWith("shipment-docs", `${T}/${E1}/p1.pdf`);
    expect(open).toHaveBeenCalledWith("https://firmada.local/x", "_blank", "noopener,noreferrer");
  });

  it("si no se pudo firmar, lo dice en la fila y no abre nada", async () => {
    firmar.mockResolvedValue(null);
    render(<TodosLosAdjuntos datos={datos()} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver RIF vigente" }));
    expect(await screen.findByText(/No se pudo abrir el archivo/)).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
  });
});
