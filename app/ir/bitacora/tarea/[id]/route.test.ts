// @vitest-environment node
/**
 * SDD-0602 · El enlace de una notificación de Bitácora no manda a `0.0.0.0`. En el
 * contenedor, `req.url` trae la dirección donde escucha el servidor: el push y la
 * campanita abrían una página rota. Medido en producción el 2026-11-04.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const PUBLICO = "https://dtdcargo.test";
const ID = "44444444-4444-4444-8444-444444444444";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";

const destino = async (id: string, base = "https://0.0.0.0:3000", ua = "Mozilla/5.0 (Windows NT 10.0)") => {
  const req = new NextRequest(`${base}/ir/bitacora/tarea/${id}`, { headers: { "user-agent": ua } });
  const res = await GET(req, { params: Promise.resolve({ id }) });
  expect(res.status).toBe(307);
  return res.headers.get("location");
};

beforeEach(() => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", PUBLICO);
});
afterEach(() => vi.unstubAllEnvs());

describe("/ir/bitacora/tarea con req.url en 0.0.0.0:3000", () => {
  it("escritorio → el tablero del Studio en el dominio público", async () => {
    expect(await destino(ID)).toBe(`${PUBLICO}/studio/bitacora?task=${ID}`);
  });

  it("móvil → la vista táctil en el dominio público", async () => {
    expect(await destino(ID, undefined, IPHONE)).toBe(`${PUBLICO}/m/erp/bitacora/tarea/${ID}`);
  });

  it("id forjado → el listado en el dominio público, sin abrir un drawer inválido", async () => {
    expect(await destino("no-es-uuid")).toBe(`${PUBLICO}/studio/bitacora`);
    expect(await destino("no-es-uuid", undefined, IPHONE)).toBe(`${PUBLICO}/m/erp/bitacora`);
  });

  it("en local, con el dominio de producción en .env, no sale de localhost", async () => {
    vi.stubEnv("APP_ENV", "local");
    expect(await destino(ID, "http://localhost:3000")).toBe(`http://localhost:3000/studio/bitacora?task=${ID}`);
  });
});
