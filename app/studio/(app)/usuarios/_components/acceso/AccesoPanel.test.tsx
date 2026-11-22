/**
 * SDD-0622 · pestaña «Acceso» de la ficha, rediseñada por la SDD-0635.
 *
 * Lo que defiende (aceptación de la 0635 §7):
 *   1. Al tocar un módulo que se puede dar, las tres opciones están a la vista.
 *   2. Lo que la base no acepta no ofrece opciones y dice su motivo en texto.
 *   3. `support` no ofrece «Ver y editar».
 *   4. Elegir NO guarda: va a la bandeja «N cambios para <persona>».
 *   5. Un motivo, un «Guardar»: una llamada por módulo con el mismo motivo;
 *      fallo a medias conserva solo lo que falta y nombra el que falló.
 *   6. Persona frente a rol: «solo para <persona>».
 *   7. El mapa marca el origen (extra, rol, sensible) y el extra que sobra.
 *   8. El doble aviso sigue igual.
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
const toastWarning = vi.fn();
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: toastWarning }),
}));

const { AccesoPanel } = await import("./AccesoPanel");
const { DobleAvisoDialog } = await import("./DobleAvisoDialog");

const PERSONA = "00000000-0000-4000-8000-0000000000a1";

function miembro(over: Partial<UserMembershipWithProfile> = {}): UserMembershipWithProfile {
  return {
    user_id: PERSONA,
    tenant_id: "tn-1",
    role: "accounting",
    warehouse_scope: "all",
    disabled_at: null,
    last_login_at: null,
    invited_by: null,
    created_at: "2026-07-03T00:00:00Z",
    email: "persona@ejemplo.test",
    profile: { user_id: PERSONA, first_name: "Persona", last_name: "de contabilidad" } as never,
    ...over,
  };
}

function extra(over: Partial<UserModuleGrantView> = {}): UserModuleGrantView {
  return {
    userId: PERSONA,
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

const chip = (nombre: string) => screen.getByRole("button", { name: new RegExp(`^${nombre}:`) });

beforeEach(() => {
  vi.clearAllMocks();
  grantMock.mockResolvedValue({ ok: true });
  revokeMock.mockResolvedValue({ ok: true });
});

describe("AccesoPanel · mapa y detalle (0635 §3.1-3.2)", () => {
  it("al tocar CRM salen las tres opciones a la vista, sin otro paso", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} personasDelRol={2} />);
    await u.click(chip("CRM"));
    const grupo = screen.getByRole("radiogroup", { name: "Acceso extra a CRM" });
    for (const n of ["Sin extra", "Solo ver", "Ver y editar"]) {
      expect(within(grupo).getByRole("radio", { name: new RegExp(n) })).toBeTruthy();
    }
    expect(screen.getByText(/Su rol Contabilidad no incluye CRM/)).toBeTruthy();
  });

  it("lo que la base no acepta no ofrece opciones y dice el motivo en texto", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro({ role: "commercial" })} grants={[]} overrides={{}} nombres={{}} />);
    // Los no disponibles van plegados por área.
    for (const area of screen.getAllByRole("button", { name: /todavía no se pueden? dar como extra/ })) await u.click(area);
    await u.click(chip("Tesorería"));
    expect(screen.queryByRole("radiogroup", { name: /^Acceso extra/ })).toBeNull();
    expect(screen.getByText(/exige el rol contabilidad para el dinero/)).toBeTruthy();
    await u.click(chip("Usuarios"));
    expect(screen.queryByRole("radiogroup", { name: /^Acceso extra/ })).toBeNull();
    expect(screen.getByText(/reserva este módulo al rol administrador/)).toBeTruthy();
  });

  it("Bandeja (Chatwoot) se puede dar como extra (SDD-0675; antes la 0622 la dejaba fuera)", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(chip("Bandeja"));
    const grupo = screen.getByRole("radiogroup", { name: "Acceso extra a Bandeja" });
    for (const n of ["Sin extra", "Solo ver", "Ver y editar"]) {
      expect(within(grupo).getByRole("radio", { name: new RegExp(n) })).toBeTruthy();
    }
    expect(screen.queryByText(/Falta revisar su base/)).toBeNull();
  });

  it("si Chatwoot queda pendiente, guarda igual y avisa al admin (SDD-0675)", async () => {
    const u = userEvent.setup();
    const AVISO = "Guardado; Chatwoot quedó pendiente hasta el próximo ciclo.";
    revokeMock.mockResolvedValueOnce({ ok: true, aviso: AVISO });
    render(<AccesoPanel member={miembro()} grants={[extra({ moduleId: "bandeja", canEdit: false })]} overrides={{}} nombres={{}} />);
    await u.click(chip("Bandeja"));
    await u.click(screen.getByRole("radio", { name: /Quitar extra/ }));
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Ya no atiende chats");
    await u.click(screen.getByRole("button", { name: "Guardar cambio" }));
    expect(revokeMock).toHaveBeenCalledWith({ targetUserId: PERSONA, moduleId: "bandeja", reason: "Ya no atiende chats" });
    expect(await screen.findByText(new RegExp(`1 cambio guardado para Persona de contabilidad\\. ${AVISO}`))).toBeTruthy();
    expect(toastWarning).toHaveBeenCalledWith(AVISO);
  });

  it("sin aviso de la acción no hay aviso de Chatwoot", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[extra({ moduleId: "bandeja", canEdit: false })]} overrides={{}} nombres={{}} />);
    await u.click(chip("Bandeja"));
    await u.click(screen.getByRole("radio", { name: /Quitar extra/ }));
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Ya no atiende chats");
    await u.click(screen.getByRole("button", { name: "Guardar cambio" }));
    expect(await screen.findByText("1 cambio guardado para Persona de contabilidad.")).toBeTruthy();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("soporte no ofrece «Ver y editar»", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro({ role: "support" })} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(chip("CRM"));
    expect(screen.getByRole("radio", { name: /Ver y editar/ })).toHaveProperty("disabled", true);
    expect(screen.getByText("Soporte nunca edita.")).toBeTruthy();
  });

  it("Esc cierra el detalle y devuelve el foco al chip", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(chip("CRM"));
    await u.click(screen.getByRole("radio", { name: /Solo ver/ }));
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("radiogroup", { name: /^Acceso extra/ })).toBeNull();
    expect(document.activeElement).toBe(chip("CRM"));
  });

  it("a un admin no se le ofrecen extras", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro({ role: "admin" })} grants={[]} overrides={{}} nombres={{}} />);
    expect(screen.getByText(/ya ve y edita todos los módulos/)).toBeTruthy();
    await u.click(chip("CRM"));
    expect(screen.queryByRole("radiogroup", { name: /^Acceso extra/ })).toBeNull();
  });

  it("el mapa marca el origen: CRM como extra, Tesorería por su rol y sensible", () => {
    render(<AccesoPanel member={miembro()} grants={[extra()]} overrides={{}} nombres={{}} />);
    expect(chip("CRM").getAttribute("data-src")).toBe("grant");
    expect(chip("CRM").getAttribute("aria-label")).toMatch(/acceso extra, ver y editar/);
    expect(chip("Tesorería").getAttribute("data-src")).toBe("role");
    expect(chip("Tesorería").getAttribute("data-sens")).toBe("true");
  });

  it("un extra vencido no suma", () => {
    render(<AccesoPanel member={miembro()} grants={[extra({ expired: true, expiresAt: "2026-11-01T00:00:00Z" })]} overrides={{}} nombres={{}} />);
    expect(chip("CRM").getAttribute("data-src")).toBe("none");
  });

  it("un extra que su rol ya cubre se marca «sobra» y se puede quitar", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[extra({ moduleId: "rates" })]} overrides={{}} nombres={{}} />);
    expect(chip("Tarifas").getAttribute("aria-label")).toMatch(/con un extra que sobra/);
    await u.click(chip("Tarifas"));
    await u.click(screen.getByRole("button", { name: "Quitar el extra que sobra" }));
    expect(screen.getByText("Quitar extra · Tarifas")).toBeTruthy();
  });
});

describe("AccesoPanel · persona frente a rol (0635 §3.4)", () => {
  it("dice que el cambio es solo para esa persona y cuántas comparten el rol", () => {
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} personasDelRol={2} />);
    expect(screen.getByRole("note").textContent).toMatch(/solo para Persona de contabilidad.*No toca a las otras personas de Contabilidad/);
    expect(screen.getByText(/tienen el rol Contabilidad\. El rol es el piso/)).toBeTruthy();
  });
});

describe("AccesoPanel · bandeja (0635 §3.3)", () => {
  it("elegir no guarda: el cambio va a la bandeja con su alcance", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(chip("CRM"));
    await u.click(screen.getByRole("radio", { name: /Ver y editar/ }));
    expect(grantMock).not.toHaveBeenCalled();
    expect(revokeMock).not.toHaveBeenCalled();
    const bandeja = screen.getByRole("region", { name: "1 cambio para Persona de contabilidad" });
    expect(within(bandeja).getByText("No cambia el rol Contabilidad")).toBeTruthy();
    expect(within(bandeja).getByText("+ CRM · ver y editar")).toBeTruthy();
    expect(within(bandeja).getByText(/No escribas datos personales/)).toBeTruthy();
  });

  it("sin motivo no guarda; con motivo, una llamada por módulo con el mismo motivo", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(chip("CRM"));
    await u.click(screen.getByRole("radio", { name: /Ver y editar/ }));
    await u.click(chip("Conversaciones"));
    await u.click(screen.getByRole("radio", { name: /Solo ver/ }));
    await u.click(screen.getByRole("button", { name: "Guardar 2 cambios" }));
    expect(grantMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/motivo/i);

    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Atiende leads los sábados");
    await u.click(screen.getByRole("button", { name: "Guardar 2 cambios" }));
    expect(grantMock).toHaveBeenCalledTimes(2);
    expect(grantMock).toHaveBeenCalledWith({
      targetUserId: PERSONA,
      moduleId: "kommo",
      canEdit: true,
      reason: "Atiende leads los sábados",
      expiresOn: null,
      confirmSensitive: false,
    });
    expect(grantMock).toHaveBeenCalledWith(expect.objectContaining({ moduleId: "conversaciones", canEdit: false, reason: "Atiende leads los sábados" }));
    expect(await screen.findByText("2 cambios guardados para Persona de contabilidad.")).toBeTruthy();
  });

  it("fallo a medias: el primero queda guardado, la bandeja conserva dos y nombra el que falló", async () => {
    const u = userEvent.setup();
    grantMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ error: "Sin permiso." });
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} />);
    for (const [m, n] of [["Conversaciones", /Solo ver/], ["CRM", /Ver y editar/], ["PreAlertas de servicios", /Ver y editar/]] as const) {
      await u.click(chip(m));
      await u.click(screen.getByRole("radio", { name: n }));
    }
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Cubre una ausencia");
    await u.click(screen.getByRole("button", { name: "Guardar 3 cambios" }));
    expect(grantMock).toHaveBeenCalledTimes(2);
    const bandeja = await screen.findByRole("region", { name: "2 cambios para Persona de contabilidad" });
    expect(within(bandeja).getByRole("alert").textContent).toMatch(/^CRM: Sin permiso\..*cambio anterior quedó guardado/);
    expect((screen.getByLabelText("Motivo (obligatorio)") as HTMLInputElement).value).toBe("Cubre una ausencia");
  });

  it("si la acción lanza (corte de red), se ve el error y no se pierde lo escrito", async () => {
    const u = userEvent.setup();
    grantMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(chip("CRM"));
    await u.click(screen.getByRole("radio", { name: /Ver y editar/ }));
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Atiende leads con comercial");
    await u.click(screen.getByRole("button", { name: "Guardar cambio" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/se cortó la conexión/);
    expect((screen.getByLabelText("Motivo (obligatorio)") as HTMLInputElement).value).toBe("Atiende leads con comercial");
  });

  it("quitar un extra pasa por la bandeja y llama a revocar con el motivo", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[extra()]} overrides={{}} nombres={{}} />);
    await u.click(chip("CRM"));
    await u.click(screen.getByRole("radio", { name: /Quitar extra/ }));
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Ya no atiende el CRM");
    await u.click(screen.getByRole("button", { name: "Guardar cambio" }));
    expect(revokeMock).toHaveBeenCalledWith({ targetUserId: PERSONA, moduleId: "kommo", reason: "Ya no atiende el CRM" });
  });

  it("cambiar el nivel de un extra con vencimiento lo conserva si no se escribe uno nuevo", async () => {
    const u = userEvent.setup();
    render(
      <AccesoPanel
        member={miembro()}
        grants={[extra({ canEdit: false, expiresAt: "2026-12-31T03:59:59.000Z" })]}
        overrides={{}}
        nombres={{}}
      />,
    );
    await u.click(chip("CRM"));
    await u.click(screen.getByRole("radio", { name: /Ver y editar/ }));
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Ahora también edita");
    await u.click(screen.getByRole("button", { name: "Guardar cambio" }));
    // 2026-12-31T03:59:59Z es el 30 de diciembre a las 23:59 en Caracas.
    expect(grantMock).toHaveBeenCalledWith(expect.objectContaining({ moduleId: "kommo", canEdit: true, expiresOn: "2026-12-30" }));
  });

  it("«Todo Comercial» llena la bandeja con los comerciales que se pueden dar", async () => {
    const u = userEvent.setup();
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} />);
    await u.click(screen.getByRole("button", { name: "Todo Comercial" }));
    expect(grantMock).not.toHaveBeenCalled();
    const bandeja = screen.getByRole("region", { name: /cambios para Persona de contabilidad/ });
    expect(within(bandeja).getByText("+ CRM · ver y editar")).toBeTruthy();
    expect(within(bandeja).queryByText(/Tarifas/)).toBeNull(); // su rol ya lo da
    // SDD-0675: la Bandeja abre chats y Chatwoot; el atajo no la suma.
    expect(within(bandeja).queryByText(/Bandeja/)).toBeNull();
  });

  it("avisa al cajón cuántos cambios quedan sin guardar", async () => {
    const u = userEvent.setup();
    const onPendientes = vi.fn();
    render(<AccesoPanel member={miembro()} grants={[]} overrides={{}} nombres={{}} onPendientes={onPendientes} />);
    await u.click(chip("CRM"));
    await u.click(screen.getByRole("radio", { name: /Solo ver/ }));
    expect(onPendientes).toHaveBeenLastCalledWith(1);
    await u.click(screen.getByRole("button", { name: "Deshacer CRM" }));
    expect(onPendientes).toHaveBeenLastCalledWith(0);
  });
});

describe("DobleAvisoDialog", () => {
  it("lista los efectos y no confirma sin motivo y casilla", async () => {
    const u = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DobleAvisoDialog
        open
        persona="Persona de prueba"
        moduleId="treasury"
        moduleLabel="Tesorería"
        dinero
        soloVer={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const dialogo = screen.getByRole("alertdialog", { name: "Dar Tesorería a Persona de prueba" });
    for (const efecto of SENSITIVE_MODULE_EFFECTS.treasury) {
      expect(within(dialogo).getByText(efecto)).toBeTruthy();
    }
    expect(within(dialogo).getByText(/No escribas datos personales/)).toBeTruthy();
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
      <DobleAvisoDialog open persona="Persona de prueba" moduleId="treasury" moduleLabel="Tesorería" dinero soloVer={false} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "Solo consulta saldos");
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Solo ver" }));
    expect(onConfirm).toHaveBeenCalledWith({ canEdit: false, reason: "Solo consulta saldos", expiresOn: null });
  });

  it("Esc cancela", async () => {
    const u = userEvent.setup();
    const onCancel = vi.fn();
    render(<DobleAvisoDialog open persona="Persona de prueba" moduleId="users" moduleLabel="Usuarios" dinero={false} soloVer onCancel={onCancel} onConfirm={vi.fn()} />);
    await u.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});
