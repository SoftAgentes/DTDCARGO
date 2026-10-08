// @vitest-environment node
/**
 * `directTusEndpoint` (SDD-0505): con Supabase self-hosted el host propio se
 * conserva tal cual; con Cloud se cambia al subdominio de Storage. Sin esta
 * prueba, un refactor que siempre reescriba el host rompería las subidas TUS en
 * el servidor propio sin que nada falle contra Cloud.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/admin", () => ({ createAdminClient: vi.fn() }));

import { directTusEndpoint } from "../service";

describe("directTusEndpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("host propio con https: conserva el host y arma la ruta resumable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.dtdcargo.com");
    expect(directTusEndpoint()).toBe("https://supabase.dtdcargo.com/storage/v1/upload/resumable");
  });

  it("gateway interno con http, puerto y barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://api-gw:8000/");
    expect(directTusEndpoint()).toBe("http://api-gw:8000/storage/v1/upload/resumable");
  });

  it("descarta ruta y query de la URL configurada", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.dtdcargo.com/rest/v1?apikey=x");
    expect(directTusEndpoint()).toBe("https://supabase.dtdcargo.com/storage/v1/upload/resumable");
  });

  it("Supabase Cloud: cambia al subdominio de Storage", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    expect(directTusEndpoint()).toBe(
      "https://abcdefghijklmnopqrst.storage.supabase.co/storage/v1/upload/resumable",
    );
  });

  it("un host que solo se parece a Cloud no se reescribe", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://evil.supabase.co.attacker.test");
    expect(directTusEndpoint()).toBe("https://evil.supabase.co.attacker.test/storage/v1/upload/resumable");
  });

  it("sin NEXT_PUBLIC_SUPABASE_URL lanza en vez de inventar un host", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => directTusEndpoint()).toThrow("NEXT_PUBLIC_SUPABASE_URL no configurada.");
  });
});
