import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasUnreadSupportReply } from "./PortalShell";

describe("PortalShell", () => {
  it("muestra el punto sólo para respuestas nuevas fuera de soporte", () => {
    expect(hasUnreadSupportReply(null, null, false)).toBe(false);
    expect(hasUnreadSupportReply("2026-07-31T12:00:00Z", null, false)).toBe(true);
    expect(
      hasUnreadSupportReply(
        "2026-07-31T12:00:00Z",
        "2026-07-31T13:00:00Z",
        false,
      ),
    ).toBe(false);
    expect(hasUnreadSupportReply("2026-07-31T12:00:00Z", null, true)).toBe(false);
  });

  it("usa un store externo y deriva el cajón de la ruta", () => {
    const source = readFileSync(
      join(process.cwd(), "app/portal/_components/PortalShell.tsx"),
      "utf8",
    );
    expect(source).toContain("useSyncExternalStore");
    expect(source).toContain("mobileState.path === path");
    expect(source).not.toContain("setCollapsed");
    expect(source).not.toContain("setSeenAt");
  });
});
