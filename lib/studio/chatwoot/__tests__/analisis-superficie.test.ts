// @vitest-environment node
/**
 * SDD-0588 · paso 3.4 · la superficie de DTD que viaja al motor. Prueba negativa
 * sobre un árbol con trampas (`.env`, `secretos/`, `pruebas/`, `__tests__`, un
 * initializer con una llave) y prueba sobre el repo real.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RUTA_INDICE, leerSuperficieDtd } from "../analisis-superficie";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const LLAVE = "0123456789abcdef0123456789abcdef.LlaveDePruebaGLM";

const tmp = mkdtempSync(join(tmpdir(), "dtd-superficie-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function escribir(ruta: string, contenido: string) {
  mkdirSync(dirname(join(tmp, ruta)), { recursive: true });
  writeFileSync(join(tmp, ruta), contenido);
}

escribir("infra/chatwoot/.env", `DTD_CHATWOOT_IA_GLM_KEY=${LLAVE}`);
escribir("infra/chatwoot/.env.example", "CHATWOOT_PLATFORM_TOKEN=");
escribir("infra/chatwoot/compose.yml", "services:\n  rails:\n    environment:\n      SECRET_KEY_BASE: ${CHATWOOT_SECRET_KEY_BASE:?falta}\n");
escribir("infra/chatwoot/secretos/platform-token.rb", `TOKEN = '${LLAVE}'`);
escribir("infra/chatwoot/pruebas/sonda.rb", "puts 'prueba'");
escribir("infra/chatwoot/rails/zz_dtd_ok.rb", "module DtdOk; end");
escribir("infra/chatwoot/rails/zz_dtd_fuga.rb", `LLAVE = "${LLAVE}"`);
escribir("infra/chatwoot/rails/.env.rb", "nada");
escribir("infra/chatwoot/panel/dashboard-scripts.html", "<script>/* ficha */</script>");
escribir("lib/studio/chatwoot/platform-api.ts", 'const ruta = `/platform/api/v1/users/${id}/login`;\nconst otra = 1;\n');
escribir("lib/studio/chatwoot/__tests__/x.test.ts", 'const r = "/api/v1/accounts/1/conversations";');
escribir("lib/studio/chatwoot/.env.ts", 'const r = "/api/v1/secreto";');

describe("leerSuperficieDtd · árbol con trampas", () => {
  const { archivos, excluidos } = leerSuperficieDtd(tmp);
  const rutas = archivos.map((a) => a.ruta);
  const todo = archivos.map((a) => a.contenido).join("\n");

  it("trae solo las fuentes permitidas", () => {
    expect(rutas).toEqual([
      "infra/chatwoot/rails/zz_dtd_ok.rb",
      "infra/chatwoot/compose.yml",
      "infra/chatwoot/panel/dashboard-scripts.html",
      RUTA_INDICE,
    ]);
  });

  it("PRUEBA NEGATIVA: ni .env, ni secretos/, ni pruebas/, ni __tests__, ni la llave", () => {
    expect(rutas.join("\n")).not.toMatch(/\.env|secretos|pruebas|__tests__|zz_dtd_fuga/);
    expect(todo).not.toContain(LLAVE);
    expect(todo).not.toContain("/api/v1/accounts/1/conversations");
    expect(todo).not.toContain("/api/v1/secreto");
    expect(excluidos).toEqual(
      expect.arrayContaining([
        { ruta: "infra/chatwoot/rails/zz_dtd_fuga.rb", motivo: "secreto" },
        { ruta: "infra/chatwoot/rails/.env.rb", motivo: "ruta" },
        { ruta: "lib/studio/chatwoot/.env.ts", motivo: "ruta" },
      ]),
    );
  });

  it("de lib/studio/chatwoot solo manda el índice de rutas, con archivo y línea", () => {
    expect(archivos.find((a) => a.ruta === RUTA_INDICE)?.contenido).toBe(
      "lib/studio/chatwoot/platform-api.ts:1  const ruta = `/platform/api/v1/users/${id}/login`;",
    );
  });

  it("sin las carpetas (bundle sin trazar) devuelve vacío y no lanza", () => {
    expect(leerSuperficieDtd(join(tmp, "no-existe"))).toEqual({ archivos: [], excluidos: [] });
  });
});

describe("leerSuperficieDtd · el repo real", () => {
  const { archivos, excluidos } = leerSuperficieDtd(ROOT);
  const rutas = archivos.map((a) => a.ruta);

  it("trae los initializers propios, el compose, la ficha y el índice", () => {
    expect(rutas).toEqual(
      expect.arrayContaining([
        "infra/chatwoot/rails/zz_dtd_redaccion_logs.rb",
        "infra/chatwoot/rails/zz_dtd_revocar_sesiones.rb",
        "infra/chatwoot/compose.yml",
        "infra/chatwoot/panel/dashboard-scripts.html",
        RUTA_INDICE,
      ]),
    );
  });

  it("ningún archivo real cae por secreto: si cae, hay una llave en el repo o el patrón se equivoca", () => {
    expect(excluidos).toEqual([]);
  });

  it("nada de .env ni secretos/ en el repo real", () => {
    expect(rutas.join("\n")).not.toMatch(/\.env|secretos|pruebas|__tests__/);
  });
});
