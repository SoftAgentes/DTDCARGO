// @vitest-environment node
/**
 * SDD-0611 §3 (requisito previo) y criterio 3 · El servidor rechaza publicar un
 * texto con una marca `[VERIFICAR`, en cualquier forma, también al llamar a la
 * acción directamente (sin pasar por el botón del navegador).
 *
 * Antes de la 0611 la regla vivía solo en `Step3Article.tsx`: una llamada directa
 * a `publishPost` publicaba `[VERIFICAR: …]`, y `verifyMarkers` ni siquiera
 * contaba la marca vacía.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));
vi.mock("@anthropic-ai/sdk", () => ({ default: class {} }));
vi.mock("@/lib/news/writers", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    getNextWriter: async () => ({ authorName: "Redacción DTD", authorRole: null }),
    getActiveWriters: async () => [],
  };
});

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { publishPost } = await import("../actions");

const CUERPO = "Contenido sintético del artículo, sin datos reales. ".repeat(10);

function publicar(article_markdown: string, headline = "Importa · Titular sintético de prueba") {
  return publishPost({
    tipo: "informativo",
    categoria: "importa-sin-perder-plata",
    headline,
    article_markdown,
  });
}

function insertsEnNoticias(): unknown[] {
  return db.writes.filter((w) => (w as { table?: string }).table === "news_posts");
}

beforeEach(() => {
  db = supabaseDouble({
    userId: USER,
    memberships: [{ user_id: USER, tenant_id: TENANT, role: "admin", disabled_at: null, warehouse_scope: "all" }],
  });
});

describe("SDD-0611 · publishPost rechaza marcas [VERIFICAR en el servidor", () => {
  const MARCAS = [
    "[VERIFICAR: 30%]",
    "[VERIFICAR]",
    "[VERIFICAR: ]",
    "[verificar: x]",
    "[ VERIFICAR dato]",
    "［VERIFICAR: ancho completo]",
    "[VERI­FICAR: guion blando]",
    "[enlace](https://ejemplo.test/?q=%5BVERIFICAR%5D)",
  ];

  for (const marca of MARCAS) {
    it(`rechaza el cuerpo con ${JSON.stringify(marca)}`, async () => {
      const res = await publicar(`${CUERPO}\n\nEl dato ${marca} queda pendiente.`);
      expect(res.ok).toBe(false);
      expect((res as { error?: string }).error).toMatch(/VERIFICAR/);
      expect(insertsEnNoticias()).toEqual([]);
    });
  }

  it("rechaza una marca en el titular", async () => {
    const res = await publicar(CUERPO, "Importa · Subió [VERIFICAR] este año");
    expect(res.ok).toBe(false);
    expect((res as { error?: string }).error).toMatch(/VERIFICAR/);
    expect(insertsEnNoticias()).toEqual([]);
  });

  it("control: sin marcas, el rechazo por marcas no aparece", async () => {
    const res = await publicar(CUERPO);
    expect((res as { error?: string }).error ?? "").not.toMatch(/VERIFICAR/);
  });
});
