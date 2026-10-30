// @vitest-environment node
/**
 * SDD-0585 · paso 2.4, E2-D29. La Ficha DTD vive en un iframe de Chatwoot. Si
 * el proxy la redirige al login sin sesión, el marco queda en blanco: el login
 * no se deja enmarcar. Por eso SOLO `/studio/ficha-chat` exacta pasa sin
 * sesión (la página muestra «Inicia sesión en Studio» y la acción repite el
 * candado). Cualquier otra ruta de Studio sigue yendo al login.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ user: null as unknown }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: m.user } }) } }),
}));
vi.mock("@/lib/runtime/maintenance", () => ({ respuestaDeMantenimiento: async () => null }));

import { proxy } from "@/proxy";

const pedir = (ruta: string) => proxy(new NextRequest(`https://dtdcargo.com${ruta}`));
const destino = (res: Response) => {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
};

beforeEach(() => {
  m.user = null;
});

describe("proxy · Ficha DTD sin sesión (E2-D29)", () => {
  it("/studio/ficha-chat sin sesión: pasa, sin redirigir al login", async () => {
    const res = await pedir("/studio/ficha-chat");
    expect(destino(res)).toBeNull();
  });

  for (const ruta of ["/studio/ficha-chat/otra", "/studio/ficha-chats", "/studio/clientes", "/studio/bandeja"]) {
    it(`${ruta} sin sesión: sigue yendo al login`, async () => {
      expect(destino(await pedir(ruta))).toBe("/studio/login");
    });
  }

  it("con sesión, /studio/ficha-chat pasa igual", async () => {
    m.user = { id: "20000000-0000-4000-8000-000000000003" };
    expect(destino(await pedir("/studio/ficha-chat"))).toBeNull();
  });

  it("el login sigue igual: con sesión manda al resumen", async () => {
    m.user = { id: "20000000-0000-4000-8000-000000000003" };
    expect(destino(await pedir("/studio/login"))).toBe("/studio/resumen");
  });
});
