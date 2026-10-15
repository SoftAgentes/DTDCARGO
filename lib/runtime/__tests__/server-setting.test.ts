// @vitest-environment node
/**
 * Contratos de `firstConfiguredSetting` (SDD-0525).
 *
 * Cada caso está escrito para que una implementación "cómoda" lo rompa: un `??`
 * que trate `""` como definida, un `!== ""` sin `trim` que deje pasar espacios,
 * un valor devuelto sin recortar, o un orden de candidatos invertido.
 */
import { describe, expect, it } from "vitest";
import { firstConfiguredSetting } from "../server-setting";

describe("firstConfiguredSetting", () => {
  it("sin candidatos configurados devuelve null", () => {
    expect(firstConfiguredSetting()).toBeNull();
    expect(firstConfiguredSetting(undefined, null)).toBeNull();
  });

  it.each([
    ["vacía", ""],
    ["espacios", "   "],
    ["tabulador y salto de línea", "\t\n"],
  ])("%s cuenta como ausente", (_caso, value) => {
    expect(firstConfiguredSetting(value)).toBeNull();
  });

  it("devuelve el valor recortado", () => {
    expect(firstConfiguredSetting("  claude-opus-4-1\n")).toBe("claude-opus-4-1");
  });

  it("devuelve un valor sin espacios tal cual", () => {
    expect(firstConfiguredSetting("claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
  });

  it("salta los ausentes y toma el primero configurado", () => {
    expect(firstConfiguredSetting("", "  ", undefined, "segundo", "tercero")).toBe(
      "segundo",
    );
  });

  it("con dos configurados gana el primero", () => {
    expect(firstConfiguredSetting("primero", "segundo")).toBe("primero");
  });
});
