// @vitest-environment node
/**
 * SDD-0473 · El cron de retención borra lo vencido con cualquier bandera.
 *
 * El cotizador le promete al visitante que su documento se borra a las 24 h. Si
 * se enciende y después se apaga la bandera, o si el Preview (que escribe en la
 * base de producción y no corre crons) deja residuo, eso se borra igual. Por eso
 * este cron no lee `DOCUMENT_IMPORT_ENABLED`: la lectura se apaga, el borrado no.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  admin: vi.fn(() => ({ db: "admin" })),
  cleanup: vi.fn(async () => ({ removed: 2 })),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: h.admin }));
vi.mock("@/lib/studio/document-import/jobs", () => ({ cleanupImports: h.cleanup }));

import { GET } from "./route";

const SECRETO = "secreto-sintetico-del-cron";
const tick = (authorization = `Bearer ${SECRETO}`) =>
  GET(new NextRequest("https://dtdcargo.test/api/cron/document-import-cleanup", { headers: { authorization } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", SECRETO);
});
afterEach(() => vi.unstubAllEnvs());

describe("Cron de retención de la importación documental (SDD-0473)", () => {
  it("limpia lo vencido con la bandera apagada, encendida o ausente", async () => {
    for (const valor of ["", "false", "1", "true"]) {
      vi.stubEnv("DOCUMENT_IMPORT_ENABLED", valor);
      const res = await tick();
      expect(res.status, `DOCUMENT_IMPORT_ENABLED=${JSON.stringify(valor)}`).toBe(200);
      expect(await res.json()).toEqual({ cleanup: { removed: 2 } });
    }
    expect(h.cleanup).toHaveBeenCalledTimes(4);
  });

  it("sin el secreto correcto no toca la base", async () => {
    for (const auth of ["", "Bearer otro-secreto-de-igual-largo!!", `Bearer ${SECRETO}x`]) {
      expect((await tick(auth)).status).toBe(403);
    }
    vi.stubEnv("CRON_SECRET", "");
    expect((await tick("Bearer ")).status).toBe(403);
    expect(h.admin).not.toHaveBeenCalled();
    expect(h.cleanup).not.toHaveBeenCalled();
  });
});
