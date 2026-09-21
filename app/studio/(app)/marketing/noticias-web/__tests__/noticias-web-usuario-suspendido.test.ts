// @vitest-environment node
/**
 * Generador de noticias del sitio público con un usuario SUSPENDIDO — SDD-0498.
 *
 * `requireAdmin()` y `requireAdminWithTenant()` leían `user_tenants` SIN
 * `.eq("user_id", …)` y SIN `.is("disabled_at", null)`. Es la puerta con más
 * consecuencia de las cinco del barrido, por dos razones medidas en el repo:
 *
 *  - las policies de `news_posts` y `seo_drafts` (migraciones 0053 y 0055, sin
 *    redefinición posterior) exigen `role = 'admin'` pero NO miran
 *    `disabled_at` — a diferencia de `accounting_settings` (0133) o
 *    `freight_carriers` (0330). Acá el gate de la aplicación es el único;
 *  - las ocho actions de generación llaman a la API de Anthropic y no tocan la
 *    DB, así que ninguna RLS las cubre: un suspendido quemaba la API key.
 *
 * LADO NEGATIVO: al suspendido no se le publica nada ni se le llama a Anthropic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const USER = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";
const SUSPENDIDO = "2026-09-01T12:00:00Z";
const DENY_MSG = "Acceso restringido a admins";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

/** La API de Anthropic: acá se ve si una generación llegó a costar plata. */
const anthropicCreateMock = vi.fn(async () => ({ content: [{ type: "text", text: "{}" }] }));
const anthropicCtorMock = vi.fn(() => ({ messages: { create: anthropicCreateMock } }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { constructor() { return anthropicCtorMock(); } } }));

const getNextWriterMock = vi.fn(async () => ({ authorName: "Redacción DTD", authorRole: null }));
vi.mock("@/lib/news/writers", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    getNextWriter: (...a: unknown[]) => getNextWriterMock(...(a as [])),
    getActiveWriters: async () => [],
  };
});

let db: DoubleHandle;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { saveDraft, publishPost, generateHeadlines, getPublishPreview } = await import("../actions");

function conMembresia(role: string, disabled_at: string | null) {
  db = supabaseDouble({
    userId: USER,
    memberships: [{ user_id: USER, tenant_id: TENANT, role, disabled_at, warehouse_scope: "all" }],
  });
}

const ARTICULO = "Contenido sintético del artículo. ".repeat(20);

function draft() {
  return {
    topic: "Aranceles 2026",
    tone: "informativo" as const,
    tipo: "informativo" as const,
    categoria: "importa-sin-perder-plata" as const,
    headlines: [],
    selected_headline: "",
    bullets: [],
    article_markdown: ARTICULO,
    secondary_keywords: [],
    pain_points: [],
    current_step: 3 as const,
  };
}

function publicacion() {
  return {
    tipo: "informativo" as const,
    categoria: "importa-sin-perder-plata" as const,
    headline: "Titular sintético de prueba",
    article_markdown: ARTICULO,
  };
}

const PUERTAS: [string, () => Promise<{ ok: boolean; error?: string }>][] = [
  ["saveDraft", () => saveDraft(draft()) as Promise<{ ok: boolean; error?: string }>],
  ["publishPost", () => publishPost(publicacion()) as Promise<{ ok: boolean; error?: string }>],
  [
    "getPublishPreview",
    () =>
      getPublishPreview({ tipo: "informativo", headline: "Titular" }) as Promise<{
        ok: boolean;
        error?: string;
      }>,
  ],
  [
    "generateHeadlines",
    () =>
      generateHeadlines("Aranceles 2026", "informativo") as Promise<{
        ok: boolean;
        error?: string;
      }>,
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  db = supabaseDouble({ userId: USER, memberships: [] });
});

describe("noticias-web · fail-closed por disabled_at (SDD-0498)", () => {
  for (const [nombre, invocar] of PUERTAS) {
    it(`${nombre} deniega a un admin SUSPENDIDO, sin escribir ni llamar a Anthropic`, async () => {
      conMembresia("admin", SUSPENDIDO);

      const res = await invocar();

      expect(res.ok).toBe(false);
      expect(res.error).toBe(DENY_MSG);
      expect(db.writes).toEqual([]);
      expect(anthropicCtorMock).not.toHaveBeenCalled();
      expect(anthropicCreateMock).not.toHaveBeenCalled();
    });
  }

  it("la membresía admin de OTRO usuario no habilita al de la sesión", async () => {
    db = supabaseDouble({
      userId: USER,
      memberships: [
        { user_id: OTRO, tenant_id: TENANT, role: "admin", disabled_at: null, warehouse_scope: "all" },
        { user_id: USER, tenant_id: TENANT, role: "marketing", disabled_at: null, warehouse_scope: "all" },
      ],
    });

    const res = await publishPost(publicacion());

    expect(res.ok).toBe(false);
    expect((res as { error?: string }).error).toBe(DENY_MSG);
    expect(db.writes).toEqual([]);
  });

  it("un admin ACTIVO sí guarda el borrador (control: el gate no se cerró de más)", async () => {
    conMembresia("admin", null);

    const res = await saveDraft(draft());

    expect(res.ok).toBe(true);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({
      table: "seo_drafts",
      op: "insert",
      row: { tenant_id: TENANT, created_by: USER },
    });
  });

  it("un `marketing` activo sigue sin poder publicar en el sitio público", async () => {
    conMembresia("marketing", null);

    const res = await publishPost(publicacion());

    expect(res.ok).toBe(false);
    expect((res as { error?: string }).error).toBe(DENY_MSG);
    expect(db.writes).toEqual([]);
  });
});
