import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { actionStateChangedSuccessfully } from "./PortalBackfillSection";

describe("PortalBackfillSection", () => {
  it("distingue una respuesta exitosa nueva de la respuesta ya manejada", () => {
    const initial = {};
    const failed = { error: "falló" };
    const succeeded = { ok: true };

    expect(actionStateChangedSuccessfully(initial, failed)).toBe(false);
    expect(actionStateChangedSuccessfully(initial, succeeded)).toBe(true);
    expect(actionStateChangedSuccessfully(succeeded, succeeded)).toBe(false);
  });

  it("no sincroniza selección ni editores con efectos", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "app/studio/(app)/admin/_components/PortalBackfillSection.tsx",
      ),
      "utf8",
    );

    expect(source).not.toContain("useEffect");
    expect(source.match(/handledState !== state/g)).toHaveLength(2);
    expect(source.match(/actionStateChangedSuccessfully\(editBaseline, editState\)/g)).toHaveLength(2);
  });
});
