/**
 * SDD-0265 · el listado dice cuántos hay y deja llegar a los que no entraron.
 *
 * Antes mostraba 200 filas de 451 y no lo decía en ninguna parte, así que 251
 * clientes —los más viejos, por el orden `created_at DESC`— eran inalcanzables
 * navegando. Estos tests fijan las dos mitades del arreglo: que el número sea
 * verdadero (SGE-00.07) y que el "Ver más" no pierda los filtros.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientsClient } from "./ClientsClient";
import type { Client } from "@/lib/studio/client-types";
import type { ClientFilters } from "@/lib/studio/client-queries";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
  useSearchParams: () => mocks.params,
}));

function cliente(i: number): Client {
  return {
    id: `c-${i}`,
    tenant_id: "t-1",
    markbox: `DTD-${1000 + i}`,
    name: `Cliente ${i}`,
    email: null,
    phone: null,
    address: null,
    rif: null,
    contact_name: null,
    tier: "regular",
    notes: null,
    lat: null,
    lng: null,
    registration_channel: "admin",
    doc_kind: null,
    doc_verify_status: null,
    doc_verify_source: null,
    doc_registry_name: null,
    doc_verified_at: null,
    cedula_photo_path: null,
    advisor_id: null,
    aliado_id: null,
    person_id: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    deleted_at: null,
  } as unknown as Client;
}

const FILTROS_VACIOS: ClientFilters = { tier: "all", limite: 200 };

// El contador usa las filas recibidas; limite y topeAlcanzado vienen del servidor.
// Dos filas distinguen el plural y clients.length de total/limite; una basta
// para navegar o mostrar el techo. El remanente usa 201 para detectar un contador
// recortado al primer bloque. Conservamos los límites reales (200/400/1000)
// sin convertir estos contratos de UI en una prueba de carga de la tabla.
function renderLista(over: {
  cuantos?: number;
  total?: number;
  limite?: number;
  topeAlcanzado?: boolean;
  filters?: ClientFilters;
}) {
  const cuantos = over.cuantos ?? 2;
  return render(
    <ClientsClient
      clients={Array.from({ length: cuantos }, (_, i) => cliente(i))}
      total={over.total ?? 451}
      limite={over.limite ?? 200}
      topeAlcanzado={over.topeAlcanzado ?? false}
      filters={over.filters ?? FILTROS_VACIOS}
      aliados={[]}
      adjuntos={{}}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = new URLSearchParams();
});
afterEach(cleanup);

describe("ClientsClient · el tope deja de ser invisible (SDD-0265)", () => {
  it("dice cuántos se ven y cuántos hay", () => {
    renderLista({ cuantos: 2, total: 451 });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mostrando 2 de 451 clientes",
    );
  });

  it("cuando entran todos no habla de topes ni ofrece traer más", () => {
    renderLista({ cuantos: 2, total: 2 });
    expect(screen.getByRole("status")).toHaveTextContent("2 clientes");
    expect(screen.queryByRole("button", { name: /Ver .* más/ })).not.toBeInTheDocument();
  });

  it("el botón anuncia cuántos faltan de verdad, no un bloque redondo", () => {
    // 252 - 201 = 51: supera el primer bloque y cuenta lo recibido, no el limite.
    renderLista({ cuantos: 201, total: 252, limite: 400 });
    expect(screen.getByRole("button", { name: "Ver 51 más" })).toBeVisible();
  });

  it("«Ver más» sube un bloque y CONSERVA los filtros vigentes", async () => {
    mocks.params = new URLSearchParams("q=perez&tier=vip");
    const user = userEvent.setup();
    renderLista({
      cuantos: 1,
      total: 451,
      filters: { tier: "vip", q: "perez", limite: 200 },
    });

    await user.click(screen.getByRole("button", { name: "Ver 200 más" }));

    expect(mocks.push).toHaveBeenCalledTimes(1);
    const destino = new URLSearchParams(
      String(mocks.push.mock.calls[0][0]).split("?")[1],
    );
    expect(destino.get("limite")).toBe("400");
    expect(destino.get("q")).toBe("perez");
    expect(destino.get("tier")).toBe("vip");
  });

  it("no ofrece pasar del techo de PostgREST: lo dice y manda a buscar", () => {
    renderLista({
      cuantos: 1,
      total: 4200,
      limite: 1000,
      topeAlcanzado: true,
    });

    expect(screen.queryByRole("button", { name: /Ver .* más/ })).not.toBeInTheDocument();
    expect(screen.getByText(/máximo que se puede listar de una vez/)).toBeVisible();
  });

  it("con filtros activos aclara que el total es el de la búsqueda", () => {
    renderLista({
      cuantos: 2,
      total: 300,
      filters: { tier: "vip", limite: 200 },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mostrando 2 de 300 clientes que coinciden con los filtros",
    );
  });
});
