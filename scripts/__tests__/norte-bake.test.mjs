// @vitest-environment node
/**
 * Smoke test del "horneado" del Norte para la web (SDD-0050 Slice B).
 *
 * El `postbuild` corre `node scripts/norte.mjs`, que ahora — además de escribir
 * el `_norte.html` del norte vigente — copia el snapshot a `public/norte.html`
 * (con `fs.writeFileSync`, NO `cp`, para ser portable Windows↔Linux). La pestaña
 * Norte de `/studio/debug` embebe ese archivo en un <iframe src="/norte.html">.
 *
 * Este test ejecuta el script de verdad y verifica que:
 *  - `public/norte.html` existe tras correrlo,
 *  - es un documento HTML del Norte (marcador en el contenido),
 *  - coincide byte a byte con `docs/design/studio/_norte/_norte.html` (misma fuente).
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "norte.mjs");
const PUBLIC_OUT = path.join(ROOT, "public", "norte.html");
const NORTE_OUT = path.join(ROOT, "docs", "design", "studio", "_norte", "_norte.html");

describe("scripts/norte.mjs · horneado del snapshot web", () => {
  it("genera public/norte.html idéntico al _norte.html del norte vigente", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).toBe(0);

    expect(fs.existsSync(PUBLIC_OUT)).toBe(true);
    const html = fs.readFileSync(PUBLIC_OUT, "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Norte · DTD Studio");

    // Misma fuente: el snapshot web es copia del _norte.html (escrito en la misma corrida).
    expect(fs.existsSync(NORTE_OUT)).toBe(true);
    expect(html).toBe(fs.readFileSync(NORTE_OUT, "utf8"));
  });
});
