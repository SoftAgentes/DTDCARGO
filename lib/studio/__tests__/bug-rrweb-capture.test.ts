import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("captura rrweb", () => {
  it("permanece apagada salvo habilitación pública explícita", () => {
    const source = readFileSync(
      join(process.cwd(), "app/studio/_components/bug-reporter/BugTechCaptureProvider.tsx"),
      "utf8",
    );
    expect(source).toContain('NEXT_PUBLIC_BUG_REPLAY_ENABLED === "1"');
  });

  it("enmascara inputs y todo texto capturado", () => {
    const source = readFileSync(join(process.cwd(), "lib/studio/bug-rrweb-capture.ts"), "utf8");
    expect(source).toContain("maskAllInputs: true");
    expect(source).toContain("maskTextFn");
  });
});
