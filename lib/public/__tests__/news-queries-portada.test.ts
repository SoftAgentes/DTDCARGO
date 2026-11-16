// @vitest-environment node
/**
 * SDD-0611 §11.5 · La portada (0547) se lee aparte: si la columna no existe todavía,
 * las noticias salen igual, sin portada propia (respaldo por categoría).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const pedidos: string[] = [];
let portadas: { data: unknown; error: unknown } = { data: [], error: null };

function consulta(resultado: () => { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ["eq", "neq", "order", "limit", "in"]) q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown, mal?: (e: unknown) => unknown) =>
    Promise.resolve(resultado()).then(ok, mal);
  return q;
}

vi.mock("../supabase-anon", () => ({
  getAnonClient: () => ({
    from: () => ({
      select: (columnas: string) => {
        pedidos.push(columnas);
        return consulta(() =>
          columnas.startsWith("slug,cover_")
            ? portadas
            : { data: [{ slug: "uno", title: "Uno" }, { slug: "dos", title: "Dos" }], error: null },
        );
      },
    }),
  }),
}));

describe("SDD-0611 §11.5 · conPortadas", () => {
  beforeEach(() => {
    pedidos.length = 0;
  });

  it("une la portada a su noticia por slug", async () => {
    portadas = {
      data: [{ slug: "uno", cover_image_url: "/fotos/a.webp", cover_license: "CC0" }],
      error: null,
    };
    const { listPublishedPosts } = await import("../news-queries");
    const posts = await listPublishedPosts();
    expect(posts.map((p) => p.slug)).toEqual(["uno", "dos"]);
    expect(posts[0].cover_license).toBe("CC0");
    expect(posts[1].cover_license).toBeUndefined();
    expect(pedidos.some((p) => p.includes("cover_license_verified_at"))).toBe(false);
  });

  it("sin la 0547 (columna ausente) las noticias salen igual, sin portada propia", async () => {
    portadas = { data: null, error: { code: "42703", message: "column news_posts.cover_image_url does not exist" } };
    const { listPublishedPosts } = await import("../news-queries");
    const posts = await listPublishedPosts();
    expect(posts).toHaveLength(2);
    expect(posts[0].cover_image_url).toBeUndefined();
  });
});
