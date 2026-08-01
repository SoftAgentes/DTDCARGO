import { describe, expect, it } from "vitest";
import {
  bugReplayEnabled,
  maskReplayText,
} from "../bug-rrweb-capture";

describe("captura rrweb", () => {
  it("permanece apagada salvo habilitación pública explícita", () => {
    expect(bugReplayEnabled(undefined)).toBe(false);
    expect(bugReplayEnabled("0")).toBe(false);
    expect(bugReplayEnabled("true")).toBe(false);
    expect(bugReplayEnabled("1")).toBe(true);
  });

  it("enmascara cualquier texto visible capturado", () => {
    expect(maskReplayText("Cédula V-12.345.678")).toBe("***");
    expect(maskReplayText("Dirección del cliente")).toBe("***");
  });
});
