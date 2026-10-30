// @vitest-environment node
/**
 * SDD-0585 · server actions de la Bandeja. El doble de Supabase APLICA los
 * filtros (`eq`, `is`): un doble que devuelve todo no prueba que la acción
 * filtre por usuario y tenant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

function dobleSupabase(tablas: Tablas, opciones: { errorInsert?: { code: string } } = {}) {
  const inserts: { tabla: string; fila: Fila }[] = [];
  const from = (tabla: string) => {
    const filtros: ((f: Fila) => boolean)[] = [];
    let modo: "select" | "delete" = "select";
    const filas = () => (tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
    const builder = {
      select: () => builder,
      eq: (col: string, v: unknown) => (filtros.push((f) => f[col] === v), builder),
      is: (col: string, v: unknown) => (filtros.push((f) => (f[col] ?? null) === v), builder),
      order: () => builder,
      maybeSingle: async () => {
        const r = filas();
        return { data: r[0] ?? null, error: null };
      },
      insert: async (fila: Fila) => {
        if (opciones.errorInsert) return { error: opciones.errorInsert };
        inserts.push({ tabla, fila });
        (tablas[tabla] ??= []).push(fila);
        return { error: null };
      },
      delete: () => ((modo = "delete"), builder),
      then: (resolver: (v: { data: Fila[] | null; error: null }) => unknown) => {
        if (modo === "delete") {
          const borrar = new Set(filas());
          tablas[tabla] = (tablas[tabla] ?? []).filter((f) => !borrar.has(f));
          return Promise.resolve(resolver({ data: null, error: null }));
        }
        return Promise.resolve(resolver({ data: filas(), error: null }));
      },
    };
    return builder;
  };
  return { from, inserts };
}

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const ADMIN = "20000000-0000-4000-8000-000000000001";
const ANA = "20000000-0000-4000-8000-000000000003";
const OTRO = "20000000-0000-4000-8000-000000000009";
const CFG = { origin: "https://chat.ejemplo.test", token: "tok", accountId: 1 };
const SSO = "https://chat.ejemplo.test/app/login?email=ana%40example.test&sso_auth_token=t";

const m = vi.hoisted(() => ({
  sesion: null as unknown,
  admin: null as unknown,
  denial: null as string | null,
  gate: null as unknown,
  access: null as unknown,
  flags: { chatwoot_inbox: true } as Record<string, boolean>,
  cfg: null as unknown,
  sso: vi.fn(),
  agente: vi.fn(),
  tokenAgente: vi.fn(),
  listar: vi.fn(),
  aplicar: vi.fn(),
  cookieSet: vi.fn(),
  revalidate: vi.fn(),
  correos: {} as Record<string, string>,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => m.sesion }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => m.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleViewDenial: async () => m.denial,
  tenantAdminGate: async () => m.gate,
  getStudioAccess: async () => m.access,
}));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => m.flags }));
vi.mock("@/lib/studio/chatwoot/config", () => ({ chatwootConfig: () => m.cfg }));
vi.mock("@/lib/studio/chatwoot/platform-api", () => ({ obtenerEnlaceSso: m.sso, obtenerAgente: m.agente, obtenerTokenAgente: m.tokenAgente }));
vi.mock("@/lib/studio/chatwoot/account-api", () => ({ listarConversacionesRecientes: m.listar }));
vi.mock("@/lib/studio/chatwoot/webhook-procesar", () => ({ aplicarConversacion: m.aplicar }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: m.cookieSet }) }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));

import { desvincularAgente, pedirEnlaceSso, reconciliarBandeja, vincularAgente } from "../actions";

const form = (datos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
};
const INICIAL = { ok: false, error: null } as const;

function adminDoble(tablas: Tablas) {
  const base = dobleSupabase(tablas);
  return {
    ...base,
    auth: {
      admin: {
        getUserById: async (id: string) =>
          m.correos[id] ? { data: { user: { id, email: m.correos[id] } }, error: null } : { data: { user: null }, error: { message: "no" } },
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.denial = null;
  m.flags = { chatwoot_inbox: true };
  m.cfg = CFG;
  m.access = { role: "commercial", tenantId: T1, userId: ANA };
  m.gate = { ok: true, tenantId: T1, userId: ADMIN, role: "admin" };
  m.correos = { [ANA]: "Ana@Example.test", [OTRO]: "otro@example.test" };
});

describe("pedirEnlaceSso (SDD-0585)", () => {
  beforeEach(() => {
    m.sesion = dobleSupabase({
      chatwoot_agent_links: [
        { tenant_id: T1, user_id: ADMIN, chatwoot_user_id: 3 },
        { tenant_id: T2, user_id: ANA, chatwoot_user_id: 99 },
      ],
    });
  });

  it("sin permiso de ver el módulo: denied, sin pedir enlace ni dejar marca", async () => {
    m.denial = "No tienes permiso para ver esto.";
    expect(await pedirEnlaceSso()).toEqual({ ok: false, error: "denied" });
    expect(m.sso).not.toHaveBeenCalled();
    expect(m.cookieSet).not.toHaveBeenCalled();
  });

  it("con el flag apagado: denied", async () => {
    m.flags = { chatwoot_inbox: false };
    expect(await pedirEnlaceSso()).toEqual({ ok: false, error: "denied" });
    expect(m.sso).not.toHaveBeenCalled();
  });

  it("sin configuración: unconfigured", async () => {
    m.cfg = null;
    expect(await pedirEnlaceSso()).toEqual({ ok: false, error: "unconfigured" });
  });

  it("el vínculo de OTRO usuario o de OTRO tenant no sirve: unlinked", async () => {
    expect(await pedirEnlaceSso()).toEqual({ ok: false, error: "unlinked" });
    expect(m.sso).not.toHaveBeenCalled();
  });

  it("con su vínculo: pide el enlace de SU agente y deja la marca con su id", async () => {
    (m.sesion as ReturnType<typeof dobleSupabase>).from("chatwoot_agent_links").insert({
      tenant_id: T1, user_id: ANA, chatwoot_user_id: 7,
    });
    m.sso.mockResolvedValue({ ok: true, data: SSO });
    expect(await pedirEnlaceSso()).toEqual({ ok: true, url: SSO });
    expect(m.sso).toHaveBeenCalledWith(7, CFG);
    expect(m.cookieSet).toHaveBeenCalledWith("dtd_cw_sso", ANA, expect.objectContaining({ httpOnly: true, path: "/studio", sameSite: "lax" }));
  });

  it("si la Platform API falla: service y sin marca", async () => {
    (m.sesion as ReturnType<typeof dobleSupabase>).from("chatwoot_agent_links").insert({
      tenant_id: T1, user_id: ANA, chatwoot_user_id: 7,
    });
    m.sso.mockResolvedValue({ ok: false, error: "http_500" });
    expect(await pedirEnlaceSso()).toEqual({ ok: false, error: "service" });
    expect(m.cookieSet).not.toHaveBeenCalled();
  });
});

describe("vincularAgente (SDD-0585)", () => {
  let sesion: ReturnType<typeof dobleSupabase>;
  beforeEach(() => {
    sesion = dobleSupabase({ chatwoot_agent_links: [] });
    m.sesion = sesion;
    m.admin = adminDoble({
      user_tenants: [
        { tenant_id: T1, user_id: ANA, disabled_at: null },
        { tenant_id: T2, user_id: OTRO, disabled_at: null },
        { tenant_id: T1, user_id: "20000000-0000-4000-8000-000000000004", disabled_at: "2026-10-01" },
      ],
    });
    m.agente.mockResolvedValue({ ok: true, data: { id: 7, email: "ana@example.test", name: "Ana", accountIds: [1] } });
  });

  it("quien no es admin: denied, sin tocar nada", async () => {
    m.gate = { ok: false, denied: "No tienes permiso" };
    expect(await vincularAgente(INICIAL, form({ user_id: ANA, chatwoot_user_id: "7" }))).toEqual({ ok: false, error: "denied" });
    expect(m.agente).not.toHaveBeenCalled();
    expect(sesion.inserts).toEqual([]);
  });

  it.each([
    [{ user_id: "no-uuid", chatwoot_user_id: "7" }],
    [{ user_id: ANA, chatwoot_user_id: "0" }],
    [{ user_id: ANA, chatwoot_user_id: "siete" }],
  ])("datos inválidos %o: invalid", async (datos) => {
    expect(await vincularAgente(INICIAL, form(datos))).toEqual({ ok: false, error: "invalid" });
  });

  it("un usuario de otro tenant: not_member", async () => {
    expect(await vincularAgente(INICIAL, form({ user_id: OTRO, chatwoot_user_id: "7" }))).toEqual({ ok: false, error: "not_member" });
    expect(m.agente).not.toHaveBeenCalled();
  });

  it("un usuario deshabilitado: not_member", async () => {
    expect(
      await vincularAgente(INICIAL, form({ user_id: "20000000-0000-4000-8000-000000000004", chatwoot_user_id: "7" })),
    ).toEqual({ ok: false, error: "not_member" });
  });

  it("agente que la Platform App no ve: agent_not_found", async () => {
    m.agente.mockResolvedValue({ ok: false, error: "no_encontrado" });
    expect(await vincularAgente(INICIAL, form({ user_id: ANA, chatwoot_user_id: "7" }))).toEqual({ ok: false, error: "agent_not_found" });
  });

  it("agente de otra cuenta de Chatwoot: agent_other_account", async () => {
    m.agente.mockResolvedValue({ ok: true, data: { id: 7, email: "ana@example.test", name: "Ana", accountIds: [2] } });
    expect(await vincularAgente(INICIAL, form({ user_id: ANA, chatwoot_user_id: "7" }))).toEqual({ ok: false, error: "agent_other_account" });
    expect(sesion.inserts).toEqual([]);
  });

  it("correo distinto: email_mismatch y no se vincula (sería entrar como otra persona)", async () => {
    m.agente.mockResolvedValue({ ok: true, data: { id: 7, email: "otra@example.test", name: "Otra", accountIds: [1] } });
    expect(await vincularAgente(INICIAL, form({ user_id: ANA, chatwoot_user_id: "7" }))).toEqual({ ok: false, error: "email_mismatch" });
    expect(sesion.inserts).toEqual([]);
  });

  it("todo en orden: inserta en el tenant del admin, con created_by del admin", async () => {
    expect(await vincularAgente(INICIAL, form({ user_id: ANA, chatwoot_user_id: " 7 " }))).toEqual({ ok: true, error: null });
    expect(m.agente).toHaveBeenCalledWith(7, CFG);
    expect(sesion.inserts).toEqual([
      { tabla: "chatwoot_agent_links", fila: { tenant_id: T1, user_id: ANA, chatwoot_user_id: 7, created_by: ADMIN } },
    ]);
    expect(m.revalidate).toHaveBeenCalledWith("/studio/bandeja");
  });

  it("vínculo repetido (23505): duplicate", async () => {
    m.sesion = dobleSupabase({ chatwoot_agent_links: [] }, { errorInsert: { code: "23505" } });
    expect(await vincularAgente(INICIAL, form({ user_id: ANA, chatwoot_user_id: "7" }))).toEqual({ ok: false, error: "duplicate" });
  });
});

describe("desvincularAgente (SDD-0585)", () => {
  it("quien no es admin: denied y no borra", async () => {
    const tablas: Tablas = { chatwoot_agent_links: [{ tenant_id: T1, user_id: ANA, chatwoot_user_id: 7 }] };
    m.sesion = dobleSupabase(tablas);
    m.gate = { ok: false, denied: "No" };
    expect(await desvincularAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: false, error: "denied" });
    expect(tablas.chatwoot_agent_links).toHaveLength(1);
  });

  it("borra solo la fila del usuario en el tenant del admin", async () => {
    const tablas: Tablas = {
      chatwoot_agent_links: [
        { tenant_id: T1, user_id: ANA, chatwoot_user_id: 7 },
        { tenant_id: T2, user_id: ANA, chatwoot_user_id: 7 },
        { tenant_id: T1, user_id: ADMIN, chatwoot_user_id: 3 },
      ],
    };
    m.sesion = dobleSupabase(tablas);
    expect(await desvincularAgente(INICIAL, form({ user_id: ANA }))).toEqual({ ok: true, error: null });
    expect(tablas.chatwoot_agent_links).toEqual([
      { tenant_id: T2, user_id: ANA, chatwoot_user_id: 7 },
      { tenant_id: T1, user_id: ADMIN, chatwoot_user_id: 3 },
    ]);
  });
});

describe("pedirEnlaceSso con conversación (SDD-0585, 2.3)", () => {
  beforeEach(() => {
    m.sesion = dobleSupabase({ chatwoot_agent_links: [{ tenant_id: T1, user_id: ANA, chatwoot_user_id: 7 }] });
    m.sso.mockResolvedValue({ ok: true, data: SSO });
  });

  it("agrega sso_account_id y sso_conversation_id para que Chatwoot abra esa conversación", async () => {
    const r = await pedirEnlaceSso(12);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const u = new URL(r.url);
      expect(u.searchParams.get("sso_account_id")).toBe("1");
      expect(u.searchParams.get("sso_conversation_id")).toBe("12");
      expect(u.searchParams.get("sso_auth_token")).toBe("t");
    }
  });

  it("una conversación inválida se ignora: enlace normal", async () => {
    const r = await pedirEnlaceSso(-3);
    expect(r).toEqual({ ok: true, url: SSO });
  });
});

describe("reconciliarBandeja (SDD-0585, 2.3)", () => {
  const conv = { id: 12, inboxId: 3, estado: "open", noLeidos: 0, asignadoId: 7, ultimaActividad: null, fuenteActualizada: 5, telefonoUltimos10: null };
  beforeEach(() => {
    m.sesion = dobleSupabase({ chatwoot_agent_links: [{ tenant_id: T1, user_id: ANA, chatwoot_user_id: 7 }] });
    m.admin = { fake: "admin" };
    m.tokenAgente.mockResolvedValue({ ok: true, data: "tok-agente" });
    m.listar.mockResolvedValue({ ok: true, data: [conv, { ...conv, id: 13 }] });
    m.aplicar.mockResolvedValue({ nuevo: true, aplicado: true, clientId: null });
  });

  it("sin permiso de ver: denied, sin pedir el token del agente", async () => {
    m.denial = "No";
    expect(await reconciliarBandeja()).toEqual({ ok: false, error: "denied" });
    expect(m.tokenAgente).not.toHaveBeenCalled();
  });

  it("usa el token de SU agente, aplica en el tenant de la sesión sin evento y no devuelve el token", async () => {
    const r = await reconciliarBandeja();
    expect(r).toEqual({ ok: true, aplicadas: 2 });
    expect(m.tokenAgente).toHaveBeenCalledWith(7, CFG);
    expect(m.listar).toHaveBeenCalledWith(CFG, "tok-agente");
    expect(m.aplicar).toHaveBeenCalledWith({ admin: { fake: "admin" }, tenantId: T1 }, conv, null);
    expect(JSON.stringify(r)).not.toContain("tok-agente");
  });

  it("sin vínculo propio: unlinked; si Chatwoot falla: service", async () => {
    m.sesion = dobleSupabase({ chatwoot_agent_links: [{ tenant_id: T2, user_id: ANA, chatwoot_user_id: 7 }] });
    expect(await reconciliarBandeja()).toEqual({ ok: false, error: "unlinked" });
    m.sesion = dobleSupabase({ chatwoot_agent_links: [{ tenant_id: T1, user_id: ANA, chatwoot_user_id: 7 }] });
    m.listar.mockResolvedValue({ ok: false, error: "no_autorizado" });
    expect(await reconciliarBandeja()).toEqual({ ok: false, error: "service" });
  });
});
