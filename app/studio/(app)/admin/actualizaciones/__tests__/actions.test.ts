// @vitest-environment node
/**
 * SDD-0588 · paso 3.3 · acciones de Administración › Actualizaciones.
 *
 * `pedirActualizacion` deja un registro con el cliente del propio admin y no
 * llama a nada más: ni a Chatwoot ni al vigilante. Solo se puede pedir la versión
 * que la última revisión muestra como disponible. `revisarVersionesAhora` corre
 * el vigilante del tenant del admin. Sin admin, ninguna toca la base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const T1 = "10000000-0000-4000-8000-000000000001";
const SAM = "20000000-0000-4000-8000-000000000001";

const m = vi.hoisted(() => ({
  gate: null as unknown,
  revision: null as unknown,
  inserts: [] as { tabla: string; fila: Record<string, unknown> }[],
  errorInsert: null as { code: string } | null,
  tocoBase: 0,
  revisar: vi.fn(),
  revalidate: vi.fn(),
  fetch: vi.fn(),
}));

const sesion = {
  from: (tabla: string) => {
    m.tocoBase += 1;
    return {
      insert: async (fila: Record<string, unknown>) => {
        if (m.errorInsert) return { error: m.errorInsert };
        m.inserts.push({ tabla, fila });
        return { error: null };
      },
    };
  },
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => sesion }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ admin: true }) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ tenantAdminGate: async () => m.gate }));
vi.mock("@/lib/studio/chatwoot/versiones-queries", () => ({
  ultimaRevision: async (_db: unknown, tenantId: string) => {
    m.tocoBase += 1;
    return tenantId === T1 ? m.revision : null;
  },
}));
vi.mock("@/lib/studio/chatwoot/versiones-vigilante", () => ({
  RUTA_ACTUALIZACIONES: "/studio/admin/actualizaciones",
  revisarAhora: m.revisar,
}));

import { pedirActualizacion, revisarVersionesAhora } from "../actions";

const INICIAL = { ok: false, error: null };
const conVersion = (v: string) => {
  const fd = new FormData();
  fd.set("to_version", v);
  return fd;
};

beforeEach(() => {
  m.gate = { ok: true, tenantId: T1, userId: SAM, role: "admin" };
  m.revision = { id: 41, estado: "hay_nueva", instalada: "4.19.1", disponible: "4.20.0", pendientes: [], recortado: false, error: null, revisada: "" };
  m.inserts = [];
  m.errorInsert = null;
  m.tocoBase = 0;
  m.revisar.mockReset().mockResolvedValue({ omitido: false, revision: m.revision, avisados: 0 });
  m.revalidate.mockReset();
  m.fetch.mockReset();
  vi.stubGlobal("fetch", m.fetch);
});

describe("pedirActualizacion (SDD-0588, 3.3)", () => {
  it("sin admin: denied y no toca la base", async () => {
    m.gate = { ok: false, denied: "No tienes permiso para realizar esta acción." };
    expect(await pedirActualizacion(INICIAL, conVersion("4.20.0"))).toEqual({ ok: false, error: "denied" });
    expect(m.tocoBase).toBe(0);
  });

  it("deja el registro con quien pide, de la instalada a la disponible, y nada más", async () => {
    expect(await pedirActualizacion(INICIAL, conVersion("4.20.0"))).toEqual({ ok: true, error: null });
    expect(m.inserts).toEqual([
      {
        tabla: "chatwoot_update_requests",
        fila: { tenant_id: T1, from_version: "4.19.1", to_version: "4.20.0", check_id: 41, requested_by: SAM },
      },
    ]);
    expect(m.revisar).not.toHaveBeenCalled();
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.revalidate).toHaveBeenCalledWith("/studio/admin/actualizaciones");
  });

  it("una versión mal formada: invalid, sin leer nada", async () => {
    for (const v of ["", "4.20", "latest", "4.20.0-ce"]) {
      expect(await pedirActualizacion(INICIAL, conVersion(v))).toEqual({ ok: false, error: "invalid" });
    }
    expect(m.tocoBase).toBe(0);
  });

  it("una versión que no es la disponible o una revisión al día: stale, sin insertar", async () => {
    expect(await pedirActualizacion(INICIAL, conVersion("4.21.0"))).toEqual({ ok: false, error: "stale" });
    m.revision = { ...(m.revision as object), estado: "al_dia", disponible: "4.20.0", instalada: "4.20.0" };
    expect(await pedirActualizacion(INICIAL, conVersion("4.20.0"))).toEqual({ ok: false, error: "stale" });
    m.revision = { ...(m.revision as object), estado: "error", instalada: null, disponible: "4.20.0" };
    expect(await pedirActualizacion(INICIAL, conVersion("4.20.0"))).toEqual({ ok: false, error: "stale" });
    expect(m.inserts).toHaveLength(0);
  });

  it("sin revisión (o sin la 0507): service", async () => {
    m.revision = null;
    expect(await pedirActualizacion(INICIAL, conVersion("4.20.0"))).toEqual({ ok: false, error: "service" });
  });

  it("la misma versión pedida otra vez: duplicate; otro error: service", async () => {
    m.errorInsert = { code: "23505" };
    expect(await pedirActualizacion(INICIAL, conVersion("4.20.0"))).toEqual({ ok: false, error: "duplicate" });
    m.errorInsert = { code: "42501" };
    expect(await pedirActualizacion(INICIAL, conVersion("4.20.0"))).toEqual({ ok: false, error: "service" });
    expect(m.revalidate).not.toHaveBeenCalled();
  });
});

describe("revisarVersionesAhora (SDD-0588, 3.3)", () => {
  it("sin admin: denied y no revisa", async () => {
    m.gate = { ok: false, denied: "No" };
    expect(await revisarVersionesAhora()).toEqual({ ok: false, error: "denied" });
    expect(m.revisar).not.toHaveBeenCalled();
  });

  it("revisa el tenant del admin con el cliente de servicio", async () => {
    expect(await revisarVersionesAhora()).toEqual({ ok: true, error: null });
    expect(m.revisar.mock.calls[0][0]).toMatchObject({ tenantId: T1, admin: { admin: true } });
    expect(m.revalidate).toHaveBeenCalledWith("/studio/admin/actualizaciones");
  });

  it("si no pudo guardar (sin la 0507): service", async () => {
    m.revisar.mockResolvedValueOnce({ omitido: true, revision: null, avisados: 0 });
    expect(await revisarVersionesAhora()).toEqual({ ok: false, error: "service" });
  });
});
