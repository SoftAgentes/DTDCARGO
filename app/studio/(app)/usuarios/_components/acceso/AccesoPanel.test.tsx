/**
 * SDD-0622 · pestaña «Acceso» de la ficha y doble aviso.
 *
 * Lo que defiende:
 *   1. Un módulo que la base todavía no acepta (dinero, solo-admin) se ve con
 *      su motivo y NO se puede elegir (§5.3).
 *   2. Agregar un módulo cubierto pide motivo y manda a la acción lo elegido.
 *   3. El doble aviso lista los efectos concretos y no confirma sin motivo ni
 *      casilla; con las dos cosas manda `confirmSensitive: true`.
 *   4. «Lo que puede ver» marca la fuente: el CRM de Alejandro sale como extra.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserMembershipWithProfile } from "@/lib/studio/user-types";
import type { UserModuleGrantView } from "@/lib/studio/user-module-grants-queries";
import { SENSITIVE_MODULE_EFFECTS } from "@/lib/studio/rbac";

const grantMock = vi.fn();
const revokeMock = vi.fn();

vi.mock("../../actions", () => ({
  grantUserModuleAction: (...a: unknown[]) => grantMock(...a),
  revokeUserModuleGrantAction: (...a: unknown[]) => revokeMock(...a),
  changeUserRoleAction: vi.fn(),
  changeWarehouseScopeAction: vi.fn(),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

const { AccesoPanel } = await import("./AccesoPanel");
const { DobleAvisoDialog } = await import("./DobleAvisoDialog");

const ALE = "00000000-0000-4000-8000-0000000000a1";

function miembro(over: Partial<UserMembershipWithProfile> = {}): UserMembershipWithProfile {
  return {
    user_id: ALE,
    tenant_id: "tn-1",
    role: "accounting",
    warehouse_scope: "all",
    disabled_at: null,
    last_login_at: null,
    invited_by: null,
    created_at: "2026-07-03T00:00:00Z",
    email: "persona@ejemplo.test",
    profile: { user_id: ALE, first_name: "Ana", last_name: "Prueba" } as never,
    ...over,
  };
}

function extra(over: Partial<UserModuleGrantView> = {}): UserModuleGrantView {
  return {
    userId: ALE,
    moduleId: "kommo",
    canView: true,
    canEdit: true,
    reason: "Atiende el CRM",
    expiresAt: null,
    grantedBy: null,
    sensitive: false,
    updatedAt: "2026-11-11T12:00:00Z",
    expired: false,
    expiringSoon: false,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  grantMock.mockResolvedValue({ ok: true });
  revokeMock.mockResolvedValue({ ok: true });
});

describe("AccesoPanel · buscador de módulos", () => {
  it("los módulos que la base no acepta se ven con su motivo y no se eligen", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro({ role: "commercial" })} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(screen.getByRole("combobox", { name: "Agregar módulo o área" }));
    const tesoreria = screen.getByRole("option", { name: /Tesorería/ });
    expect(tesoreria).toHaveProperty("disabled", true);
    expect(tesoreria.textContent).toContain("Requiere fase de dinero");
    const usuarios = screen.getByRole("option", { name: /Usuarios/ });
    expect(usuarios).toHaveProperty("disabled", true);
  });

  it("agregar el CRM pide motivo y manda lo elegido", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(screen.getByRole("combobox", { name: "Agregar módulo o área" }));
    await u.click(screen.getByRole("option", { name: /^CRM/ }));
    await u.click(screen.getByRole("button", { name: "Agregar acceso" }));
    expect(grantMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/motivo/i);

    const form = screen.getByRole("group", { name: /Agregar CRM/ });
    await u.click(within(form).getByRole("radio", { name: "Editar" }));
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Atiende leads con comercial");
    await u.click(screen.getByRole("button", { name: "Agregar acceso" }));
    expect(grantMock).toHaveBeenCalledWith({
      targetUserId: ALE,
      moduleId: "kommo",
      canEdit: true,
      reason: "Atiende leads con comercial",
      expiresOn: null,
      confirmSensitive: false,
    });
  });

  it("a un admin no se le ofrecen extras", () => {
    render(<AccesoPanel member={miembro({ role: "admin" })} grants={[]} overrides={{}} nombres={{}} />);
    expect(screen.queryByRole("combobox", { name: "Agregar módulo o área" })).toBeNull();
    expect(screen.getByText(/ya ve y edita todos los módulos/)).toBeTruthy();
  });
});

describe("AccesoPanel · lo que puede ver", () => {
  it("el CRM concedido aparece como extra y Tesorería como del rol", () => {
    render(<AccesoPanel member={miembro()} grants={[extra()]} overrides={{}} nombres={{}} />);
    const crm = screen.getAllByText("CRM").find((el) => el.tagName === "LI");
    expect(crm?.getAttribute("data-src")).toBe("grant");
    const teso = screen.getAllByText("Tesorería").find((el) => el.tagName === "LI");
    expect(teso?.getAttribute("data-src")).toBeNull();
    expect(teso?.getAttribute("data-sens")).toBe("true");
  });

  it("un extra vencido no suma y se marca", () => {
    render(<AccesoPanel member={miembro()} grants={[extra({ expired: true, expiresAt: "2026-11-01T00:00:00Z" })]} overrides={{}} nombres={{}} />);
    expect(screen.getByText("Vencido")).toBeTruthy();
    expect(screen.getAllByText("CRM").find((el) => el.tagName === "LI")).toBeUndefined();
  });
});

describe("DobleAvisoDialog", () => {
  it("lista los efectos y no confirma sin motivo y casilla", async () => {
    const u = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DobleAvisoDialog
        open
        persona="Carlos"
        moduleId="treasury"
        moduleLabel="Tesorería"
        dinero
        soloVer={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const dialogo = screen.getByRole("alertdialog", { name: "Dar Tesorería a Carlos" });
    for (const efecto of SENSITIVE_MODULE_EFFECTS.treasury) {
      expect(within(dialogo).getByText(efecto)).toBeTruthy();
    }
    const dar = screen.getByRole("button", { name: "Sí, dar acceso" });
    expect(dar).toHaveProperty("disabled", true);
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Cubre vacaciones");
    expect(dar).toHaveProperty("disabled", true);
    await u.click(screen.getByRole("checkbox"));
    expect(dar).toHaveProperty("disabled", false);
    await u.click(dar);
    expect(onConfirm).toHaveBeenCalledWith({ canEdit: true, reason: "Cubre vacaciones", expiresOn: null });
  });

  it("«Solo ver» confirma sin edición", async () => {
    const u = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DobleAvisoDialog open persona="Carlos" moduleId="treasury" moduleLabel="Tesorería" dinero soloVer={false} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Solo consulta saldos");
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Solo ver" }));
    expect(onConfirm).toHaveBeenCalledWith({ canEdit: false, reason: "Solo consulta saldos", expiresOn: null });
  });

  it("Esc cancela", async () => {
    const u = userEvent.setup();
    const onCancel = vi.fn();
    render(<DobleAvisoDialog open persona="Carlos" moduleId="users" moduleLabel="Usuarios" dinero={false} soloVer onCancel={onCancel} onConfirm={vi.fn()} />);
    await u.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});
