/**
 * SDD-0531 · Crear un envío desde China sin ver nombres de clientes.
 *
 * La página de alta mandaba al navegador hasta 500 nombres (el autocompletado)
 * y el formulario buscaba clientes por cédula y nombre. Para el equipo de China:
 *
 *  - la página no lee ni manda la lista;
 *  - el formulario no muestra el buscador de clientes, sólo el Shipping Mark;
 *  - al crear, el nombre lo pone el servidor desde el Shipping Mark de SU
 *    tenant (el doble filtra: el mismo código en otro tenant no cuenta) y lo
 *    que mande el navegador no cuenta.
 *
 * Para Venezuela, todo sigue igual.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { dobleSupabase, type Doble } from "@/lib/studio/__tests__/privacidad-cn-double";

const h = vi.hoisted(() => ({
  doble: null as unknown as { client: unknown },
  propsForm: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => h.doble.client }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: async () => null }));
vi.mock("@/lib/auth/session", () => ({ getUserTenantId: async () => "t1" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/studio/workflow/workflow-rule-engine", () => ({
  fireWorkflowEvent: vi.fn(async () => {}),
}));
vi.mock("@/lib/studio/costing/queries", () => ({
  prefillShipmentCostsFromTemplate: vi.fn(async () => {}),
}));
vi.mock("@/app/studio/_components/ui/ClientCombobox", () => ({
  ClientCombobox: () => <input aria-label="buscador de clientes" />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) => (
    <a href={href}>{children as never}</a>
  ),
}));

import NuevoEnvioPage from "../page";
import { createShipment } from "../actions";
import { CreateShipmentForm } from "../_components/CreateShipmentForm";

const YIWU = { user_id: "u1", tenant_id: "t1", region: "cn", role: "operations", disabled_at: null };
const VALENCIA = { ...YIWU, region: "ve" };

const CLIENTES = [
  { id: "c9", tenant_id: "t2", markbox: "DTD-0042", name: "Otro Tenant SA", deleted_at: null },
  { id: "c1", tenant_id: "t1", markbox: "DTD-0042", name: "María Pérez", deleted_at: null },
];

function sembrar(membresia: typeof YIWU): Doble {
  const d = dobleSupabase({
    userId: "u1",
    tablas: {
      user_tenants: [membresia],
      clients: CLIENTES,
      shipments: [
        { client_name: "Comercial Rojas" },
        { client_name: "María Pérez" },
      ],
    },
  });
  h.doble = d as never;
  return d;
}

function formulario(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  h.propsForm = null;
});
afterEach(cleanup);

describe("página de alta", () => {
  it("China: no lee ni manda la lista de nombres", async () => {
    const d = sembrar(YIWU);
    const el = await NuevoEnvioPage();
    expect(el.props).toEqual({ existingClients: [], nombresOcultos: true });
    expect(d.lecturas).not.toContain("shipments");
  });

  it("Venezuela: manda la lista como siempre", async () => {
    sembrar(VALENCIA);
    const el = await NuevoEnvioPage();
    expect(el.props).toEqual({
      existingClients: ["Comercial Rojas", "María Pérez"],
      nombresOcultos: false,
    });
  });
});

describe("formulario de alta", () => {
  it("China: sin buscador de clientes; sólo el Shipping Mark, con la explicación", () => {
    render(<CreateShipmentForm existingClients={[]} nombresOcultos />);
    expect(screen.queryByLabelText("buscador de clientes")).toBeNull();
    expect(screen.queryByText("Cliente")).toBeNull();
    expect(document.querySelector('input[name="client_name"]')).toBeNull();
    expect(screen.getByLabelText("Shipping Mark")).toBeInTheDocument();
    expect(
      screen.getByText("Lo completa el sistema a partir del Shipping Mark.", { exact: false }),
    ).toBeInTheDocument();
  });

  it("Venezuela: el buscador sigue", () => {
    render(<CreateShipmentForm existingClients={["María Pérez"]} />);
    expect(screen.getByLabelText("buscador de clientes")).toBeInTheDocument();
    expect(document.querySelector('input[name="client_name"]')).not.toBeNull();
    expect(screen.queryByText(/tu región/)).toBeNull();
  });
});

describe("createShipment", () => {
  async function crear(campos: Record<string, string>) {
    await expect(
      createShipment({}, formulario({ code: "S-2026-0099", shipment_service: "consolidado_lcl", ...campos })),
    ).rejects.toThrow("NEXT_REDIRECT /studio/tracking");
  }

  it("China: el nombre lo pone el servidor desde el Shipping Mark de su tenant", async () => {
    const d = sembrar(YIWU);
    await crear({ client_markbox: "DTD-0042", client_name: "Lo que sea" });
    const insert = d.escrituras.find((e) => e.table === "shipments" && e.op === "insert");
    expect(insert?.row).toMatchObject({ client_markbox: "DTD-0042", client_name: "María Pérez" });
  });

  it("China sin Shipping Mark: el envío queda sin nombre, no con el del navegador", async () => {
    const d = sembrar(YIWU);
    await crear({ client_name: "Lo que sea" });
    const insert = d.escrituras.find((e) => e.table === "shipments" && e.op === "insert");
    expect(insert?.row.client_name).toBeNull();
  });

  it("Venezuela: se guarda el nombre del formulario, como siempre", async () => {
    const d = sembrar(VALENCIA);
    await crear({ client_markbox: "DTD-0042", client_name: "Juan Ruiz" });
    const insert = d.escrituras.find((e) => e.table === "shipments" && e.op === "insert");
    expect(insert?.row).toMatchObject({ client_markbox: "DTD-0042", client_name: "Juan Ruiz" });
    expect(d.lecturas).not.toContain("clients");
  });
});
