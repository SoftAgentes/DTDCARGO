// @vitest-environment node
/**
 * SDD-0608 · `/api/discord/interacciones` de punta a punta, con firma Ed25519
 * real y un doble del cliente `service_role` que filtra de verdad.
 *
 * Cada rechazo se compara con un control verde que cambia UNA sola cosa
 * (rojo causal): la misma consulta pasa con enlace, permiso y firma buenos.
 */
import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFalso, type OpcionesFalsas, type TablasFalsas } from "@/lib/studio/discord/consulta/__tests__/fake-admin";
import { DTD_DISCORD_GUILD_ID, TOPE_POR_MINUTO } from "@/lib/studio/discord/consulta/comando";

let actual: ReturnType<typeof adminFalso> | null = null;
let adminRompe = false;
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    if (adminRompe || !actual) throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada");
    return actual.admin;
  },
}));

const { POST } = await import("../route");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLICA = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");

const TENANT = "00000000-0000-4000-8000-000000000001";
const OTRO_TENANT = "00000000-0000-4000-8000-000000000002";
const USUARIO = "11111111-1111-4111-8111-111111111111";
const DISCORD_SAM = "123456789012345678";
const DISCORD_EXTRANO = "999999999999999999";

function interaccion(cambios: Record<string, unknown> = {}, nombre: unknown = "Pedro Pérez") {
  return {
    type: 2,
    guild_id: DTD_DISCORD_GUILD_ID,
    member: { user: { id: DISCORD_SAM } },
    data: { name: "cliente", options: [{ name: "nombre", type: 3, value: nombre }] },
    ...cambios,
  };
}

function pedido(cuerpo: unknown, opciones: { firma?: "buena" | "mala" | "ninguna"; texto?: string } = {}) {
  const texto = opciones.texto ?? JSON.stringify(cuerpo);
  const ts = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opciones.firma !== "ninguna") {
    const firmado = opciones.firma === "mala" ? `${texto} ` : texto;
    headers["x-signature-timestamp"] = ts;
    headers["x-signature-ed25519"] = sign(null, Buffer.from(ts + firmado), privateKey).toString("hex");
  }
  return new Request("https://dtdcargo.com/api/discord/interacciones", { method: "POST", headers, body: texto });
}

const BASE: TablasFalsas = {
  user_profiles: [{ user_id: USUARIO, discord_user_id: DISCORD_SAM }],
  user_tenants: [{ user_id: USUARIO, tenant_id: TENANT, role: "operations", disabled_at: null, warehouse_scope: "all" }],
  studio_role_module_overrides: [],
};

const PEDROS = [
  { markbox: "DTD-0001", name: "Pedro Pérez", phone: "0412-555-0001", email: "pedro1@ejemplo.test", address: "Av. Siempre Viva 1", total_facturado: 1234.56, estado_envio: "en_transito" },
  { markbox: "DTD-0002", name: "PEDRO JOSE PEREZ", phone: "0414-555-0002", email: "pedro2@ejemplo.test", address: "Calle 2", total_facturado: 99, estado_envio: "entregado" },
  { markbox: "DTD-0003", name: "Pérez Gómez, Pedro", phone: "0416-555-0003", email: "p3@ejemplo.test", address: "Calle 3", total_facturado: 7, estado_envio: "recibido" },
];

function preparar(tablas: TablasFalsas = BASE, opciones: OpcionesFalsas = { busqueda: PEDROS }) {
  actual = adminFalso(structuredClone(tablas), opciones);
  return actual;
}

async function contenido(res: Response) {
  const json = (await res.json()) as { type: number; data: { content: string; flags: number; allowed_mentions: unknown } };
  return json;
}

beforeEach(() => {
  adminRompe = false;
  vi.stubEnv("DISCORD_CONSULTA_PUBLIC_KEY", PUBLICA);
  vi.stubEnv("DISCORD_TENANT_ID", TENANT);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  actual = null;
});

describe("firma", () => {
  it("control verde: firma buena y comando válido → 200 con resultados", async () => {
    const f = preparar();
    const res = await POST(pedido(interaccion()));
    expect(res.status).toBe(200);
    expect((await contenido(res)).data.content).toContain("DTD-0001");
    expect(f.busquedas).toHaveLength(1);
  });

  it.each(["mala", "ninguna"] as const)("firma %s → 401 y no toca la base", async (firma) => {
    const f = preparar();
    const res = await POST(pedido(interaccion(), { firma }));
    expect(res.status).toBe(401);
    expect(f.log).toEqual([]);
    expect(f.registros).toEqual([]);
  });

  it("sin DISCORD_CONSULTA_PUBLIC_KEY → 503 y no toca la base", async () => {
    vi.stubEnv("DISCORD_CONSULTA_PUBLIC_KEY", "");
    const f = preparar();
    const res = await POST(pedido(interaccion()));
    expect(res.status).toBe(503);
    expect(f.log).toEqual([]);
  });

  it("PING firmado → PONG, sin tocar la base", async () => {
    const f = preparar();
    const res = await POST(pedido({ type: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
    expect(f.log).toEqual([]);
  });
});

describe("servidor y comando", () => {
  it.each<[string, Record<string, unknown>]>([
    ["otro servidor", { guild_id: "222222222222222222" }],
    ["mensaje directo (sin guild ni member)", { guild_id: undefined, member: undefined, user: { id: DISCORD_SAM } }],
    ["member sin id válido", { member: { user: { id: "@everyone" } } }],
  ])("%s → rechazo efímero y no toca la base", async (_n, cambios) => {
    const f = preparar();
    const json = await contenido(await POST(pedido(interaccion(cambios))));
    expect(json.data.content).toMatch(/solo funciona en el servidor de DTD Cargo/);
    expect(json.data.flags).toBe(64);
    expect(f.log).toEqual([]);
  });

  it.each<[unknown, string]>([["", "vacío"], ["a", "una letra"], ["x".repeat(61), "61 caracteres"], [42, "no texto"]])(
    "término inválido (%s, %s) → aviso y no busca",
    async (nombre) => {
      const f = preparar();
      const json = await contenido(await POST(pedido(interaccion({}, nombre))));
      expect(json.data.content).toMatch(/entre 2 y 60 caracteres/);
      expect(f.busquedas).toEqual([]);
    },
  );
});

describe("autorización", () => {
  it("usuario de Discord sin enlace → «No autorizado», registrado, sin búsqueda", async () => {
    const f = preparar({ ...BASE, user_profiles: [{ user_id: USUARIO, discord_user_id: DISCORD_EXTRANO }] });
    const json = await contenido(await POST(pedido(interaccion())));
    expect(json.data.content).toMatch(/^No autorizado\. Tu usuario de Discord no está enlazado/);
    expect(f.busquedas).toEqual([]);
    expect(f.registros).toEqual([
      { discord_user_id: DISCORD_SAM, user_id: null, tenant_id: null, termino: "Pedro Pérez", resultado: "sin_enlace" },
    ]);
  });

  it("columna discord_user_id ausente (0514 sin aplicar) → no disponible, sin búsqueda", async () => {
    const f = preparar(BASE, { busqueda: PEDROS, conError: ["user_profiles"] });
    const json = await contenido(await POST(pedido(interaccion())));
    expect(json.data.content).toMatch(/no está disponible/);
    expect(f.busquedas).toEqual([]);
  });

  it("el mismo ID de Discord en dos perfiles → ambiguo, sin búsqueda", async () => {
    const f = preparar({
      ...BASE,
      user_profiles: [
        { user_id: USUARIO, discord_user_id: DISCORD_SAM },
        { user_id: "22222222-2222-4222-8222-222222222222", discord_user_id: DISCORD_SAM },
      ],
    });
    const json = await contenido(await POST(pedido(interaccion())));
    expect(json.data.content).toMatch(/más de un perfil/);
    expect(f.busquedas).toEqual([]);
  });

  it.each<[string, TablasFalsas]>([
    ["membresía desactivada", { user_tenants: [{ ...BASE.user_tenants![0], disabled_at: "2026-11-01T00:00:00Z" }] }],
    ["membresía en otro tenant", { user_tenants: [{ ...BASE.user_tenants![0], tenant_id: OTRO_TENANT }] }],
    ["sin membresía", { user_tenants: [] }],
    ["rol sin clientes (almacén)", { user_tenants: [{ ...BASE.user_tenants![0], role: "warehouse" }] }],
    ["rol sin clientes (marketing)", { user_tenants: [{ ...BASE.user_tenants![0], role: "marketing" }] }],
    [
      "desvío del tenant que le quita clientes a operaciones",
      { studio_role_module_overrides: [{ tenant_id: TENANT, role: "operations", module_id: "clients", can_view: false, can_edit: false }] },
    ],
  ])("%s → sin permiso, sin búsqueda", async (_n, cambio) => {
    const f = preparar({ ...BASE, ...cambio });
    const json = await contenido(await POST(pedido(interaccion())));
    expect(json.data.content).toMatch(/^No autorizado\. Tu usuario del Studio no tiene permiso/);
    expect(f.busquedas).toEqual([]);
    expect(f.registros.at(-1)?.resultado).toBe("sin_permiso");
  });

  it("un desvío de OTRO tenant no le quita el permiso (control)", async () => {
    const f = preparar({
      ...BASE,
      studio_role_module_overrides: [{ tenant_id: OTRO_TENANT, role: "operations", module_id: "clients", can_view: false, can_edit: false }],
    });
    await POST(pedido(interaccion()));
    expect(f.busquedas).toHaveLength(1);
  });

  it("si los desvíos no se pueden leer, no responde (un desvío puede quitar permiso)", async () => {
    const f = preparar(BASE, { busqueda: PEDROS, conError: ["studio_role_module_overrides"] });
    const json = await contenido(await POST(pedido(interaccion())));
    expect(json.data.content).toMatch(/no está disponible/);
    expect(f.busquedas).toEqual([]);
  });

  it("admin pasa sin leer desvíos (control)", async () => {
    const f = preparar({ ...BASE, user_tenants: [{ ...BASE.user_tenants![0], role: "admin" }] });
    await POST(pedido(interaccion()));
    expect(f.busquedas).toHaveLength(1);
    expect(f.log).not.toContain("from(studio_role_module_overrides)");
  });

  it.each([["sin variable", ""], ["valor que no es UUID", "tenant-1"]])(
    "DISCORD_TENANT_ID %s → no disponible, registrado, sin búsqueda",
    async (_n, valor) => {
      vi.stubEnv("DISCORD_TENANT_ID", valor);
      const f = preparar();
      const json = await contenido(await POST(pedido(interaccion())));
      expect(json.data.content).toMatch(/no está disponible/);
      expect(f.busquedas).toEqual([]);
      expect(f.registros.at(-1)?.resultado).toBe("no_disponible");
    },
  );

  it("sin service_role → no disponible", async () => {
    preparar();
    adminRompe = true;
    const json = await contenido(await POST(pedido(interaccion())));
    expect(json.data.content).toMatch(/no está disponible/);
  });
});

describe("registro y límite", () => {
  it("si no se puede registrar (0516 sin aplicar), no busca", async () => {
    const f = preparar(BASE, { busqueda: PEDROS, errorRegistro: true });
    const json = await contenido(await POST(pedido(interaccion())));
    expect(json.data.content).toMatch(/no está disponible/);
    expect(f.busquedas).toEqual([]);
  });

  it("registra quién, término y resultado de cada consulta", async () => {
    const f = preparar();
    await POST(pedido(interaccion()));
    expect(f.registros).toEqual([
      { discord_user_id: DISCORD_SAM, user_id: USUARIO, tenant_id: TENANT, termino: "Pedro Pérez", resultado: "ok" },
    ]);
  });

  it(`la consulta ${TOPE_POR_MINUTO + 1} del minuto queda frenada y sin búsqueda`, async () => {
    const f = preparar();
    for (let i = 0; i < TOPE_POR_MINUTO; i++) await POST(pedido(interaccion()));
    expect(f.busquedas).toHaveLength(TOPE_POR_MINUTO);
    const json = await contenido(await POST(pedido(interaccion())));
    expect(json.data.content).toMatch(/Espera un minuto/);
    expect(f.busquedas).toHaveLength(TOPE_POR_MINUTO);
    expect(f.registros.at(-1)?.resultado).toBe("limite");
  });
});

describe("búsqueda y respuesta", () => {
  it("los comodines viajan tal cual a la función de la base (no hay .ilike)", async () => {
    for (const termino of ["%%", "a_b", "Pe*ez", "100% real", "\\x"]) {
      const f = preparar();
      await POST(pedido(interaccion({}, termino)));
      expect(f.busquedas).toEqual([{ p_tenant_id: TENANT, p_termino: termino, p_limite: 11 }]);
    }
  });

  it("muestra a lo sumo 10 y pide afinar si hay más", async () => {
    const muchos = Array.from({ length: 15 }, (_, i) => ({ markbox: `DTD-${1000 + i}`, name: `Pedro ${i}` }));
    preparar(BASE, { busqueda: muchos });
    const { data } = await contenido(await POST(pedido(interaccion({}, "pedro"))));
    expect(data.content.match(/^• /gm)).toHaveLength(10);
    expect(data.content).toContain("DTD-1009");
    expect(data.content).not.toContain("DTD-1010");
    expect(data.content).toMatch(/Hay más coincidencias\. Escribe el nombre más completo/);
  });

  it("con exactamente 10 no pide afinar (control)", async () => {
    const diez = Array.from({ length: 10 }, (_, i) => ({ markbox: `DTD-${1000 + i}`, name: `Pedro ${i}` }));
    preparar(BASE, { busqueda: diez });
    const { data } = await contenido(await POST(pedido(interaccion({}, "pedro"))));
    expect(data.content.match(/^• /gm)).toHaveLength(10);
    expect(data.content).not.toMatch(/Hay más coincidencias/);
  });

  it("«hay tres Pedro Pérez»: nombre, código y enlace a la ficha; nada más", async () => {
    preparar();
    const { data } = await contenido(await POST(pedido(interaccion())));
    expect(data.content).toContain("Encontré 3 clientes con «Pedro Pérez»");
    for (const p of PEDROS) {
      expect(data.content).toContain(`código **${p.markbox}**`);
      expect(data.content).toContain(`<https://dtdcargo.com/studio/clientes/${p.markbox}>`);
    }
    // Campos prohibidos: la búsqueda los trajo a propósito y no pueden salir.
    for (const p of PEDROS) {
      for (const prohibido of [p.phone, p.email, p.address, String(p.total_facturado), p.estado_envio]) {
        expect(data.content).not.toContain(prohibido);
      }
    }
    expect(data.content).not.toMatch(/MARKBOX/i);
  });

  it("sin coincidencias → lo dice y no inventa", async () => {
    preparar(BASE, { busqueda: [] });
    const { data } = await contenido(await POST(pedido(interaccion({}, "Zacarías"))));
    expect(data.content).toMatch(/No encontré clientes con «Zacarías»/);
  });

  it("toda respuesta de comando es efímera y sin menciones", async () => {
    const casos: Array<() => Request> = [
      () => (preparar(), pedido(interaccion())),
      () => (preparar({ ...BASE, user_profiles: [] }), pedido(interaccion())),
      () => (preparar(), pedido(interaccion({ guild_id: "222222222222222222" }))),
      () => (preparar(), pedido(interaccion({}, "a"))),
      () => (preparar(BASE, { busqueda: PEDROS, errorBusqueda: true }), pedido(interaccion())),
    ];
    for (const caso of casos) {
      const json = await contenido(await POST(caso()));
      expect(json.type).toBe(4);
      expect(json.data.flags).toBe(64);
      expect(json.data.allowed_mentions).toEqual({ parse: [] });
    }
  });
});
