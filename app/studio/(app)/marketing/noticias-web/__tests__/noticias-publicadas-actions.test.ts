// @vitest-environment node
/**
 * SDD-0625 · Corregir, retirar y volver a publicar una noticia desde el Studio.
 *
 * Doble de PostgREST que honra los filtros (SDD-0498): un usuario suspendido o
 * sin rol admin no ve su membresía y la action no escribe ni llama RPC. Lo que
 * se fija:
 *   - solo admin activo;
 *   - la edición escribe EXACTAMENTE las columnas permitidas: nunca slug,
 *     published ni el origen;
 *   - una marca [VERIFICAR bloquea guardar, en cualquier campo;
 *   - la categoría no cambia de tipo;
 *   - el retiro exige motivo de la lista, nota con «otro» y nota sin datos
 *     personales, antes de tocar la base;
 *   - los errores de la base se traducen sin mostrar el texto de Postgres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseDouble, type DoubleHandle, type DoubleOptions, type MembershipRow } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const POST = "44444444-4444-4444-8444-444444444444";
const OTRO_TENANT = "55555555-5555-4555-8555-555555555555";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { guardarEdicion, retirarNoticia, volverAPublicar } = await import("../publicadas/actions");

const CUERPO = "El envío FCL desde Yiwu tarda normalmente de 45 a 55 días. ".repeat(6);
const EDICION = {
  title: "Importa · Tiempos de Yiwu a Puerto Cabello",
  excerpt: "Cuánto tarda de verdad un contenedor.",
  body_markdown: CUERPO,
  categoria: "importa-sin-perder-plata",
  meta_description: "Tiempo real de tránsito FCL",
  focus_keyword: "tiempo de tránsito",
};

const FILA = {
  id: POST,
  tenant_id: TENANT,
  slug: "tiempos-yiwu-puerto-cabello",
  tipo: "informativo",
  categoria: "importa-sin-perder-plata",
  published: true,
};

function admin(extra: Partial<MembershipRow> = {}): MembershipRow {
  return { user_id: USER, tenant_id: TENANT, role: "admin", disabled_at: null, warehouse_scope: "all", ...extra };
}

function montar(opts: { membership?: MembershipRow; filas?: Record<string, unknown>[]; rpc?: DoubleOptions["rpc"] } = {}) {
  db = supabaseDouble({
    userId: USER,
    memberships: [opts.membership ?? admin()],
    tables: { news_posts: opts.filas ?? [FILA] },
    rpc: opts.rpc,
  });
}

const escrituras = () => db.writes.filter((w) => w.table === "news_posts");

beforeEach(() => {
  revalidatePath.mockClear();
  montar();
});

describe("SDD-0625 · guardarEdicion", () => {
  it("admin activo: escribe solo titular, bajada, cuerpo, categoría, SEO y tiempo de lectura", async () => {
    const res = await guardarEdicion(POST, EDICION);
    expect(res).toEqual({ ok: true, slug: FILA.slug });
    const [w] = escrituras();
    expect(w.op).toBe("update");
    expect(Object.keys(w.row ?? {}).sort()).toEqual(
      ["body_markdown", "categoria", "excerpt", "focus_keyword", "meta_description", "read_time_min", "title"],
    );
    expect(w.row).not.toHaveProperty("slug");
    expect(w.row).not.toHaveProperty("published");
    expect(revalidatePath).toHaveBeenCalledWith(`/noticias/${FILA.slug}`);
    expect(revalidatePath).toHaveBeenCalledWith("/noticias");
  });

  it("un slug en el formulario no llega a la base", async () => {
    await guardarEdicion(POST, { ...EDICION, slug: "otro-slug" } as typeof EDICION);
    expect(escrituras()[0].row).not.toHaveProperty("slug");
  });

  it("rechaza a un admin suspendido sin leer ni escribir la noticia", async () => {
    montar({ membership: admin({ disabled_at: "2026-11-01T00:00:00Z" }) });
    const res = await guardarEdicion(POST, EDICION);
    expect(res.ok).toBe(false);
    expect(escrituras()).toEqual([]);
    expect(db.reads).not.toContain("news_posts");
  });

  it("rechaza a quien no es admin (marketing)", async () => {
    montar({ membership: admin({ role: "marketing" }) });
    const res = await guardarEdicion(POST, EDICION);
    expect(res.ok).toBe(false);
    expect(escrituras()).toEqual([]);
  });

  for (const campo of ["title", "excerpt", "body_markdown", "meta_description", "focus_keyword"] as const) {
    it(`una marca [VERIFICAR en ${campo} bloquea guardar`, async () => {
      const res = await guardarEdicion(POST, { ...EDICION, [campo]: `${EDICION[campo]} [VERIFICAR: dato]` });
      expect(res.ok).toBe(false);
      expect((res as { error: string }).error).toMatch(/VERIFICAR/);
      expect(escrituras()).toEqual([]);
    });
  }

  it("la categoría no cambia de tipo", async () => {
    const res = await guardarEdicion(POST, { ...EDICION, categoria: "historias-reales" });
    expect(res.ok).toBe(false);
    expect(escrituras()).toEqual([]);
  });

  it("una noticia de otro tenant o retirada no se edita", async () => {
    montar({ filas: [{ ...FILA, tenant_id: OTRO_TENANT }] });
    expect((await guardarEdicion(POST, EDICION)).ok).toBe(false);
    montar({ filas: [{ ...FILA, published: false }] });
    expect((await guardarEdicion(POST, EDICION)).ok).toBe(false);
    expect(escrituras()).toEqual([]);
  });

  it("cuerpo corto o titular vacío no se guardan", async () => {
    expect((await guardarEdicion(POST, { ...EDICION, body_markdown: "corto" })).ok).toBe(false);
    expect((await guardarEdicion(POST, { ...EDICION, title: "   " })).ok).toBe(false);
    expect(escrituras()).toEqual([]);
  });

  it("un id que no es uuid no consulta", async () => {
    expect((await guardarEdicion("1 or 1=1", EDICION)).ok).toBe(false);
    expect(db.reads).not.toContain("news_posts");
  });
});

describe("SDD-0625 · retirarNoticia (SDD-0611 §4.11)", () => {
  it("con motivo de la lista llama a news_retirar y revalida", async () => {
    montar({ rpc: { news_retirar: { data: FILA.slug, error: null } } });
    const res = await retirarNoticia(POST, "dato_incorrecto", "  el tiempo de tránsito estaba mal ");
    expect(res).toEqual({ ok: true, slug: FILA.slug });
    expect(db.rpcCalls).toEqual([
      { name: "news_retirar", args: { p_post_id: POST, p_motivo: "dato_incorrecto", p_nota: "el tiempo de tránsito estaba mal" } },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/noticias/${FILA.slug}`);
  });

  it.each([
    ["", ""],
    ["no_existe", ""],
    ["otro", "   "],
    ["dato_incorrecto", "llámame al 0414-1234567"],
  ])("motivo %j / nota %j: no llama a la base", async (motivo, nota) => {
    const res = await retirarNoticia(POST, motivo, nota);
    expect(res.ok).toBe(false);
    expect(db.rpcCalls).toEqual([]);
  });

  it("sin admin no llama a la base", async () => {
    montar({ membership: admin({ role: "commercial" }) });
    expect((await retirarNoticia(POST, "tono", "")).ok).toBe(false);
    expect(db.rpcCalls).toEqual([]);
  });

  it("si ya no está publicada, lo dice sin el texto de Postgres", async () => {
    montar({ rpc: { news_retirar: { data: null, error: { code: "P0002", message: "SDD-0611: interno" } } } });
    const res = await retirarNoticia(POST, "tono", "");
    expect(res).toEqual({ ok: false, error: "Esa noticia ya no está publicada" });
  });
});

describe("SDD-0625 · volverAPublicar", () => {
  it("llama a news_volver_a_publicar y revalida", async () => {
    montar({ rpc: { news_volver_a_publicar: { data: FILA.slug, error: null } } });
    expect(await volverAPublicar(POST)).toEqual({ ok: true, slug: FILA.slug });
    expect(db.rpcCalls).toEqual([{ name: "news_volver_a_publicar", args: { p_post_id: POST } }]);
    expect(revalidatePath).toHaveBeenCalledWith("/noticias");
  });

  it("el CHECK de marcas (23514) se explica como marcas pendientes", async () => {
    montar({ rpc: { news_volver_a_publicar: { data: null, error: { code: "23514", message: "violates check" } } } });
    const res = await volverAPublicar(POST);
    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toMatch(/VERIFICAR/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un suspendido no llama a la base", async () => {
    montar({ membership: admin({ disabled_at: "2026-11-01T00:00:00Z" }) });
    expect((await volverAPublicar(POST)).ok).toBe(false);
    expect(db.rpcCalls).toEqual([]);
  });
});
