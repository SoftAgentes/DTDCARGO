import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Las páginas de /noticias leen news_posts con la anon. Sin `revalidate` Next las
// prerrenderiza estáticas en el build y una lectura fallida queda horneada.
// Rutas relativas a app/noticias. El sitemap también lee news_posts.
const PAGINAS = ["page.tsx", join("[slug]", "page.tsx"), join("..", "sitemap.ts")];

describe("/noticias no se hornea vacía en el build", () => {
  it("hay tres archivos que vigilar", () => {
    expect(PAGINAS).toHaveLength(3);
  });
  for (const rel of PAGINAS) {
    it(`${rel} exporta revalidate finito`, () => {
      const src = readFileSync(join(__dirname, "..", rel), "utf8");
      const m = src.match(/export const revalidate\s*=\s*(\d+)\s*;/);
      expect(m, "falta export const revalidate").not.toBeNull();
      expect(Number(m![1])).toBeGreaterThan(0);
      expect(Number(m![1])).toBeLessThanOrEqual(3600);
    });
  }
});
