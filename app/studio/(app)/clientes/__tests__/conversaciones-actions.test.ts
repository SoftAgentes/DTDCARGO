/**
 * SDD-0650 F2 · «Unir este chat a la ficha» y «Quitar la unión».
 *
 * El candado es el REAL (`moduleEditGate` de `lib/studio/rbac-guard.ts`): solo se dobla la
 * sesión (usuario y su fila de `user_tenants`). Así el texto de «sin permiso» que se compara
 * es el que devuelve el guard, no una constante de la prueba (N2 de la revisión).
 * La escritura va por el cliente de SERVICIO, después del candado y del tenant, con el tenant
 * y el actor explícitos (acotar por tenant en la base).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";
const ACTOR = "a0000000-0000-0000-0000-0000000000b1";

const h = vi.hoisted(() => ({
  rol: "commercial" as string,
  tenant: "11111111-1111-1111-1111-111111111111",
  rpcSesion: vi.fn(),
  rpcServicio: vi.fn(),
  adminCreado: vi.fn(),
  chatwoot: vi.fn(),
  limpiar: vi.fn(),
  revalidar: vi.fn(),
  /** SDD-0676: la fila de la unión que ve la sesión al quitar (su canal). */
  union: null as { canal_chat: string | null } | null,
  /** Desvíos de rol (SDD-0252) y accesos por persona (SDD-0622) que ve el guard real. */
  overrides: {} as Record<string, { view: boolean; edit: boolean }>,
  grants: {} as Record<string, { view: boolean; edit: boolean }>,
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidar }));
// La sesión: un usuario con UNA membresía activa. `rpc` de sesión no debe usarse nunca.
vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    const fila = { role: h.rol, tenant_id: h.tenant, warehouse_scope: "all" };
    const q = { select: () => q, eq: () => q, is: () => q, limit: () => q, maybeSingle: async () => ({ data: fila, error: null }) };
    // La unión filtra de verdad por tenant, ficha y contacto: solo la de T1, FICHA y 77 existe.
    const uniones = () => {
      const filtros: Record<string, unknown> = {};
      const u = {
        select: () => u,
        eq: (col: string, v: unknown) => ((filtros[col] = v), u),
        maybeSingle: async () => ({
          data:
            h.union &&
            filtros.tenant_id === "11111111-1111-1111-1111-111111111111" &&
            filtros.client_id === "c0000000-0000-0000-0000-0000000000a1" &&
            filtros.chatwoot_contact_id === 77
              ? h.union
              : null,
          error: null,
        }),
      };
      return u;
    };
    return {
      auth: { getUser: async () => ({ data: { user: { id: ACTOR } } }) },
      from: (tabla: string) => (tabla === "chatwoot_contact_links" ? uniones() : q),
      rpc: h.rpcSesion,
    };
  },
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    h.adminCreado();
    return { rpc: h.rpcServicio };
  },
}));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({ getRoleModuleOverrides: async () => h.overrides }));
vi.mock("@/lib/studio/user-module-grants-queries", () => ({ getMyModuleGrants: async () => h.grants }));
vi.mock("@/lib/studio/platform-admin", () => ({ isPlatformAdmin: async () => false }));
vi.mock("@/lib/studio/chatwoot/router-api", () => ({
  obtenerConversacionYContacto: h.chatwoot,
  escribirAtributosContacto: h.limpiar,
}));

import { moduleEditGate } from "@/lib/studio/rbac-guard";
import { createClient } from "@/lib/db/server";

import { quitarUnionAction, unirChatAction } from "../conversaciones-actions";

const FICHA = "c0000000-0000-0000-0000-0000000000a1";

/** El texto real que da el guard a un rol que no edita la Bandeja. */
async function textoRealSinPermiso(): Promise<string> {
  const antes = h.rol;
  h.rol = "support";
  const gate = await moduleEditGate((await createClient()) as never, "bandeja");
  h.rol = antes;
  if (gate.ok) throw new Error("el guard real dejó pasar a soporte");
  return gate.denied;
}

function nadaSeTocó() {
  expect(h.chatwoot).not.toHaveBeenCalled();
  expect(h.adminCreado).not.toHaveBeenCalled();
  expect(h.rpcServicio).not.toHaveBeenCalled();
  expect(h.rpcSesion).not.toHaveBeenCalled();
}

beforeEach(() => {
  h.rol = "commercial";
  h.tenant = T1;
  h.rpcSesion.mockReset();
  h.rpcServicio.mockReset().mockResolvedValue({ data: { resultado: "unido", tarjeta_absorbida: false }, error: null });
  h.adminCreado.mockReset();
  h.chatwoot.mockReset().mockResolvedValue({
    ok: true,
    data: { conversacion: { id: 31 }, contacto: { contactoId: 77, nombre: "SINT Nombre", canal: null, asignadoEsBot: false } },
  });
  h.revalidar.mockReset();
  h.limpiar.mockReset().mockResolvedValue({ ok: true, data: null });
  h.union = null;
  h.overrides = {};
  h.grants = {};
  vi.stubEnv("CHATWOOT_FICHA_TOKEN", "token-sintetico");
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
  vi.stubEnv("CHATWOOT_INBOX_ARCHIVO_KOMMO_ID", "9");
  vi.stubEnv("CHATWOOT_TENANT_ID", T1);
});

describe("unirChatAction", () => {
  it.each(["support", "operations", "accounting", "warehouse"])("%s no une: ni Chatwoot ni la base", async (rol) => {
    h.rol = rol;
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads");
    expect(r).toEqual({ ok: false, error: await textoRealSinPermiso() });
    nadaSeTocó();
  });

  it("comercial de OTRO tenant: exactamente el texto real del guard, sin tocar Chatwoot ni la base", async () => {
    h.tenant = T2;
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads");
    expect(r).toEqual({ ok: false, error: await textoRealSinPermiso() });
    nadaSeTocó();
  });

  it("SDD-0676 · con un desvío de rol que quita Clientes, quien edita la Bandeja no une", async () => {
    h.overrides = { "commercial:clients": { view: false, edit: false } };
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads");
    expect(r).toEqual({ ok: false, error: await textoRealSinPermiso() });
    nadaSeTocó();
  });

  it("SDD-0676 · almacén con la Bandeja prestada por persona (SDD-0622), sin Clientes, no une", async () => {
    // Almacén no ve Clientes ni la Bandeja por rol; el extra le da SOLO la Bandeja.
    h.rol = "warehouse";
    h.grants = { bandeja: { view: true, edit: true } };
    // El primer candado (editar la Bandeja) lo deja pasar: el que corta es Clientes.
    expect((await moduleEditGate((await createClient()) as never, "bandeja")).ok).toBe(true);
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads");
    expect(r.ok).toBe(false);
    nadaSeTocó();
  });

  it("sin CHATWOOT_TENANT_ID: nadie une", async () => {
    vi.stubEnv("CHATWOOT_TENANT_ID", "");
    expect((await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads")).ok).toBe(false);
    nadaSeTocó();
  });

  it("comercial une: por el cliente de servicio, con tenant y actor explícitos y solo ids", async () => {
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "  Es su chat de leads  ");
    expect(r).toEqual({ ok: true, mensaje: "Chat unido a la ficha." });
    // SDD-0676: une por la RPC nueva, sin mover y con el canal del contacto (aquí no vino).
    expect(h.rpcServicio).toHaveBeenCalledTimes(1);
    expect(h.rpcServicio).toHaveBeenCalledWith("chatwoot_vincular_contacto", {
      p_tenant_id: T1,
      p_actor_user_id: ACTOR,
      p_client_id: FICHA,
      p_contact_id: 77,
      p_canal: null,
      p_motivo: "Es su chat de leads",
      p_mover: false,
    });
    expect(h.rpcSesion).not.toHaveBeenCalled();
    expect(JSON.stringify(h.rpcServicio.mock.calls)).not.toContain("SINT Nombre");
    expect(h.revalidar).toHaveBeenCalledWith("/studio/clientes/DTD-0001");
  });

  it("sin la cuenta de servicio (token vacío): no llama a Chatwoot ni a la base", async () => {
    vi.stubEnv("CHATWOOT_FICHA_TOKEN", "");
    expect((await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat de leads")).ok).toBe(false);
    nadaSeTocó();
  });

  it("la base rechaza (42501): el mismo texto real; otra ficha (23505) y sin 0554 (PGRST202) dicen qué pasó", async () => {
    h.rpcServicio.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat")).toEqual({ ok: false, error: await textoRealSinPermiso() });
    h.rpcServicio.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    expect(await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat")).toEqual({ ok: false, error: "Ese chat ya está unido a otra ficha." });
    // Ni la RPC nueva ni la de la 0554 existen.
    h.rpcServicio
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    const r = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat");
    expect(r.ok === false && r.error).toMatch(/0554/);
  });

  it("SDD-0676 · el chat del portal (55000) no se mueve ni se quita: lo dice", async () => {
    h.rpcServicio.mockResolvedValueOnce({ data: null, error: { code: "55000" } });
    const unir = await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat");
    expect(unir).toEqual({ ok: false, error: "El chat del portal es de la ficha de su cliente: no se desvincula ni se mueve." });
    h.rpcServicio.mockResolvedValueOnce({ data: null, error: { code: "55000" } });
    const quitar = await quitarUnionAction(FICHA, "DTD-0001", 77, "Se unió por error");
    expect(quitar).toEqual({ ok: false, error: "El chat del portal es de la ficha de su cliente: no se desvincula ni se mueve." });
    // Si la base se negó, no se limpia nada en Chatwoot.
    expect(h.limpiar).not.toHaveBeenCalled();
  });

  it("SDD-0676 · el canal sale del tipo de bandeja de Chatwoot, no del navegador", async () => {
    h.chatwoot.mockResolvedValueOnce({
      ok: true,
      data: { conversacion: { id: 31 }, contacto: { contactoId: 77, nombre: "SINT Nombre", canal: "Channel::Instagram", asignadoEsBot: false } },
    });
    await unirChatAction(FICHA, "DTD-0001", 31, "Es su Instagram");
    expect(h.rpcServicio).toHaveBeenCalledWith("chatwoot_vincular_contacto", expect.objectContaining({ p_canal: "instagram", p_mover: false }));
  });

  it("SDD-0676 · sin la migración nueva (PGRST202) une con la RPC de la 0554, sin canal", async () => {
    h.rpcServicio
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } })
      .mockResolvedValueOnce({ data: "unido", error: null });
    expect(await unirChatAction(FICHA, "DTD-0001", 31, "Es su chat")).toEqual({ ok: true, mensaje: "Chat unido a la ficha." });
    expect(h.rpcServicio).toHaveBeenLastCalledWith("chatwoot_unir_contacto_manual", {
      p_tenant_id: T1,
      p_actor_user_id: ACTOR,
      p_client_id: FICHA,
      p_contact_id: 77,
      p_motivo: "Es su chat",
    });
  });

  it("entradas inválidas no salen del servidor", async () => {
    expect((await unirChatAction("no-uuid", "DTD-0001", 31, "Es su chat")).ok).toBe(false);
    expect((await unirChatAction(FICHA, "DTD-0001", 0, "Es su chat")).ok).toBe(false);
    expect((await unirChatAction(FICHA, "DTD-0001", 31, "no")).ok).toBe(false);
    nadaSeTocó();
  });
});

describe("quitarUnionAction", () => {
  it("soporte no quita", async () => {
    h.rol = "support";
    expect(await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).toEqual({ ok: false, error: await textoRealSinPermiso() });
    nadaSeTocó();
  });

  it("SDD-0676 · con un desvío de rol que quita Clientes, quien edita la Bandeja no quita", async () => {
    h.overrides = { "commercial:clients": { view: false, edit: false } };
    const r = await quitarUnionAction(FICHA, "DTD-0001", 77, "Se unió por error");
    expect(r).toEqual({ ok: false, error: await textoRealSinPermiso() });
    nadaSeTocó();
  });

  it("admin de OTRO tenant no quita: no llega a la base", async () => {
    h.rol = "admin";
    h.tenant = T2;
    expect(await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).toEqual({ ok: false, error: await textoRealSinPermiso() });
    nadaSeTocó();
  });

  it("admin quita con motivo, por el cliente de servicio y con el actor", async () => {
    h.rol = "admin";
    h.rpcServicio.mockResolvedValueOnce({ data: true, error: null });
    expect(await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).toEqual({ ok: true, mensaje: "Unión quitada." });
    expect(h.rpcServicio).toHaveBeenCalledWith("chatwoot_quitar_union", {
      p_tenant_id: T1,
      p_actor_user_id: ACTOR,
      p_client_id: FICHA,
      p_contact_id: 77,
      p_motivo: "Fue un error",
    });
    expect(h.rpcSesion).not.toHaveBeenCalled();
    // Sin canal conocido no se toca el contacto en Chatwoot.
    expect(h.limpiar).not.toHaveBeenCalled();
  });

  describe("SDD-0676 · limpia el contacto desvinculado", () => {
    beforeEach(() => {
      h.rol = "admin";
      h.rpcServicio.mockResolvedValue({ data: true, error: null });
      vi.stubEnv("CHATWOOT_URL", "https://chat.ejemplo.test");
      vi.stubEnv("CHATWOOT_ROUTER_TOKEN", "tok-router-sintetico");
      vi.stubEnv("CHATWOOT_INBOX_LEADS_ID", "3");
      vi.stubEnv("CHATWOOT_INBOX_CLIENTES_ID", "7");
      vi.stubEnv("CHATWOOT_TEAM_CLIENTES_ID", "21");
      vi.stubEnv("CHATWOOT_TEAM_LEADS_ID", "22");
      vi.stubEnv("WHATSAPP_NUMERO_CLIENTES", "584125550999");
      vi.stubEnv("CHATWOOT_ATRIBUTOS_CONTACTO", "1");
    });

    it("Instagram: borra el segmento y el Shipping Mark de ESE contacto", async () => {
      h.union = { canal_chat: "instagram" };
      expect((await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).ok).toBe(true);
      expect(h.limpiar).toHaveBeenCalledTimes(1);
      expect(h.limpiar).toHaveBeenCalledWith(expect.anything(), 77, { dtd_segmento: "lead_nuevo", dtd_shipping_mark: null });
    });

    it("WhatsApp: no limpia (lo corrige el siguiente mensaje)", async () => {
      h.union = { canal_chat: "whatsapp" };
      expect((await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).ok).toBe(true);
      expect(h.limpiar).not.toHaveBeenCalled();
    });

    it("la unión de OTRA ficha no presta su canal: el filtro por ficha se aplica", async () => {
      h.union = { canal_chat: "instagram" };
      const OTRA = "c0000000-0000-0000-0000-0000000000a2";
      await quitarUnionAction(OTRA, "DTD-0002", 77, "Fue un error");
      expect(h.limpiar).not.toHaveBeenCalled();
    });

    it("con los atributos apagados no escribe en Chatwoot", async () => {
      vi.stubEnv("CHATWOOT_ATRIBUTOS_CONTACTO", "");
      h.union = { canal_chat: "instagram" };
      expect((await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).ok).toBe(true);
      expect(h.limpiar).not.toHaveBeenCalled();
    });

    it("si la unión ya no estaba, no limpia", async () => {
      h.union = { canal_chat: "instagram" };
      h.rpcServicio.mockResolvedValueOnce({ data: false, error: null });
      expect((await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).ok).toBe(false);
      expect(h.limpiar).not.toHaveBeenCalled();
    });

    it("si Chatwoot falla al limpiar, la unión igual queda quitada y el log lleva solo el código", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      h.union = { canal_chat: "instagram" };
      h.limpiar.mockResolvedValueOnce({ ok: false, error: "http_500" });
      expect(await quitarUnionAction(FICHA, "DTD-0001", 77, "Fue un error")).toEqual({ ok: true, mensaje: "Unión quitada." });
      expect(warn.mock.calls.flat().join(" ")).toMatch(/http_500/);
      expect(warn.mock.calls.flat().join(" ")).not.toMatch(/DTD-0001|77/);
      warn.mockRestore();
    });
  });
});
