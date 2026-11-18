/**
 * SDD-0650 F2 · «Unir este chat a la ficha» y «Quitar la unión».
 *
 * El candado es el de verdad en su decisión: el doble de `moduleEditDenial` resuelve con
 * `canEditModule` del rol de la prueba (Admin y Comercial editan la Bandeja; Soporte es de
 * solo lectura; Operaciones no la tiene). Sin permiso, ni Chatwoot ni la base se tocan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StudioUserRole } from "@/lib/studio/user-types";

const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  rol: "commercial" as string,
  tenant: "11111111-1111-1111-1111-111111111111",
  rpc: vi.fn(),
  chatwoot: vi.fn(),
  revalidar: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidar }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: h.rpc }) }));
vi.mock("@/lib/studio/rbac-guard", async () => {
  const { canEditModule } = await import("@/lib/studio/rbac");
  return {
    moduleEditGate: async (_s: unknown, modulo: string) =>
      canEditModule(h.rol as StudioUserRole, modulo)
        ? { ok: true, tenantId: h.tenant, userId: "u0000000-0000-0000-0000-000000000001", role: h.rol }
        : { ok: false, denied: "No tienes permiso para editar esto." },
  };
});
vi.mock("@/lib/studio/chatwoot/router-api", () => ({ obtenerConversacionYContacto: h.chatwoot }));

import { quitarUnionAction, unirChatAction } from "../conversaciones-actions";

const FICHA = "c0000000-0000-0000-0000-0000000000a1";

beforeEach(() => {
  h.rol = "commercial";
  h.tenant = T1;
  h.rpc.mockReset().mockResolvedValue({ data: "unido", error: null });
  h.chatwoot.mockReset().mockResolvedValue({
    ok: true,
    data: { conversacion: { id: 31 }, contacto: { contactoId: 77, nombre: "SINT Nombre", canal: null, asignadoEsBot: false } },
  });
  h.revalidar.mockReset();
  vi.stubEnv("CHATWOOT_FICHA_TOKEN", "token-sintetico");
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
  vi.stubEnv("CHATWOOT_INBOX_ARCHIVO_KOMMO_ID", "9");
  vi.stubEnv("CHATWOOT_TENANT_ID", T1);
});

describe("unirChatAction", () => {
  it.each(["support", "operations", "accounting", "warehouse"])("%s no une: ni Chatwoot ni la base", async (rol) => {
    h.rol = rol;
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads");
    expect(r.ok).toBe(false);
    expect(h.chatwoot).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("comercial de OTRO tenant: el mismo «no tienes permiso», sin tocar Chatwoot ni la base", async () => {
    h.tenant = T2;
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads");
    expect(r).toEqual({ ok: false, error: "No tienes permiso para editar esto." });
    expect(h.chatwoot).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("sin CHATWOOT_TENANT_ID: nadie une", async () => {
    vi.stubEnv("CHATWOOT_TENANT_ID", "");
    expect((await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads")).ok).toBe(false);
    expect(h.chatwoot).not.toHaveBeenCalled();
  });

  it("comercial une: traduce la conversación a su contacto y llama la RPC solo con ids", async () => {
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "  Es su chat de leads  ");
    expect(r).toEqual({ ok: true, mensaje: "Chat unido a la ficha." });
    expect(h.rpc).toHaveBeenCalledWith("chatwoot_unir_contacto_manual", {
      p_client_id: FICHA,
      p_contact_id: 77,
      p_motivo: "Es su chat de leads",
    });
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain("SINT Nombre");
    expect(h.revalidar).toHaveBeenCalledWith("/studio/clientes/DTD-0001");
  });

  it("sin la cuenta de servicio (token vacío): no llama a Chatwoot ni a la base", async () => {
    vi.stubEnv("CHATWOOT_FICHA_TOKEN", "");
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads");
    expect(r.ok).toBe(false);
    expect(h.chatwoot).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("un chat de otra ficha (23505) y la 0554 sin aplicar (PGRST202) dicen qué pasó", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    expect(await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat")).toEqual({ ok: false, error: "Ese chat ya está unido a otra ficha." });
    h.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat");
    expect(r.ok === false && r.error).toMatch(/0554/);
  });

  it("entradas inválidas no salen del servidor", async () => {
    expect((await unirChatAction("no-uuid", "DTD-0001", 31, "Es su chat")).ok).toBe(false);
    expect((await unirChatAction(FICHA, "DTD-0001", 0, "Es su chat")).ok).toBe(false);
    expect((await unirChatAction(FICHA, "DTD-0001", 31, "no")).ok).toBe(false);
    expect(h.chatwoot).not.toHaveBeenCalled();
  });
});

describe("quitarUnionAction", () => {
  it("soporte no quita", async () => {
    h.rol = "support";
    expect((await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).ok).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("admin de OTRO tenant no quita: no llega a la base", async () => {
    h.rol = "admin";
    h.tenant = T2;
    expect(await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).toEqual({ ok: false, error: "No tienes permiso para editar esto." });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("admin quita con motivo", async () => {
    h.rol = "admin";
    h.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).toEqual({ ok: true, mensaje: "Unión quitada." });
    expect(h.rpc).toHaveBeenCalledWith("chatwoot_quitar_union", { p_client_id: FICHA, p_contact_id: 77, p_motivo: "Fue un error" });
  });
});
