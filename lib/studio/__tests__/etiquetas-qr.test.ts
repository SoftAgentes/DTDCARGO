import { describe, it, expect } from "vitest";

import { labelVerifyUrl } from "@/lib/studio/etiquetas-qr";

describe("labelVerifyUrl", () => {
  it("apunta a /verificar con el markbox + caja/total", () => {
    const url = labelVerifyUrl("DTD-1001", 3, 12);
    expect(url).toContain("/verificar?c=DTD-1001&n=3/12");
    expect(url.startsWith("http")).toBe(true);
  });

  it("sanea el markbox (trim + encode)", () => {
    expect(labelVerifyUrl("  DTD 1001  ", 1, 1)).toContain(
      "/verificar?c=DTD%201001&n=1/1",
    );
  });

  it("es único por cartón (cambia con el índice de caja)", () => {
    const a = labelVerifyUrl("DTD-1001", 1, 5);
    const b = labelVerifyUrl("DTD-1001", 2, 5);
    expect(a).not.toBe(b);
  });
});
