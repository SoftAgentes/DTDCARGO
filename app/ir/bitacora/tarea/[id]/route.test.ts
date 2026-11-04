// @vitest-environment node
/**
 * SDD-0602 · El enlace de una notificación de Bitácora no manda a `0.0.0.0`. En el
 * contenedor, `req.url` trae la dirección donde escucha el servidor: el push y la
 * campanita abrían una página rota. Medido en producción el 2026-11-04.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const ID = "44444444-4444-4444-8444-444444444444";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";

const destino = async (id: string, ua = "Mozilla/5.0 (Windows NT 10.0)") => {
  const req = new NextRequest(`https://0.0.0.0:3000/ir/bitacora/tarea/${id}`, { headers: { "user-agent": ua } });
  const res = await GET(req, { params: Promise.resolve({ id }) });
  expect(res.status).toBe(307);
  return res.headers.get("location");
};

describe("/ir/bitacora/tarea con req.url en 0.0.0.0:3000", () => {
  it("escritorio → el tablero del Studio, sin host en el Location", async () => {
    expect(await destino(ID)).toBe(`/studio/bitacora?task=${ID}`);
  });

  it("móvil → la vista táctil", async () => {
    expect(await destino(ID, IPHONE)).toBe(`/m/erp/bitacora/tarea/${ID}`);
  });

  it("id forjado → el listado, sin abrir un drawer inválido", async () => {
    expect(await destino("no-es-uuid")).toBe("/studio/bitacora");
    expect(await destino("no-es-uuid", IPHONE)).toBe("/m/erp/bitacora");
  });
});
