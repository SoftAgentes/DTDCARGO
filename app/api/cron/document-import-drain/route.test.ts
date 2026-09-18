// @vitest-environment node
/**
 * SDD-0473 · El cron de drenaje es inerte con la bandera apagada.
 *
 * Corre cada minuto. Con `DOCUMENT_IMPORT_ENABLED` apagada corta ANTES de crear
 * el cliente de la base: ni conexión ni consulta. Es la garantía con la que se
 * integró la PR #130, verificada contra producción, y la que vuelve a regir. El
 * borrado de lo vencido no depende de este cron: vive en `document-import-cleanup`,
 * cada hora y con cualquier bandera.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  admin: vi.fn(() => ({ db: "admin" })),
  cleanup: vi.fn(async () => ({ removed: 2 })),
  process: vi.fn(async () => ({ processed: false })),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: h.admin }));
vi.mock("@/lib/studio/document-import/jobs", () => ({ cleanupImports: h.cleanup, processImportJob: h.process }));

import { GET } from "./route";

const SECRETO = "secreto-sintetico-del-cron";
const tick = (authorization = `Bearer ${SECRETO}`) =>
  GET(new NextRequest("https://dtdcargo.test/api/cron/document-import-drain", { headers: { authorization } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", SECRETO);
});
afterEach(() => vi.unstubAllEnvs());

describe("Cron de drenaje de la importación documental (SDD-0473)", () => {
  it("con la bandera apagada no abre la base: ni cliente, ni limpieza, ni lectura", async () => {
    for (const valor of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("DOCUMENT_IMPORT_ENABLED", valor);
      const res = await tick();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ enabled: false });
    }
    expect(h.admin).not.toHaveBeenCalled();
    expect(h.cleanup).not.toHaveBeenCalled();
    expect(h.process).not.toHaveBeenCalled();
  });

  it("con la bandera encendida limpia y procesa un job en cada tick", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    const res = await tick();
    expect(await res.json()).toEqual({ cleanup: { removed: 2 }, processed: false });
    expect(h.cleanup).toHaveBeenCalledTimes(1);
    expect(h.process).toHaveBeenCalledTimes(1);
  });

  it("sin el secreto correcto no toca la base, con ninguna bandera", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    for (const auth of ["", "Bearer otro-secreto-de-igual-largo!!", `Bearer ${SECRETO}x`]) {
      expect((await tick(auth)).status).toBe(403);
    }
    expect(h.admin).not.toHaveBeenCalled();
  });
});
