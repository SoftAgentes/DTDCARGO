import { describe, expect, it } from "vitest";
import { CHATWOOT_ORIGIN_DEFAULT, chatwootOriginFromEnv } from "../chatwoot-origin";

describe("chatwootOriginFromEnv (SDD-0585)", () => {
  it("sin variable o vacía → el de producción", () => {
    expect(chatwootOriginFromEnv(undefined)).toBe(CHATWOOT_ORIGIN_DEFAULT);
    expect(chatwootOriginFromEnv("   ")).toBe(CHATWOOT_ORIGIN_DEFAULT);
  });

  it("https: devuelve solo el origen, sin ruta ni barra final", () => {
    expect(chatwootOriginFromEnv("https://chat.dtdcargo.com/")).toBe("https://chat.dtdcargo.com");
    expect(chatwootOriginFromEnv("https://chat.ejemplo.test:8443/app/login?x=1")).toBe(
      "https://chat.ejemplo.test:8443",
    );
  });

  it("http solo en localhost", () => {
    expect(chatwootOriginFromEnv("http://localhost:3001")).toBe("http://localhost:3001");
    expect(chatwootOriginFromEnv("http://127.0.0.1:3001")).toBe("http://127.0.0.1:3001");
    expect(chatwootOriginFromEnv("http://chat.dtdcargo.com")).toBe(CHATWOOT_ORIGIN_DEFAULT);
  });

  it("inválida, otro esquema o con credenciales → el de producción, nunca un origen abierto", () => {
    expect(chatwootOriginFromEnv("no es una url")).toBe(CHATWOOT_ORIGIN_DEFAULT);
    expect(chatwootOriginFromEnv("javascript:alert(1)")).toBe(CHATWOOT_ORIGIN_DEFAULT);
    expect(chatwootOriginFromEnv("https://u:p@chat.ejemplo.test")).toBe(CHATWOOT_ORIGIN_DEFAULT);
    expect(chatwootOriginFromEnv("*")).toBe(CHATWOOT_ORIGIN_DEFAULT);
  });
});
