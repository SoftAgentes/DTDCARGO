import { describe, expect, it } from "vitest";

import { mismoCorreo, parseChatwootUserId, urlPanel, validarEnlaceSso } from "../chatwoot-types";
import { ssoVigentePara } from "../sso-cookie";

const ORIGEN = "https://chat.dtdcargo.com";
const BUENO = `${ORIGEN}/app/login?email=a%40example.test&sso_auth_token=t0k`;

describe("validarEnlaceSso (SDD-0585)", () => {
  it("acepta /app/login del origen del chat con correo y token", () => {
    expect(validarEnlaceSso(BUENO, ORIGEN)).toBe(BUENO);
  });

  it.each([
    ["otro origen", BUENO.replace("chat.dtdcargo.com", "chat.otro.test")],
    ["http en vez de https", BUENO.replace("https:", "http:")],
    ["otro puerto", BUENO.replace("chat.dtdcargo.com", "chat.dtdcargo.com:8443")],
    ["otra ruta", BUENO.replace("/app/login", "/app/accounts/1/dashboard")],
    ["sin token", `${ORIGEN}/app/login?email=a%40example.test`],
    ["sin correo", `${ORIGEN}/app/login?sso_auth_token=t0k`],
    ["no es URL", "javascript:alert(1)"],
  ])("rechaza: %s", (_caso, url) => {
    expect(validarEnlaceSso(url, ORIGEN)).toBeNull();
  });

  it("rechaza lo que no es texto", () => {
    expect(validarEnlaceSso(undefined, ORIGEN)).toBeNull();
    expect(validarEnlaceSso({ url: BUENO }, ORIGEN)).toBeNull();
  });
});

describe("parseChatwootUserId", () => {
  it("enteros positivos de int4, como número o texto", () => {
    expect(parseChatwootUserId(1)).toBe(1);
    expect(parseChatwootUserId(" 42 ")).toBe(42);
    expect(parseChatwootUserId("2147483647")).toBe(2147483647);
  });

  it.each([["0"], ["-1"], ["1.5"], ["01"], ["2147483648"], ["abc"], [""], [null], [undefined]])(
    "rechaza %s",
    (raw) => {
      expect(parseChatwootUserId(raw)).toBeNull();
    },
  );
});

describe("mismoCorreo", () => {
  it("ignora mayúsculas y espacios; vacío nunca coincide", () => {
    expect(mismoCorreo(" Agente@Example.test ", "agente@example.test")).toBe(true);
    expect(mismoCorreo("a@example.test", "b@example.test")).toBe(false);
    expect(mismoCorreo("", "")).toBe(false);
    expect(mismoCorreo(null, undefined)).toBe(false);
  });
});

describe("ssoVigentePara y urlPanel", () => {
  it("la marca solo vale para el mismo usuario", () => {
    expect(ssoVigentePara("u-1", "u-1")).toBe(true);
    expect(ssoVigentePara("u-2", "u-1")).toBe(false);
    expect(ssoVigentePara(undefined, "u-1")).toBe(false);
  });

  it("el panel de la cuenta no lleva token", () => {
    expect(urlPanel(ORIGEN, 1)).toBe("https://chat.dtdcargo.com/app/accounts/1/dashboard");
  });
});
