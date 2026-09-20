// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseClamavResponse, tokenMatches } from "../attachments-clamav-http.mjs";

describe("adaptador HTTP de ClamAV", () => {
  it("normaliza limpio e infectado sin exponer bytes", () => {
    expect(parseClamavResponse("stream: OK\0")).toEqual({ clean: true, signature: null });
    expect(parseClamavResponse("stream: Win.Test.EICAR_HDB-1 FOUND\0")).toEqual({
      clean: false,
      signature: "Win.Test.EICAR_HDB-1",
    });
  });

  it("rechaza estados ambiguos", () => {
    expect(() => parseClamavResponse("stream: ERROR\0")).toThrow("no reconocida");
  });

  it("compara el bearer sin aceptar vacío, prefijos o valores parciales", () => {
    expect(tokenMatches("Bearer secret-value", "secret-value")).toBe(true);
    expect(tokenMatches("secret-value", "secret-value")).toBe(false);
    expect(tokenMatches("Bearer secret", "secret-value")).toBe(false);
    expect(tokenMatches(undefined, "secret-value")).toBe(false);
  });
});
