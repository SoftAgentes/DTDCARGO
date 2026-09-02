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

describe("frontera de privacidad del cotejo de identidad", () => {
  it("no conserva consultas CNE/SENIAT ni configuración de providers", () => {
    const forbidden = [
      "IDENTITY_CNE_",
      "cne.gob.ve/web/registro_electoral",
      "contribuyente.seniat.gob.ve/BuscaRif",
      "verifyIdentityAction",
    ];
    const offenders = [...runtimeSources("app"), ...runtimeSources("lib")]
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return forbidden.some((token) => source.includes(token));
      });

    expect(offenders).toEqual([]);
    expect(
      existsSync(join(process.cwd(), "lib/studio/identity/index.ts")),
    ).toBe(false);
    expect(
      existsSync(
        join(process.cwd(), "lib/studio/identity/providers/cne-cedulave.ts"),
      ),
    ).toBe(false);
  });

  it("conserva únicamente el veredicto manual contra la foto privada", () => {
    const card = readFileSync(
      join(
        process.cwd(),
        "app/studio/(app)/clientes/_components/IdentityVerificationCard.tsx",
      ),
      "utf8",
    );
    const actions = readFileSync(
      join(process.cwd(), "app/studio/(app)/clientes/actions.ts"),
      "utf8",
    );

    expect(card).toContain("markIdentityAction");
    expect(card).toContain('idleLabel="Corresponde"');
    expect(card).toContain('idleLabel="No corresponde"');
    expect(card).toContain("No se envía información a servicios externos");
    expect(card).not.toContain("href=");
    expect(actions).toContain("export async function markIdentityAction");
  });
});
