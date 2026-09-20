// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sha256Of } from "../backup";

describe("respaldo", () => {
  it("calcula checksum estable de los bytes", () => {
    expect(sha256Of(new TextEncoder().encode("DTD Cargo"))).toBe("65cf0168b60ca7a288242a241f4917e022abdc9b2c77dfbdda1700a8ffbfee80");
  });
});
