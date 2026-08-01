import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "../json-ld";

describe("serializeJsonLd", () => {
  it("neutraliza cierres de script controlados por contenido", () => {
    const serialized = serializeJsonLd({ title: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003c/script>");
  });
});
