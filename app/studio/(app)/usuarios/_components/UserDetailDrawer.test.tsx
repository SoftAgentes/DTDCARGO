/**
 * SDD-0635 §3.3 · aviso de descarte en la ficha.
 *
 * Lo que defiende: con cambios de acceso elegidos y sin guardar, cerrar la
 * ficha o cambiar de pestaña pide confirmar; «Seguir editando» conserva la
 * bandeja; «Descartar cambios» hace lo que se pidió. Sin cambios, cerrar no
 * pregunta. (El «atrás» del navegador queda fuera: ver spec §3.3.)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserMembershipWithProfile } from "@/lib/studio/user-types";

vi.mock("../actions", () => ({
  updateMemberProfileAction: vi.fn(),
  sendAccessLinkAction: vi.fn(),
  disableUserAction: vi.fn(),
  enableUserAction: vi.fn(),
  changeMemberEmailAction: vi.fn(),
  grantUserModuleAction: vi.fn(),
  revokeUserModuleGrantAction: vi.fn(),
  changeUserRoleAction: vi.fn(),
  changeWarehouseScopeAction: vi.fn(),
  listUserAccessActivityAction: vi.fn(async () => ({ ok: true, events: [] })),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

const { UserDetailDrawer } = await import("./UserDetailDrawer");

const PERSONA = "00000000-0000-4000-8000-0000000000b2";

const MIEMBRO = {
  user_id: PERSONA,
  tenant_id: "tn-1",
  role: "accounting",
  warehouse_scope: "all",
  disabled_at: null,
  last_login_at: null,
  invited_by: null,
  created_at: "2026-07-03T00:00:00Z",
  email: "persona@ejemplo.test",
  profile: { user_id: PERSONA, first_name: "Persona", last_name: "de prueba" },
} as unknown as UserMembershipWithProfile;

const onClose = vi.fn();

beforeEach(() => vi.clearAllMocks());

async function elegirUnCambio(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole("button", { name: /^CRM:/ }));
  await u.click(screen.getByRole("radio", { name: /Solo ver/ }));
  expect(screen.getByText(/1 cambio para/)).toBeTruthy();
}

const cerrarFicha = () => screen.getAllByRole("button", { name: "Cerrar" }).at(-1)!;

describe("UserDetailDrawer · cambios sin guardar", () => {
  it("sin cambios, cerrar no pregunta", async () => {
    const u = userEvent.setup();
    render(<UserDetailDrawer member={MIEMBRO} onClose={onClose} pestana="acceso" />);
    await u.click(cerrarFicha());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/sin guardar/)).toBeNull();
  });

  it("con un cambio, cerrar pide confirmar; «Seguir editando» conserva la bandeja", async () => {
    const u = userEvent.setup();
    render(<UserDetailDrawer member={MIEMBRO} onClose={onClose} pestana="acceso" />);
    await elegirUnCambio(u);
    await u.click(cerrarFicha());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Descartar 1 cambio sin guardar")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.queryByText("Descartar 1 cambio sin guardar")).toBeNull();
    expect(screen.getByText(/1 cambio para/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("«Descartar cambios» cierra la ficha", async () => {
    const u = userEvent.setup();
    render(<UserDetailDrawer member={MIEMBRO} onClose={onClose} pestana="acceso" />);
    await elegirUnCambio(u);
    await u.click(cerrarFicha());
    await u.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cambiar de pestaña también pide confirmar y, al descartar, cambia", async () => {
    const u = userEvent.setup();
    render(<UserDetailDrawer member={MIEMBRO} onClose={onClose} pestana="acceso" />);
    await elegirUnCambio(u);
    await u.click(screen.getByRole("tab", { name: /Actividad/ }));
    expect(screen.getByText("Descartar 1 cambio sin guardar")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Acceso/ }).getAttribute("aria-selected")).toBe("true");
    await u.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.getByRole("tab", { name: /Actividad/ }).getAttribute("aria-selected")).toBe("true");
  });
});
