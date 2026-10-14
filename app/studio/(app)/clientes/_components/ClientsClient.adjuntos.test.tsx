/**
 * SDD-0507 · la columna «Adjuntos» del listado de clientes.
 *
 * Fija las dos mitades: que cada fila diga cuántos tiene (o «Ninguno») y que,
 * si no se pudo contar, no aparezca ningún «Ninguno» y la pantalla lo diga.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientsClient } from "./ClientsClient";
import type { Client } from "@/lib/studio/client-types";
import { conteoCliente, type ConteoCliente } from "@/lib/studio/documents/adjuntos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function cliente(i: number): Client {
  return {
    id: `c-${i}`, tenant_id: "t-1", markbox: `DTD-${1000 + i}`, name: `Cliente ${i}`,
    email: null, phone: null, address: null, rif: null, contact_name: null, tier: "regular",
    notes: null, lat: null, lng: null, registration_channel: "admin", doc_kind: null,
    doc_verify_status: null, doc_verify_source: null, doc_registry_name: null,
    doc_verified_at: null, cedula_photo_path: null, advisor_id: null, aliado_id: null,
    person_id: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    deleted_at: null,
  } as unknown as Client;
}

function renderLista(adjuntos: Record<string, ConteoCliente> | null) {
  return render(
    <ClientsClient
      clients={[cliente(0), cliente(1), cliente(2)]}
      total={3}
      limite={200}
      topeAlcanzado={false}
      filters={{ tier: "all", limite: 200 }}
      aliados={[]}
      adjuntos={adjuntos}
    />,
  );
}

const fila = (markbox: string) => screen.getByRole("row", { name: new RegExp(markbox) });

afterEach(cleanup);

describe("ClientsClient · columna «Adjuntos» (SDD-0507)", () => {
  it("cada fila dice cuántos tiene, con el desglose en title; sin entrada es cero", () => {
    renderLista({ "c-0": conteoCliente(2, 1, 2), "c-1": conteoCliente(0, 0, 0) });

    expect(screen.getByRole("columnheader", { name: "Adjuntos" })).toBeTruthy();
    const conAlgo = within(fila("DTD-1000")).getByTitle(/^5 adjuntos: 2 en su ficha/);
    expect(conAlgo.textContent).toBe("5 adjuntos");
    expect(within(fila("DTD-1001")).getByText("Ninguno")).toBeTruthy();
    // c-2 no vino en el mapa: cuenta como cero, no como «no se sabe».
    expect(within(fila("DTD-1002")).getByText("Ninguno")).toBeTruthy();
    expect(screen.queryByText("No se pudieron contar los adjuntos.")).toBeNull();
  });

  it("si no se pudo contar: sin columna, sin ningún «Ninguno», y la pantalla lo dice", () => {
    renderLista(null);

    expect(screen.queryByRole("columnheader", { name: "Adjuntos" })).toBeNull();
    expect(screen.queryByText("Ninguno")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("No se pudieron contar los adjuntos.");
  });
});
