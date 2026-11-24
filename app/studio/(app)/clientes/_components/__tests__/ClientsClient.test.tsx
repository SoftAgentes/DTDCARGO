import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientsClient, type ClientListRow } from "../ClientsClient";

const mocks = vi.hoisted(() => ({ params: new URLSearchParams("q=ficticio&tier=vip&pending=1&limite=100"), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => mocks.params }));
vi.mock("../ClientDrawer", () => ({ ClientDrawer: () => null }));
vi.mock("@/app/studio/_components/ui/ActionMenu", () => ({ ActionMenu: () => null }));
afterEach(cleanup);

const CLIENTE: ClientListRow = {
  id: "cliente-ficticio", tenant_id: "tenant-ficticio", markbox: "DTD-0000", name: "Cliente ficticio",
  email: null, phone: null, address: null, rif: null, contact_name: null, tier: "regular",
  lat: null, lng: null, registration_channel: "admin", doc_kind: null, doc_verify_status: null,
  doc_verify_source: null, doc_registry_name: null, doc_verified_at: null, cedula_photo_path: null,
  advisor_id: null, aliado_id: null, person_id: null, hasNote: true,
  created_at: "2026-11-24T12:00:00Z", updated_at: "2026-11-24T12:00:00Z", deleted_at: null,
};

function montar(puedeAsignar = false, client = CLIENTE) {
  return render(<ClientsClient clients={[client]} puedeAsignar={puedeAsignar} aliados={[]}
    filters={{ q: "ficticio", tier: "vip", pendingReview: true }} total={1} limite={100}
    topeAlcanzado={false} adjuntos={{}} />);
}

describe("Listado Clientes · SDD-0715", () => {
  it("expone un enlace de identidad con filtros y un indicador sin texto crudo", () => {
    montar(false, { ...CLIENTE, notes: "TEXTO_FICTICIO_NO_DEBE_APARECER" } as ClientListRow);
    const link = screen.getByRole("link", { name: /Ver ficha de Cliente ficticio/ });
    expect(link).toHaveAttribute("href", "/studio/clientes/ficha/DTD-0000?q=ficticio&tier=vip&pending=1&limite=100");
    expect(link.closest('[role="cell"]')).not.toBeNull();
    expect(screen.getByText("Nota disponible en la ficha")).toBeInTheDocument();
    expect(screen.queryByText("TEXTO_FICTICIO_NO_DEBE_APARECER")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("ficticio");
  });
  it("el acceso de asignación exige permiso y no se deduce de la nota", () => {
    montar();
    expect(screen.queryByText("Asignar cliente")).not.toBeInTheDocument();
    cleanup();
    montar(true);
    expect(screen.getByRole("link", { name: /Asignar cliente/ })).toBeInTheDocument();
    cleanup();
    montar(true, { ...CLIENTE, markbox: "DTD-8001" });
    expect(screen.queryByText("Asignar cliente")).not.toBeInTheDocument();
  });
  it("sin nota no inventa el indicador", () => {
    montar(false, { ...CLIENTE, hasNote: false });
    expect(screen.queryByText("Nota disponible en la ficha")).not.toBeInTheDocument();
  });
});
