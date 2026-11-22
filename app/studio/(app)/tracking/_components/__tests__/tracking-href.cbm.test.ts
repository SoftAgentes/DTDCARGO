import { describe, expect, it } from "vitest";
import { metrosCubicos } from "../tracking-href";

describe("metrosCubicos (SDD-0667)", () => {
  it.each([
    [0.0012, "0,0012 m³"],
    [1.5, "1,5 m³"],
    [2, "2 m³"],
    [0.12, "0,12 m³"],
  ])("%s → %s", (n, esperado) => {
    expect(metrosCubicos(n)).toBe(esperado);
  });
});
