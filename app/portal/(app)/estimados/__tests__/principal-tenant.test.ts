// @vitest-environment node
/**
 * SDD-0553 · «Avanzar a cotización» desde un estimado del Portal, por principal
 * de sesión y tenant.
 *
 * La acción corre con el admin client (el Portal no tiene RLS de UPDATE sobre
 * `quotes`), así que el único corte es el filtro explícito de la aplicación. El
 * admin es el doble de la SDD-0549, que aplica de verdad `eq` e `is` en la
 * lectura y en el UPDATE. El principal NO se simula: lo resuelve
 * `getPortalClientPrincipal` real contra el doble de sesión, con el vínculo
 * Portal activo del cliente A en el tenant A.
 *
 * Disposición infeliz: el Shipping Mark y el código del estimado son únicos POR
 * tenant (0006, 0007), así que el tenant B tiene un estimado web con el MISMO
 * Shipping Mark y, según el caso, el MISMO código. La versión anterior filtraba
 * sólo por código y Shipping Mark: con el código en los dos tenants
 * `maybeSingle` fallaba y el cliente legítimo no podía avanzar el suyo; con el
 * código sólo en B, avanzaba el estimado del otro tenant y avisaba a su asesor.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  portalMembership,
  type PortalDouble,
  type Row,
} from "@/lib/portal/__tests__/portal-tenant-double";

const h = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly path: string) {
      super(`NEXT_REDIRECT ${path}`);
    }
  }
  return {
    Redirect,
    session: null as unknown as PortalDouble,
    admin: null as unknown as PortalDouble,
    crearAdmin: vi.fn(),
    aviso: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new h.Redirect(path);
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.session.db }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.crearAdmin() }));
vi.mock("@/lib/studio/cotizacion-request-notify", () => ({
  notifyCotizacionRequestToAdmin: h.aviso,
}));

const { advanceEstimateToCotizacionAction } = await import("../actions");

const CODE = "EST-2026-0001";
const OTRO_MARKBOX = "DTD-0002";

function estimado(id: string, tenantId: string, overrides: Row = {}): Row {
  return {
    id,
    tenant_id: tenantId,
    quote_code: CODE,
    client_markbox: MARKBOX,
    client_name: "Cliente sintético",
    source: "web",
    status: "draft",
    service: "consolidado_lcl",
    origin: "China",
    destination: "Venezuela",
    nota: null,
    total_usd: 120,
    converted_to_shipment_id: null,
    deleted_at: null,
    ...overrides,
  };
}

function form(code: string): FormData {
  const fd = new FormData();
  fd.set("code", code);
  // Un tenant forjado en el formulario no cambia nada: sale de la sesión.
  fd.set("tenant_id", TENANT_B);
  return fd;
}

/** Corre la acción y devuelve la ruta del redirect o el estado de error. */
async function avanzar(code: string): Promise<{ redirect: string } | { state: unknown }> {
  try {
    return { state: await advanceEstimateToCotizacionAction({}, form(code)) };
  } catch (error) {
    if (error instanceof h.Redirect) return { redirect: error.path };
    throw error;
  }
}

function sembrar(quotes: Row[], membership: Row = portalMembership(), userId?: string | null) {
  h.session = portalDouble({ userId, tables: { client_users: [membership] } });
  h.admin = portalDouble({ tables: { quotes } });
}

const fila = (id: string) => h.admin.store.quotes.find((row) => row.id === id);
const actualizaciones = () => h.admin.on("quotes").filter((op) => op.kind === "update");

beforeEach(() => {
  h.crearAdmin.mockReset().mockImplementation(() => h.admin.db);
  h.aviso.mockReset().mockResolvedValue(undefined);
});

describe("SDD-0553 · avanzar estimado con el tenant del principal", () => {
  it("avanza el estimado propio aunque el tenant B tenga el mismo código y Shipping Mark", async () => {
    sembrar([estimado("q-b", TENANT_B), estimado("q-a", TENANT_A)]);

    expect(await avanzar(CODE)).toEqual({ redirect: "/portal/cotizaciones" });
    expect(fila("q-a")).toMatchObject({ source: "studio" });
    expect(fila("q-b")).toMatchObject({ source: "web" });
    expect(actualizaciones()).toEqual([expect.objectContaining({ affected: 1 })]);
    expect(h.aviso).toHaveBeenCalledTimes(1);
    expect(h.aviso).toHaveBeenCalledWith(
      h.admin.db,
      TENANT_A,
      expect.objectContaining({ code: CODE, markbox: MARKBOX, clientName: "Cliente sintético A" }),
    );
  });

  it("un estimado que sólo existe en el tenant B no se avanza ni avisa", async () => {
    sembrar([estimado("q-b", TENANT_B), estimado("q-a", TENANT_A, { quote_code: "EST-2026-0002" })]);

    expect(await avanzar(CODE)).toEqual({ state: { error: "No encontramos ese estimado en tu cuenta." } });
    expect(fila("q-b")).toMatchObject({ source: "web" });
    expect(fila("q-a")).toMatchObject({ source: "web" });
    expect(actualizaciones()).toEqual([]);
    expect(h.aviso).not.toHaveBeenCalled();
  });

  it("si el propio ya está en la pista formal, redirige sin tocar el del tenant B", async () => {
    sembrar([estimado("q-b", TENANT_B), estimado("q-a", TENANT_A, { source: "studio" })]);

    expect(await avanzar(CODE)).toEqual({ redirect: "/portal/cotizaciones" });
    expect(fila("q-b")).toMatchObject({ source: "web" });
    expect(actualizaciones()).toEqual([]);
    expect(h.aviso).not.toHaveBeenCalled();
  });

  it("la lectura y el UPDATE llevan el tenant y el Shipping Mark del principal", async () => {
    sembrar([estimado("q-a", TENANT_A)]);

    expect(await avanzar(CODE)).toEqual({ redirect: "/portal/cotizaciones" });
    const [lectura, update] = h.admin.on("quotes");
    expect(lectura.kind).toBe("select");
    expect(lectura.filters).toEqual(
      expect.arrayContaining([
        { column: "tenant_id", op: "eq", value: TENANT_A },
        { column: "client_markbox", op: "eq", value: MARKBOX },
        { column: "quote_code", op: "eq", value: CODE },
        { column: "deleted_at", op: "is", value: null },
      ]),
    );
    // El id es PK global: con datos reales el tenant del UPDATE es la segunda
    // valla, no cambia la fila tocada. Se exige igual, como el resto del Portal.
    expect(update.kind).toBe("update");
    expect(update.filters).toEqual(
      expect.arrayContaining([
        { column: "id", op: "eq", value: "q-a" },
        { column: "tenant_id", op: "eq", value: TENANT_A },
        { column: "client_markbox", op: "eq", value: MARKBOX },
        { column: "source", op: "eq", value: "web" },
      ]),
    );
  });

  it("no avanza el estimado de otro cliente del mismo tenant", async () => {
    sembrar([estimado("q-otro", TENANT_A, { client_markbox: OTRO_MARKBOX })]);

    expect(await avanzar(CODE)).toEqual({ state: { error: "No encontramos ese estimado en tu cuenta." } });
    expect(fila("q-otro")).toMatchObject({ source: "web" });
    expect(actualizaciones()).toEqual([]);
  });

  it("la identidad sale de la sesión: el admin no lee clients ni client_users", async () => {
    sembrar([estimado("q-a", TENANT_A)]);

    await avanzar(CODE);
    expect(h.admin.on("clients")).toEqual([]);
    expect(h.admin.on("client_users")).toEqual([]);
    expect(h.session.on("quotes")).toEqual([]);
  });
});

describe("SDD-0553 · sin principal válido no se construye el admin", () => {
  it.each([
    ["sin sesión", () => sembrar([estimado("q-a", TENANT_A)], portalMembership(), null)],
    [
      "vínculo de A con un cliente del tenant B",
      () => sembrar([estimado("q-a", TENANT_A)], portalMembership({ clientTenant: TENANT_B })),
    ],
    [
      "cliente borrado",
      () => sembrar([estimado("q-a", TENANT_A)], portalMembership({ deletedAt: "2026-10-01T00:00:00Z" })),
    ],
  ] as const)("%s", async (_caso, preparar) => {
    preparar();

    expect(await avanzar(CODE)).toEqual({
      state: { error: "Tu sesión expiró. Vuelve a entrar e intenta de nuevo." },
    });
    expect(h.crearAdmin).not.toHaveBeenCalled();
    expect(fila("q-a")).toMatchObject({ source: "web" });
  });
});
