import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { platformKeyLabel } from "../ui/usePlatformMod";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("estado derivado del navegador", () => {
  it("mantiene etiquetas de atajos por plataforma", () => {
    expect(platformKeyLabel("⌘", true)).toBe("⌘");
    expect(platformKeyLabel("⌘", false)).toBe("Ctrl");
    expect(platformKeyLabel("⇧", false)).toBe("Shift");
  });

  it.each([
    "app/m/cn/login/page.tsx",
    "app/m/erp/bitacora/_components/PushOptInBanner.tsx",
    "app/studio/(app)/_components/StudioTopbar.tsx",
    "app/studio/_components/ui/usePlatformMod.ts",
    "components/CookieConsentBanner.tsx",
    "components/LazyVideo.tsx",
  ])("usa snapshot externo o estado derivado en %s", (path) => {
    expect(source(path)).toContain("useSyncExternalStore");
  });

  it("asocia la apertura del menú del portal con su ruta", () => {
    const code = source("app/portal/_components/PortalAccountMenu.tsx");
    expect(code).toContain("menuState.path === pathname");
  });

  it.each(["app/m/cn/login/page.tsx", "app/m/ve/login/page.tsx"])(
    "maneja cada respuesta de PIN una sola vez en %s",
    (path) => {
      const code = source(path);
      expect(code).toContain("handledState !== state");
      expect(code).toContain("if (!shake) return");
    },
  );
});
