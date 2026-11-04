// @vitest-environment node
/**
 * SDD-0602 · El callback del enlace mágico no manda al cliente a `0.0.0.0`.
 *
 * En el contenedor, `request.url` trae la dirección donde escucha el servidor. El
 * cliente que abría un enlace de un correo viejo terminaba en una página rota, con
 * la sesión ya creada y sin saberlo. Medido en producción el 2026-11-04.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const PUBLICO = "https://dtdcargo.test";
const PKCE = "/portal/callback?code=codigo";
const TOKEN = "/portal/callback?token_hash=hash&type=magiclink";

const destino = async (ruta: string, base = CONTENEDOR) => {
  const res = await GET(new Request(`${base}${ruta}`));
  expect(res.status).toBe(307);
  return res.headers.get("location");
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", PUBLICO);
  h.exchangeCodeForSession.mockResolvedValue({ error: null });
  h.verifyOtp.mockResolvedValue({ error: null });
  h.rpc.mockResolvedValue({ data: [{ client_id: "c-1", bound: true }] });
});
afterEach(() => vi.unstubAllEnvs());

describe("/portal/callback con request.url en 0.0.0.0:3000", () => {
  it("sesión vinculada → /portal del dominio público", async () => {
    expect(await destino(TOKEN)).toBe(`${PUBLICO}/portal`);
    expect(await destino(PKCE)).toBe(`${PUBLICO}/portal`);
  });

  it("sesión sin cliente → la puerta del dominio público", async () => {
    h.rpc.mockResolvedValue({ data: [{ client_id: null, bound: false }] });
    expect(await destino(TOKEN)).toBe(`${PUBLICO}/entrar?status=nohabilitado`);
  });

  it("enlace sin parámetros → aviso de incompleto en el dominio público", async () => {
    expect(await destino("/portal/callback")).toBe(`${PUBLICO}/entrar?error=incompleto`);
  });

  it("token vencido → aviso de enlace en el dominio público", async () => {
    h.verifyOtp.mockResolvedValue({ error: { message: "Token has expired" } });
    expect(await destino(TOKEN)).toBe(`${PUBLICO}/entrar?error=enlace`);
  });

  it("PKCE abierto en otro navegador → aviso de dispositivo en el dominio público", async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: { message: "PKCE code verifier not found" } });
    expect(await destino(PKCE)).toBe(`${PUBLICO}/entrar?error=dispositivo`);
  });

  it("PKCE con otro fallo → aviso de enlace en el dominio público", async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid flow state" } });
    expect(await destino(PKCE)).toBe(`${PUBLICO}/entrar?error=enlace`);
  });

  it("el dominio de prueba manda a prueba, no a producción", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://prueba.dtdcargo.test");
    expect(await destino(TOKEN)).toBe("https://prueba.dtdcargo.test/portal");
  });

  it("los parámetros del enlace se siguen leyendo de la petición", async () => {
    await destino("/portal/callback?token_hash=abc&type=recovery");
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "recovery" });
  });
});
