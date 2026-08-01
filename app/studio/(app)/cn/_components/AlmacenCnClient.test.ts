import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReceiptFiltersUrl } from "./AlmacenCnClient";

describe("AlmacenCnClient — filtros URL como fuente de verdad", () => {
  it("preserva parámetros ajenos y normaliza los filtros gobernados", () => {
    const params = new URLSearchParams(
      "lang=cn&view=create&q=anterior&hub=yiwu&status=received",
    );

    expect(
      buildReceiptFiltersUrl("/studio/cn", params, {
        q: "  DTD-0042  ",
        hub: "guangzhou",
        status: "",
      }),
    ).toBe("/studio/cn?lang=cn&view=create&q=DTD-0042&hub=guangzhou");
  });

  it("remonta el estado local por query y no lo copia desde efectos", () => {
    const source = readFileSync(resolve(__dirname, "AlmacenCnClient.tsx"), "utf8");

    expect(source).toContain("<AlmacenCnView key={params.toString()} {...props} />");
    expect(source).not.toMatch(/useEffect\(\(\) => \{\s*setSelected/);
    expect(source).not.toMatch(/useEffect\(\(\) => \{\s*setQ/);
    expect(source).not.toContain("eslint-disable-next-line react-hooks/exhaustive-deps");
  });
});
