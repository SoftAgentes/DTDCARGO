import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RUNTIME_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function runtimeSources(root: string): string[] {
  const paths: string[] = [];
  const visit = (path: string) => {
    for (const entry of readdirSync(path)) {
      const child = join(path, entry);
      const stats = statSync(child);
      if (stats.isDirectory()) {
        if (entry !== "__tests__") visit(child);
        continue;
      }
      const extension = entry.slice(entry.lastIndexOf("."));
      if (RUNTIME_EXTENSIONS.has(extension)) paths.push(child);
    }
  };
  visit(join(process.cwd(), root));
  return paths;
}

describe("frontera de privacidad del GPS de clientes", () => {
  it("no envía direcciones a la API pública de Nominatim", () => {
    const offenders = [...runtimeSources("app"), ...runtimeSources("lib")]
      .filter((path) =>
        readFileSync(path, "utf8").includes("nominatim.openstreetmap.org"),
      );

    expect(offenders).toEqual([]);
    expect(existsSync(join(process.cwd(), "lib/studio/geocoding.ts"))).toBe(
      false,
    );
  });

  it("conserva captura GPS local y retira el geocodificado automático", () => {
    const drawer = readFileSync(
      join(
        process.cwd(),
        "app/studio/(app)/clientes/_components/ClientDrawer.tsx",
      ),
      "utf8",
    );
    const actions = readFileSync(
      join(process.cwd(), "app/studio/(app)/clientes/actions.ts"),
      "utf8",
    );

    expect(drawer).toContain("navigator.geolocation.getCurrentPosition");
    expect(drawer).toContain("Capturar GPS aquí");
    expect(drawer).not.toContain("Buscar desde dirección");
    expect(drawer).not.toContain("geocodeClientAddressAction");
    expect(actions).not.toContain("geocodeClientAddressAction");
  });
});
