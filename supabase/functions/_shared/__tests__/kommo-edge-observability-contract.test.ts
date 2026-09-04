import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "supabase/functions/kommo-sync/index.ts",
  "supabase/functions/kommo-sync/sync.ts",
  "supabase/functions/kommo-webhook/index.ts",
  "supabase/functions/kommo-writeback/index.ts",
  "supabase/functions/kommo-push-client/index.ts",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de Edge Functions Kommo", () => {
  it.each(files)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(files.filter((path) => path.endsWith("index.ts")))(
    "crea contexto correlacionado en %s",
    (path) => {
      const text = source(path);
      expect(text).toContain("createEdgeRequestLogger");
      expect(text).toContain("logger.withResponse");
    },
  );
});
