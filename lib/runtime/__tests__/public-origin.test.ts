// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicOrigin } from "../public-origin";

/** Lo que trae `request.url` en el contenedor, medido en producción (SDD-0602). */
const CONTENEDOR = "https://0.0.0.0:3000/portal/callback?code=x";
const PRODUCCION = "https://dtdcargo.test";
const PRUEBA = "https://prueba.dtdcargo.test";

afterEach(() => vi.unstubAllEnvs());

describe("publicOrigin · entornos publicados", () => {
  it.each([
    ["producción", "production", PRODUCCION],
    ["prueba", "staging", PRUEBA],
    ["una errata en APP_ENV, que cuenta como producción", "prod", PRODUCCION],
  ])("%s usa el dominio configurado, no la dirección donde escucha", (_nombre, appEnv, sitio) => {
    expect(publicOrigin(CONTENEDOR, { APP_ENV: appEnv, NEXT_PUBLIC_SITE_URL: sitio })).toBe(sitio);
  });

  it("sin APP_ENV, NODE_ENV=production también usa el dominio configurado", () => {
    expect(publicOrigin(CONTENEDOR, { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: PRODUCCION })).toBe(PRODUCCION);
  });

  it("toma solo el origen: ni barra final ni ruta se cuelan en el destino", () => {
    for (const sitio of [`${PRODUCCION}/`, `${PRODUCCION}/algo?x=1`]) {
      expect(publicOrigin(CONTENEDOR, { APP_ENV: "production", NEXT_PUBLIC_SITE_URL: sitio })).toBe(PRODUCCION);
    }
  });

  it.each([
    ["sin definir", undefined],
    ["vacía, como la deja un build arg sin valor", ""],
    ["sin esquema", "dtdcargo.test"],
    ["con otro esquema", "ftp://dtdcargo.test"],
  ])("variable %s: cae a la petición en vez de romper", (_nombre, sitio) => {
    const local = "https://host-real.test/portal/callback";
    expect(publicOrigin(local, { APP_ENV: "production", NEXT_PUBLIC_SITE_URL: sitio })).toBe("https://host-real.test");
  });
});

describe("publicOrigin · lo que no debe saltar de entorno", () => {
  it("en un preview con APP_URL, vuelve a ese preview y no a producción", () => {
    const env = { APP_ENV: "preview", APP_URL: "https://preview.dtdcargo.test/", NEXT_PUBLIC_SITE_URL: PRODUCCION };
    expect(publicOrigin(CONTENEDOR, env)).toBe("https://preview.dtdcargo.test");
  });

  it("en un preview de Vercel, sin APP_URL, se queda en el host de la petición", () => {
    const env = { VERCEL_ENV: "preview", VERCEL_URL: "unico-abc.vercel.app", NEXT_PUBLIC_SITE_URL: PRODUCCION };
    expect(publicOrigin("https://rama-x.vercel.app/ir/x", env)).toBe("https://rama-x.vercel.app");
  });

  it("en local, aunque .env traiga el dominio de producción, sigue en localhost", () => {
    const env = { NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: PRODUCCION };
    expect(publicOrigin("http://localhost:3000/ir/x", env)).toBe("http://localhost:3000");
  });

  it("APP_URL no manda en producción", () => {
    const env = { APP_ENV: "production", APP_URL: "https://otro.test", NEXT_PUBLIC_SITE_URL: PRODUCCION };
    expect(publicOrigin(CONTENEDOR, env)).toBe(PRODUCCION);
  });
});

describe("publicOrigin · lee el entorno del proceso", () => {
  it("sin env explícito, usa APP_ENV y NEXT_PUBLIC_SITE_URL de process.env", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", PRODUCCION);
    expect(publicOrigin(CONTENEDOR)).toBe(PRODUCCION);
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", PRUEBA);
    expect(publicOrigin(CONTENEDOR)).toBe(PRUEBA);
  });
});
