// @vitest-environment node
/**
 * SDD-0602 · El callback del enlace mágico no manda al cliente a `0.0.0.0`.
 *
 * En el contenedor, `request.url` trae la dirección donde escucha el servidor. El
 * cliente que abría el enlace terminaba en una página rota, con la sesión ya creada
 * y sin saberlo. Medido en producción el 2026-11-04. Que las cookies de la sesión
 * salgan en esta respuesta se midió contra la imagen real: ver la spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: h.exchangeCodeForSession, verifyOtp: h.verifyOtp },
    rpc: h.rpc,
  }),
}));

import { GET } from "./route";

const CONTENEDOR = "https://0.0.0.0:3000";
const PKCE = "/portal/callback?code=codigo";
const TOKEN = "/portal/callback?token_hash=hash&type=magiclink";

const destino = async (ruta: string) => {
  const res = await GET(new Request(`${CONTENEDOR}${ruta}`));
  expect(res.status).toBe(307);
  return res.headers.get("location");
};

beforeEach(() => {
  vi.clearAllMocks();
  h.exchangeCodeForSession.mockResolvedValue({ error: null });
  h.verifyOtp.mockResolvedValue({ error: null });
  h.rpc.mockResolvedValue({ data: [{ client_id: "c-1", bound: true }] });
});

describe("/portal/callback con request.url en 0.0.0.0:3000", () => {
  it("sesión vinculada → /portal, sin host en el Location", async () => {
    expect(await destino(TOKEN)).toBe("/portal");
    expect(await destino(PKCE)).toBe("/portal");
  });

  it("sesión sin cliente → la puerta", async () => {
    h.rpc.mockResolvedValue({ data: [{ client_id: null, bound: false }] });
    expect(await destino(TOKEN)).toBe("/entrar?status=nohabilitado");
  });

  it("enlace sin parámetros → aviso de incompleto", async () => {
    expect(await destino("/portal/callback")).toBe("/entrar?error=incompleto");
  });

  it("token vencido → aviso de enlace", async () => {
    h.verifyOtp.mockResolvedValue({ error: { message: "Token has expired" } });
    expect(await destino(TOKEN)).toBe("/entrar?error=enlace");
  });

  it("PKCE abierto en otro navegador → aviso de dispositivo", async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: { message: "PKCE code verifier not found" } });
    expect(await destino(PKCE)).toBe("/entrar?error=dispositivo");
  });

  it("PKCE con otro fallo → aviso de enlace", async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid flow state" } });
    expect(await destino(PKCE)).toBe("/entrar?error=enlace");
  });

  it("los parámetros del enlace se siguen leyendo de la petición", async () => {
    await destino("/portal/callback?token_hash=abc&type=recovery");
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "recovery" });
  });
});
