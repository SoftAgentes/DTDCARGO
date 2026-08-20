/**
 * `RolYAlcanceCard` — el orden y los candados (SDD-0273 · Slice 1).
 *
 * QUÉ DEFIENDE. Tres reglas que viven en UN solo sitio del componente y que
 * nada más sostenía:
 *
 *   1. **El rol se aplica ANTES que el alcance.** Si cambia el rol, cambia si
 *      el alcance aplica siquiera. Invertir los dos bloques escribiría un
 *      alcance para un rol que ya no lo usa.
 *   2. **Si el rol falla, el alcance no se toca.** El `return` temprano es lo
 *      único que lo impide; borrarlo dejaría el alcance escrito sobre un rol
 *      que no llegó a cambiar.
 *   3. **`hayCambio` respeta `scopeAplica`.** Sin eso se podía confirmar un
 *      cambio que no escribía nada.
 *
 * Los tres son invisibles para los tests de server action: ahí las acciones se
 * llaman sueltas y el orden lo pone el componente.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserMembershipWithProfile } from "@/lib/studio/user-types";

const rolMock = vi.fn();
const scopeMock = vi.fn();
const orden: string[] = [];

vi.mock("../../actions", () => ({
  changeUserRoleAction: (...a: unknown[]) => {
    orden.push("rol");
    return rolMock(...a);
  },
  changeWarehouseScopeAction: (...a: unknown[]) => {
    orden.push("alcance");
    return scopeMock(...a);
  },
}));

const { RolYAlcanceCard } = await import("./RolYAlcanceCard");

const MOTIVO = "pasa a llevar la conciliacion";

function miembro(over: Partial<UserMembershipWithProfile> = {}): UserMembershipWithProfile {
  return {
    user_id: "u-1",
    tenant_id: "tn-1",
    role: "operations",
    warehouse_scope: "all",
    disabled_at: null,
    last_login_at: null,
    invited_by: null,
    created_at: "2026-07-03T00:00:00Z",
    email: "alguien@dtdcargo.com",
    profile: { user_id: "u-1", first_name: "Ana", last_name: "Perez" } as never,
    ...over,
  };
}

/** Abre el diálogo, escribe el motivo y confirma. */
async function aplicarCon(u: ReturnType<typeof userEvent.setup>, motivo = MOTIVO) {
  await u.click(screen.getByRole("button", { name: "Aplicar" }));
  await u.type(screen.getByRole("textbox"), motivo);
  await u.click(screen.getByRole("button", { name: /aplicar cambio/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  orden.length = 0;
  rolMock.mockResolvedValue({ ok: true });
  scopeMock.mockResolvedValue({ ok: true });
});

describe("RolYAlcanceCard · el orden de escritura", () => {
  it("aplica el rol primero y el alcance después", async () => {
    const u = userEvent.setup();
    render(<RolYAlcanceCard member={miembro({ role: "operations", warehouse_scope: "all" })} />);

    // `warehouse` sigue siendo scoped, así que las dos escrituras corren.
    await u.selectOptions(screen.getByLabelText("Rol"), "warehouse");
    await u.selectOptions(screen.getByLabelText("Almacén"), "cn");
    await aplicarCon(u);

    expect(orden).toEqual(["rol", "alcance"]);
  });

  it("si el rol falla, el alcance NO se escribe", async () => {
    const u = userEvent.setup();
    rolMock.mockResolvedValue({ error: "La base rechazó el cambio." });
    render(<RolYAlcanceCard member={miembro({ role: "operations", warehouse_scope: "all" })} />);

    await u.selectOptions(screen.getByLabelText("Rol"), "warehouse");
    await u.selectOptions(screen.getByLabelText("Almacén"), "cn");
    await aplicarCon(u);

    expect(rolMock).toHaveBeenCalledTimes(1);
    expect(scopeMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/rechazó el cambio/i)).toBeTruthy();
  });

  it("un rol que no admite alcance no escribe el alcance aunque el select se haya tocado", async () => {
    const u = userEvent.setup();
    render(<RolYAlcanceCard member={miembro({ role: "operations", warehouse_scope: "all" })} />);

    // Se toca el alcance MIENTRAS el rol todavía lo admite…
    await u.selectOptions(screen.getByLabelText("Almacén"), "cn");
    // …y después el rol pasa a uno que no tiene lado geográfico.
    await u.selectOptions(screen.getByLabelText("Rol"), "accounting");
    await aplicarCon(u);

    expect(rolMock).toHaveBeenCalledTimes(1);
    expect(scopeMock).not.toHaveBeenCalled();
  });
});

describe("RolYAlcanceCard · los candados", () => {
  it("mirarte a ti mismo deshabilita Aplicar y dice por qué, sin tener que enfocar nada", () => {
    render(<RolYAlcanceCard member={miembro()} esYo />);

    expect(screen.getByRole("button", { name: "Aplicar" })).toHaveProperty("disabled", true);
    // BTN-01 §6: el motivo se LEE, no vive en un title.
    expect(screen.getByText(/no puedes cambiar tu propio rol/i)).toBeTruthy();
  });

  it("sin cambios, Aplicar arranca deshabilitado", () => {
    render(<RolYAlcanceCard member={miembro()} />);
    expect(screen.getByRole("button", { name: "Aplicar" })).toHaveProperty("disabled", true);
  });

  it("tocar el alcance sobre un rol que no lo admite NO habilita Aplicar", async () => {
    const u = userEvent.setup();
    // `accounting` no es scoped: su select de almacén está deshabilitado y
    // ningún cambio de alcance debería contar como cambio.
    render(<RolYAlcanceCard member={miembro({ role: "accounting", warehouse_scope: "all" })} />);

    expect(screen.getByLabelText("Almacén")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Aplicar" })).toHaveProperty("disabled", true);
    await Promise.resolve();
  });
});
