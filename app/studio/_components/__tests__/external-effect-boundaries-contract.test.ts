import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const consumers = [
  "app/p/[token]/PackingListFormSection.tsx",
  "app/studio/(app)/crm/_components/ConvertLeadDrawer.tsx",
  "app/studio/(app)/tracking/[id]/_components/ChangeDestinationModal.tsx",
  "app/studio/(app)/usuarios/_components/UsersClient.tsx",
  "app/studio/_components/ui/useRowHighlight.ts",
  "app/studio/_components/wiring/GlobalSearchModal.tsx",
  "app/studio/_components/wiring/ProfileModal.tsx",
  "components/FaqExplorer.tsx",
];

describe("fronteras de efectos externos", () => {
  it.each(consumers)("difiere y cancela la sincronización en %s", (path) => {
    const code = source(path);
    expect(code).toContain("queueMicrotask");
    expect(code).toContain("cancelled = true");
  });

  it("cancela frame y timer del resaltado", () => {
    const code = source("app/studio/_components/ui/useRowHighlight.ts");
    expect(code).toContain("cancelAnimationFrame(frame)");
    expect(code).toContain("clearTimeout(timer)");
  });

  it("mantiene los tokens contra respuestas de búsqueda obsoletas", () => {
    expect(source(consumers[1])).toContain("reqId.current === id");
    expect(source(consumers[5])).toContain("myReq !== reqRef.current");
  });
});
