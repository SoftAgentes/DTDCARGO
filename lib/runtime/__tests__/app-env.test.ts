// @vitest-environment node
/**
 * Contratos de `lib/runtime/app-env.ts` (SDD-0505).
 *
 * Cada caso está escrito para que una implementación "cómoda" lo rompa: un
 * default a `local` cuando falta señal, un `??` que trate la cadena vacía como
 * definida, un cast `as AppEnv` sin validar el valor, un `VERCEL_ENV=development`
 * que caiga a local, o un `https://` antepuesto a cualquier cosa. El módulo es
 * el candado del bot de deploy y del enlace de baja del newsletter: lo que no
 * esté fijado acá se puede perder en un refactor sin que lint ni typecheck lo vean.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLocalRuntime,
  resolveAppEnv,
  resolveBuildSha,
  resolveDeploymentUrl,
} from "../app-env";

describe("resolveAppEnv · APP_ENV (fuente primaria)", () => {
  it.each([
    ["production", "production"],
    ["staging", "staging"],
    ["preview", "preview"],
    ["local", "local"],
  ])("APP_ENV=%s ⇒ %s aunque NODE_ENV sea production", (value, expected) => {
    expect(resolveAppEnv({ APP_ENV: value, NODE_ENV: "production" })).toBe(expected);
  });

  it("gana sobre VERCEL_ENV y NODE_ENV cuando no es local", () => {
    expect(
      resolveAppEnv({ APP_ENV: "staging", VERCEL_ENV: "production", NODE_ENV: "production" }),
    ).toBe("staging");
    expect(resolveAppEnv({ APP_ENV: "preview", VERCEL_ENV: "production" })).toBe("preview");
    expect(resolveAppEnv({ APP_ENV: "production", VERCEL_ENV: "preview" })).toBe("production");
  });

  it("normaliza mayúsculas y espacios", () => {
    expect(resolveAppEnv({ APP_ENV: " Staging " })).toBe("staging");
    expect(resolveAppEnv({ APP_ENV: "PRODUCTION" })).toBe("production");
  });

  it("un valor desconocido falla cerrado a production (mata un cast sin validar)", () => {
    expect(resolveAppEnv({ APP_ENV: "prod" })).toBe("production");
    expect(resolveAppEnv({ APP_ENV: "dev", NODE_ENV: "development" })).toBe("production");
    expect(isLocalRuntime({ APP_ENV: "localhost", NODE_ENV: "test" })).toBe(false);
  });

  it("vacío o en blanco cuenta como no definido (mata un `??`)", () => {
    expect(resolveAppEnv({ APP_ENV: "", NODE_ENV: "production" })).toBe("production");
    expect(resolveAppEnv({ APP_ENV: "   ", NODE_ENV: "production" })).toBe("production");
    expect(resolveAppEnv({ APP_ENV: "", VERCEL_ENV: "preview" })).toBe("preview");
    expect(resolveAppEnv({ APP_ENV: "", NODE_ENV: "test" })).toBe("local");
  });

  it("APP_ENV=local NO gana dentro de Vercel: decide VERCEL_ENV", () => {
    expect(resolveAppEnv({ APP_ENV: "local", VERCEL_ENV: "production" })).toBe("production");
    expect(resolveAppEnv({ APP_ENV: "local", VERCEL_ENV: "preview" })).toBe("preview");
    expect(
      isLocalRuntime({ APP_ENV: "local", VERCEL_ENV: "production", NODE_ENV: "production" }),
    ).toBe(false);
  });

  it("APP_ENV=local fuera de Vercel sí es local aunque NODE_ENV sea production", () => {
    expect(resolveAppEnv({ APP_ENV: "local", NODE_ENV: "production" })).toBe("local");
    expect(isLocalRuntime({ APP_ENV: "local", VERCEL_ENV: "", NODE_ENV: "production" })).toBe(true);
  });
});

describe("resolveAppEnv · fallback VERCEL_ENV", () => {
  it("production ⇒ production", () => {
    expect(resolveAppEnv({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe("production");
  });

  it("preview ⇒ preview, incluso con NODE_ENV=production", () => {
    expect(resolveAppEnv({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe("preview");
  });

  it("development ⇒ preview, nunca local (candado histórico 'si hay VERCEL_ENV no es local')", () => {
    expect(resolveAppEnv({ VERCEL_ENV: "development" })).toBe("preview");
    expect(isLocalRuntime({ VERCEL_ENV: "development", NODE_ENV: "development" })).toBe(false);
  });

  it("normaliza el valor y manda cualquier cosa que no sea production a preview", () => {
    expect(resolveAppEnv({ VERCEL_ENV: " Production " })).toBe("production");
    expect(resolveAppEnv({ VERCEL_ENV: "staging" })).toBe("preview");
  });

  it("vacío cuenta como ausente", () => {
    expect(resolveAppEnv({ VERCEL_ENV: "", NODE_ENV: "test" })).toBe("local");
    expect(resolveAppEnv({ VERCEL_ENV: "", NODE_ENV: "production" })).toBe("production");
  });
});

describe("resolveAppEnv · fallback NODE_ENV (fallo cerrado)", () => {
  it("production sin ninguna señal ⇒ production (mata un default a local)", () => {
    expect(resolveAppEnv({ NODE_ENV: "production" })).toBe("production");
    expect(isLocalRuntime({ NODE_ENV: "production" })).toBe(false);
  });

  it("PRODUCTION en mayúsculas tampoco cae a local", () => {
    expect(resolveAppEnv({ NODE_ENV: "PRODUCTION" })).toBe("production");
    expect(resolveAppEnv({ NODE_ENV: " production " })).toBe("production");
  });

  it("development, test o vacío ⇒ local", () => {
    expect(resolveAppEnv({ NODE_ENV: "development" })).toBe("local");
    expect(resolveAppEnv({ NODE_ENV: "test" })).toBe("local");
    expect(resolveAppEnv({ NODE_ENV: "" })).toBe("local");
    expect(resolveAppEnv({})).toBe("local");
    expect(isLocalRuntime({ NODE_ENV: "test" })).toBe(true);
  });
});

describe("resolveAppEnv · fuente por defecto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lee process.env cuando no recibe env (Vitest corre con NODE_ENV=test ⇒ local)", () => {
    vi.stubEnv("APP_ENV", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(resolveAppEnv()).toBe("local");
    expect(isLocalRuntime()).toBe(true);
  });

  it("y ve los cambios de process.env en cada llamada", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("APP_ENV", "staging");
    expect(resolveAppEnv()).toBe("staging");
    expect(isLocalRuntime()).toBe(false);
  });
});

describe("resolveBuildSha", () => {
  it("NEXT_PUBLIC_BUILD_SHA gana sobre el SHA automático de Vercel", () => {
    expect(
      resolveBuildSha({ NEXT_PUBLIC_BUILD_SHA: "abc1234", VERCEL_GIT_COMMIT_SHA: "def5678" }),
    ).toBe("abc1234");
  });

  it("cadena vacía (build arg sin valor) cae a VERCEL_GIT_COMMIT_SHA", () => {
    expect(resolveBuildSha({ NEXT_PUBLIC_BUILD_SHA: "", VERCEL_GIT_COMMIT_SHA: "abc" })).toBe("abc");
    expect(resolveBuildSha({ NEXT_PUBLIC_BUILD_SHA: "  ", VERCEL_GIT_COMMIT_SHA: "abc" })).toBe("abc");
  });

  it("recorta espacios y sin ninguna devuelve null", () => {
    expect(resolveBuildSha({ NEXT_PUBLIC_BUILD_SHA: " abc " })).toBe("abc");
    expect(resolveBuildSha({})).toBeNull();
    expect(resolveBuildSha({ NEXT_PUBLIC_BUILD_SHA: "", VERCEL_GIT_COMMIT_SHA: "" })).toBeNull();
  });
});

describe("resolveDeploymentUrl", () => {
  it("APP_URL gana sobre VERCEL_URL y pierde la barra final", () => {
    expect(
      resolveDeploymentUrl({ APP_URL: "https://staging.dtdcargo.com/", VERCEL_URL: "x.vercel.app" }),
    ).toBe("https://staging.dtdcargo.com");
    expect(resolveDeploymentUrl({ APP_URL: "https://staging.dtdcargo.com///" })).toBe(
      "https://staging.dtdcargo.com",
    );
  });

  it("APP_URL sin esquema recibe https (host y host:puerto)", () => {
    expect(resolveDeploymentUrl({ APP_URL: "staging.dtdcargo.com" })).toBe("https://staging.dtdcargo.com");
    expect(resolveDeploymentUrl({ APP_URL: "localhost:3000" })).toBe("https://localhost:3000");
  });

  it("APP_URL con http se respeta (prueba local contra el gateway)", () => {
    expect(resolveDeploymentUrl({ APP_URL: "http://web:3000/" })).toBe("http://web:3000");
  });

  it("VERCEL_URL llega sin esquema: recibe https y pierde la barra", () => {
    expect(resolveDeploymentUrl({ VERCEL_URL: "a.vercel.app/" })).toBe("https://a.vercel.app");
  });

  it("VERCEL_URL con esquema no se duplica", () => {
    expect(resolveDeploymentUrl({ VERCEL_URL: "https://a.vercel.app/" })).toBe("https://a.vercel.app");
    expect(resolveDeploymentUrl({ VERCEL_URL: "HTTP://a.vercel.app" })).toBe("https://a.vercel.app");
  });

  it("APP_URL vacío cae a VERCEL_URL; sin ninguna ⇒ null", () => {
    expect(resolveDeploymentUrl({ APP_URL: "", VERCEL_URL: "a.vercel.app" })).toBe("https://a.vercel.app");
    expect(resolveDeploymentUrl({ APP_URL: "  ", VERCEL_URL: "" })).toBeNull();
    expect(resolveDeploymentUrl({})).toBeNull();
  });

  it("esquemas que no son http(s) ⇒ null, nunca `https://ftp://…`", () => {
    expect(resolveDeploymentUrl({ APP_URL: "ftp://x.test" })).toBeNull();
    expect(resolveDeploymentUrl({ APP_URL: "ws://x.test" })).toBeNull();
    expect(resolveDeploymentUrl({ APP_URL: "javascript:alert(1)" })).toBeNull();
    expect(resolveDeploymentUrl({ APP_URL: "mailto:hola@x.test" })).toBeNull();
  });

  it("una URL inválida o con credenciales ⇒ null", () => {
    expect(resolveDeploymentUrl({ APP_URL: "https://" })).toBeNull();
    expect(resolveDeploymentUrl({ APP_URL: "no url" })).toBeNull();
    expect(resolveDeploymentUrl({ APP_URL: "https://user:pass@x.test" })).toBeNull();
    expect(resolveDeploymentUrl({ VERCEL_URL: "https://" })).toBeNull();
  });
});
