// @vitest-environment node
/**
 * Contratos de `lib/runtime/supabase-origin.ts` (SDD-0505): lo que `next.config.ts`
 * añade a la CSP y a `images.remotePatterns` cuando el Supabase no es Cloud.
 * Fija los detalles que importan a esos consumidores: origen sin barra, `wss`
 * para Realtime, `port` vacío cuando es el puerto por defecto (es lo que compara
 * `remotePatterns`), y `null` ante cualquier URL que no sirva, para que un `.env`
 * roto no tumbe el build ni abra un origen raro.
 */
import { describe, expect, it } from "vitest";
import { isSupabaseCloudHost, originFromEnv } from "../supabase-origin";

describe("originFromEnv", () => {
  it("host propio con https: origen sin barra final y wss para Realtime", () => {
    expect(originFromEnv("https://supabase.dtdcargo.com/")).toEqual({
      protocol: "https",
      hostname: "supabase.dtdcargo.com",
      port: "",
      origin: "https://supabase.dtdcargo.com",
      wsOrigin: "wss://supabase.dtdcargo.com",
      isSupabaseCloud: false,
    });
  });

  it("gateway interno con http y puerto: ws y port explícitos", () => {
    expect(originFromEnv("http://api-gw:8000")).toEqual({
      protocol: "http",
      hostname: "api-gw",
      port: "8000",
      origin: "http://api-gw:8000",
      wsOrigin: "ws://api-gw:8000",
      isSupabaseCloud: false,
    });
  });

  it("puerto por defecto escrito explícito queda vacío (URL lo normaliza; remotePatterns compara '')", () => {
    const origin = originFromEnv("https://h.test:443");
    expect(origin?.port).toBe("");
    expect(origin?.origin).toBe("https://h.test");
    expect(origin?.wsOrigin).toBe("wss://h.test");
    expect(originFromEnv("http://h.test:80")?.wsOrigin).toBe("ws://h.test");
  });

  it("ignora ruta, query y espacios de la URL configurada", () => {
    const origin = originFromEnv("  https://supabase.dtdcargo.com/rest/v1?x=1  ");
    expect(origin?.origin).toBe("https://supabase.dtdcargo.com");
    expect(origin?.hostname).toBe("supabase.dtdcargo.com");
  });

  it("Supabase Cloud se marca para que el caller no repita el comodín", () => {
    const cloud = originFromEnv("https://abcdefghijklmnopqrst.supabase.co");
    expect(cloud?.isSupabaseCloud).toBe(true);
    expect(cloud?.origin).toBe("https://abcdefghijklmnopqrst.supabase.co");
    expect(originFromEnv("HTTPS://ABCDEFGHIJKLMNOPQRST.SUPABASE.CO")?.isSupabaseCloud).toBe(true);
  });

  it("un host que solo se parece a Cloud no es Cloud", () => {
    expect(originFromEnv("https://evil.supabase.co.attacker.test")?.isSupabaseCloud).toBe(false);
    expect(originFromEnv("https://supabase.co")?.isSupabaseCloud).toBe(false);
    expect(originFromEnv("https://x.supabase.com")?.isSupabaseCloud).toBe(false);
  });

  it.each([
    undefined,
    "",
    "   ",
    "no url",
    "https://",
    "javascript:alert(1)",
    "ftp://x.test",
    "ws://x.test",
    "supabase.dtdcargo.com",
  ])("%j ⇒ null (vacía, inválida, sin esquema o con esquema que no es http/https)", (raw) => {
    expect(originFromEnv(raw)).toBeNull();
  });
});

describe("isSupabaseCloudHost", () => {
  it("solo termina en .supabase.co, sin importar mayúsculas", () => {
    expect(isSupabaseCloudHost("x.supabase.co")).toBe(true);
    expect(isSupabaseCloudHost("X.SUPABASE.CO")).toBe(true);
    expect(isSupabaseCloudHost("x.storage.supabase.co")).toBe(true);
    expect(isSupabaseCloudHost("supabase.co")).toBe(false);
    expect(isSupabaseCloudHost("x.supabase.com")).toBe(false);
    expect(isSupabaseCloudHost("x.supabase.co.attacker.test")).toBe(false);
  });
});
