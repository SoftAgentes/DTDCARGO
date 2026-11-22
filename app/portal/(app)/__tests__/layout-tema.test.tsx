/**
 * SDD-0654 fase 1b · tema del portal por defecto (D-14, enmienda de BD-037 solo
 * para el Portal). AC-7: sin cookie de tema el portal abre en claro, y quien ya
 * eligió oscuro con el botón lo conserva.
 *
 * Se llama al layout como función (es un server component async) con todo lo
 * que lee de la base reemplazado por dobles: lo que se mira es el atributo
 * `data-portal-theme` del contenedor y el tema que recibe el armazón.
 */
import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieValue = vi.fn<() => string | undefined>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name !== "portal-theme") return undefined;
      const value = cookieValue();
      return value === undefined ? undefined : { name, value };
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect inesperado");
  }),
}));
vi.mock("@/lib/fonts", () => ({ jetbrainsMonoUi: { variable: "font-mono-test" } }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => ({
    userId: "aaaaaaaa-0654-0000-0000-000000000001",
    tenantId: "10000000-0654-0000-0000-000000000001",
    client: { id: "31000000-0654-0000-0000-000000000001", markbox: "DTD-9999", name: "Cliente Demo" },
  }),
  getProfileCompleteness: async () => ({ complete: true }),
}));
vi.mock("@/lib/portal/portal-conversation-queries", () => ({ getPortalLastReplyAt: async () => null }));
vi.mock("@/lib/portal/portal-club-queries", () => ({ isPortalClubMember: async () => false }));
vi.mock("@/lib/portal/next-sailing-queries", () => ({
  getNextOpenSailing: async () => null,
  daysUntil: () => null,
}));
vi.mock("@/lib/portal/portal-avisos-queries", () => ({ listMyPortalAvisos: async () => [] }));
vi.mock("../../_components/PortalShell", () => ({ PortalShell: () => null }));
vi.mock("../../_components/PortalCalcFab", () => ({ PortalCalcFab: () => null }));
vi.mock("../../_components/PortalPushRegister", () => ({ PortalPushRegister: () => null }));
vi.mock("../../_components/PortalMaintenanceNotice", () => ({ PortalMaintenanceNotice: () => null }));
vi.mock("@/lib/runtime/maintenance-notice", () => ({ avisoDeMantenimiento: () => null }));

const { default: PortalAppLayout } = await import("../layout");

type ShellProps = { themed: boolean; theme: "dark" | "light" };

async function renderLayout() {
  const root = (await PortalAppLayout({ children: null })) as ReactElement<Record<string, unknown>>;
  expect(isValidElement(root)).toBe(true);
  const hijos = ([] as unknown[]).concat(root.props.children as unknown[]);
  const shell = hijos.find(
    (h): h is ReactElement<ShellProps> =>
      isValidElement(h) && typeof (h.props as Partial<ShellProps>).theme === "string",
  );
  expect(shell).toBeDefined();
  return { atributo: root.props["data-portal-theme"], shell: shell!.props };
}

beforeEach(() => cookieValue.mockReset());

describe("SDD-0654 1b · tema del portal por defecto", () => {
  it("sin cookie de tema abre en claro (AC-7)", async () => {
    cookieValue.mockReturnValue(undefined);
    const { atributo, shell } = await renderLayout();
    expect(atributo).toBe("light");
    expect(shell.theme).toBe("light");
    expect(shell.themed).toBe(true);
  });

  it("quien ya eligió oscuro con el botón lo conserva (AC-7)", async () => {
    cookieValue.mockReturnValue("dark");
    const { atributo, shell } = await renderLayout();
    expect(atributo).toBe("dark");
    expect(shell.theme).toBe("dark");
  });

  it("quien eligió claro sigue en claro", async () => {
    cookieValue.mockReturnValue("light");
    const { atributo } = await renderLayout();
    expect(atributo).toBe("light");
  });

  it("una cookie con otro valor no fuerza el oscuro: abre en claro", async () => {
    for (const valor of ["", "DARK", "noche", "oscuro"]) {
      cookieValue.mockReturnValue(valor);
      const { atributo } = await renderLayout();
      expect(atributo).toBe("light");
    }
  });
});
