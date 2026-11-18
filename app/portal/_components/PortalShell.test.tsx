import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../actions", () => ({
  signOutAction: vi.fn(),
  markPortalAvisosSeenAction: vi.fn(async () => ({ ok: true })),
  setPortalVistaAction: vi.fn(async () => ({ ok: true })),
  markPortalGuiaVistaAction: vi.fn(async () => ({ ok: true })),
}));

const { hasUnreadSupportReply, PortalShell } = await import("./PortalShell");

afterEach(cleanup);

const base = {
  name: "Cliente Demo",
  markbox: "DTD-9999",
  themed: true,
  theme: "dark" as const,
  showClub: false,
  soporteLastReplyAt: null,
  profileComplete: true,
  sailing: null,
  sailingDaysToCutoff: null,
  avisos: [],
};

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

  // SDD-0654 · AC-1: con el interruptor apagado el layout no pasa vista y el
  // armazón es el de antes, sin selector.
  it("sin vista (interruptor apagado) no hay selector de vista", () => {
    render(<PortalShell {...base}>contenido</PortalShell>);
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Vista del portal" })).not.toBeInTheDocument();
    render(<PortalShell {...base} vista={null}>otro</PortalShell>);
    expect(screen.queryByRole("group", { name: "Vista del portal" })).not.toBeInTheDocument();
  });

  it("con vista, la barra muestra el selector con la vista marcada", () => {
    render(<PortalShell {...base} vista="pro">contenido</PortalShell>);
    const grupo = screen.getByRole("group", { name: "Vista del portal" });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vista Pro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("el layout solo lee la vista con el interruptor encendido y no toca el principal", () => {
    const layout = readFileSync(join(process.cwd(), "app/portal/(app)/layout.tsx"), "utf8");
    expect(layout).toMatch(
      /const vista = isPortalVistaSimpleEnabled\(\)\s*\?\s*\(await getMyPortalVista\(supabase, principal\.userId\)\)\.vista\s*:\s*null;/,
    );
    expect(layout).toContain("data-portal-vista={vista ?? undefined}");
    expect(layout).toContain("vista={vista}");
    const queries = readFileSync(join(process.cwd(), "lib/portal/portal-queries.ts"), "utf8");
    expect(queries).not.toContain("portal_vista");
    expect(queries).not.toContain("portal_guia_vista_at");
  });
});
