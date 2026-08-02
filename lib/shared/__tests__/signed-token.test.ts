import { describe, expect, it } from "vitest";
import { openToken, sealToken, type SealOptions } from "../signed-token";

const SECRET = "un-secreto-de-servidor-suficientemente-largo";
const SEAL: SealOptions = { version: "t1", aad: "prueba-v1" };

describe("signed-token", () => {
  it("sella y abre el mismo payload", () => {
    const payload = { t: "tenant-1", exp: 1893456000 };
    const token = sealToken(payload, SECRET, SEAL);

    expect(openToken(token, SECRET, SEAL)).toEqual(payload);
  });

  it("el token es opaco: el payload no se lee sin el secreto", () => {
    const token = sealToken({ email: "sam@dtdcargo.com" }, SECRET, SEAL);

    // Ni el valor ni una porción reconocible aparecen en el token.
    expect(token).not.toContain("sam@dtdcargo.com");
    expect(Buffer.from(token, "utf8").toString("base64")).not.toContain("dtdcargo");
  });

  it("rechaza otro secreto", () => {
    const token = sealToken({ a: 1 }, SECRET, SEAL);

    expect(openToken(token, "otro-secreto-cualquiera", SEAL)).toBeNull();
  });

  it("rechaza otro propósito aunque el secreto sea el mismo", () => {
    // Esta es la propiedad que impide que una cookie de /marca valga como link
    // de baja de marketing: mismo secreto del servidor, AAD distinto.
    const token = sealToken({ a: 1 }, SECRET, SEAL);

    expect(openToken(token, SECRET, { version: "t1", aad: "otro-proposito" })).toBeNull();
  });

  it("rechaza otra versión", () => {
    const token = sealToken({ a: 1 }, SECRET, SEAL);

    expect(openToken(token, SECRET, { ...SEAL, version: "t2" })).toBeNull();
  });

  it("rechaza un token manipulado", () => {
    const token = sealToken({ admin: false }, SECRET, SEAL);
    const parts = token.split(".");
    // Se le cambia un carácter al ciphertext: el tag GCM tiene que delatarlo.
    const flipped = parts[2].startsWith("A") ? `B${parts[2].slice(1)}` : `A${parts[2].slice(1)}`;

    expect(openToken([parts[0], parts[1], flipped, parts[3]].join("."), SECRET, SEAL)).toBeNull();
  });

  it("nunca lanza ante basura", () => {
    for (const bad of [null, undefined, "", "no-es-un-token", "t1.a.b", "t1.@.@.@"]) {
      expect(() => openToken(bad, SECRET, SEAL)).not.toThrow();
      expect(openToken(bad, SECRET, SEAL)).toBeNull();
    }
  });

  it("dos sellados del mismo payload dan tokens distintos (IV aleatorio)", () => {
    const a = sealToken({ x: 1 }, SECRET, SEAL);
    const b = sealToken({ x: 1 }, SECRET, SEAL);

    expect(a).not.toBe(b);
    expect(openToken(a, SECRET, SEAL)).toEqual(openToken(b, SECRET, SEAL));
  });
});
