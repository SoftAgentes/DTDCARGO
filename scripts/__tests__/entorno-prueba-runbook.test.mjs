// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SDD-0540 · Fase 1 · los comandos de docs/runbooks/entorno-prueba.md coinciden
 * con los scripts: cada script nombrado existe y cada opción `--x` que el runbook
 * le pasa está en su `case` de argumentos. Si un script cambia una opción y el
 * runbook no, esto queda rojo.
 */
const RUNBOOK = readFileSync(resolve("docs/runbooks/entorno-prueba.md"), "utf8");
const bloques = [...RUNBOOK.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
const lineas = bloques.flatMap((b) => b.split("\n")).map((l) => l.trim()).filter(Boolean);

/** Llamadas a scripts de infra/ops en el runbook: { ruta en el repo, opciones }. */
function llamadas(lista) {
  const out = [];
  for (const l of lista) {
    for (const m of l.matchAll(/(?:\/srv\/ops|infra\/ops)\/(staging|migrate|web)\/([a-z-]+\.sh)([^|&]*)/g)) {
      out.push({ linea: l, ruta: `infra/ops/${m[1]}/${m[2]}`, opciones: [...m[3].matchAll(/(?:^|\s)(--[a-z0-9-]+)/g)].map((x) => x[1]) });
    }
  }
  return out;
}

function opcionesDe(ruta) {
  const texto = readFileSync(resolve(ruta), "utf8");
  return new Set([...texto.matchAll(/^\s*(--[a-z0-9-]+)\)/gm)].map((m) => m[1]));
}

describe("SDD-0540 · runbook del entorno de prueba", () => {
  const todas = llamadas(lineas);

  it("nombra los scripts de la Fase 1", () => {
    const rutas = new Set(todas.map((c) => c.ruta));
    for (const r of [
      "infra/ops/staging/crear-prueba.sh",
      "infra/ops/staging/desplegar-prueba.sh",
      "infra/ops/staging/resetear-base-prueba.sh",
      "infra/ops/staging/verificar-aislamiento.sh",
      "infra/ops/staging/clave-web-prueba.sh",
      "infra/ops/staging/destroy-staging.sh",
      "infra/ops/migrate/aplicar-migracion.sh",
      "infra/ops/web/smoke-web.sh",
    ]) {
      expect(rutas, r).toContain(r);
    }
  });

  it("cada opción que pasa el runbook existe en su script", () => {
    expect(todas.length).toBeGreaterThanOrEqual(12);
    for (const c of todas) {
      expect(existsSync(resolve(c.ruta)), c.ruta).toBe(true);
      const validas = opcionesDe(c.ruta);
      for (const o of c.opciones) expect(validas.has(o), `${o} no existe en ${c.ruta} («${c.linea}»)`).toBe(true);
    }
  });

  it("el workflow y su input son los del repo", () => {
    const wf = readFileSync(resolve(".github/workflows/build-image-prueba.yml"), "utf8");
    const runs = lineas.filter((l) => l.startsWith("gh workflow run"));
    expect(runs.length).toBeGreaterThanOrEqual(2);
    for (const l of runs) {
      expect(l).toMatch(/^gh workflow run build-image-prueba\.yml --ref \S+ -f sha=(\S+|<[^>]+>)$/);
    }
    expect(wf).toMatch(/inputs:\n\s+sha:/);
  });

  it("el compose del runbook es el de los scripts (tres archivos y el proyecto)", () => {
    const compose = lineas.filter((l) => l.includes("docker compose"));
    expect(compose.length).toBeGreaterThanOrEqual(1);
    const lib = readFileSync(resolve("infra/ops/staging/lib-prueba.sh"), "utf8");
    expect(lib).toMatch(/docker compose -p "\$\{PROJECT\}" -f compose\.yml -f compose\.supabase\.yml -f compose\.staging\.yml/);
    for (const l of compose) expect(l).toMatch(/docker compose -p dtd-cargo-staging -f compose\.yml -f compose\.supabase\.yml -f compose\.staging\.yml/);
  });

  it("las pruebas que lista existen", () => {
    for (const m of RUNBOOK.matchAll(/`bash (infra\/ops\/tests\/[a-z-]+\.sh)`/g)) {
      expect(existsSync(resolve(m[1])), m[1]).toBe(true);
    }
  });
});
