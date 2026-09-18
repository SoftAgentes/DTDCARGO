// @vitest-environment node
/**
 * SDD-0473 · El cron de importación: la bandera apaga la LECTURA, no el borrado.
 *
 * El cotizador le promete al visitante que su documento se borra a las 24 h. Si
 * se enciende y después se apaga la bandera (rollback), lo subido en esas horas
 * tiene que seguir borrándose: antes el handler cortaba antes de limpiar, y esos
 * archivos se habrían quedado en el bucket sin plazo.
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

describe("Cron de importación documental (SDD-0473)", () => {
  it("con la bandera apagada limpia lo vencido y no lee nada", async () => {
    for (const valor of ["", "false", "1"]) {
      vi.stubEnv("DOCUMENT_IMPORT_ENABLED", valor);
      const res = await tick();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ enabled: false, cleanup: { removed: 2 } });
    }
    expect(h.cleanup).toHaveBeenCalledTimes(3);
    expect(h.process).not.toHaveBeenCalled();
  });

  it("con la bandera encendida limpia y además procesa un job", async () => {
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
    vi.stubEnv("CRON_SECRET", "");
    expect((await tick("Bearer ")).status).toBe(403);
    expect(h.admin).not.toHaveBeenCalled();
    expect(h.cleanup).not.toHaveBeenCalled();
  });
});
