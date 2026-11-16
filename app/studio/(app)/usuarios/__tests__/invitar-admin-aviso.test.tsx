/**
 * SDD-0636 · El formulario de invitar avisa, antes de enviar, que el rol admin
 * es del superadministrador, y el error de la acción siempre se ve.
 *
 * QUÉ DEFIENDE:
 *   1. con el rol admin elegido aparece el aviso (atención, no alerta); con los
 *      demás roles no;
 *   2. si la acción niega, el error sale como alerta (`role="alert"`) dentro del
 *      formulario.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const invite = vi.fn();
const AVISO = /^Invitar a un administrador lo hace solo el superadministrador\./;
const DENIAL =
  "No eres superadministrador. Invitar a un administrador lo hace solo el superadministrador: invita con otro rol o pídeselo a quien administra el sistema.";

async function montar() {
  vi.resetModules();
  vi.doMock("../actions", () => ({ inviteUserAction: (...a: unknown[]) => invite(...a) }));
  const { InviteUserDrawer } = await import("../_components/InviteUserDrawer");
  render(<InviteUserDrawer onClose={() => {}} />);
}

/** El primer select del formulario es el del rol (el segundo, el del equipo). */
const selectDeRol = () => screen.getAllByRole("combobox")[0] as HTMLSelectElement;

beforeEach(() => {
  invite.mockReset();
});

describe("InviteUserDrawer · rol admin", () => {
  it("sin el rol admin no hay aviso; al elegirlo aparece, como atención", async () => {
    await montar();
    expect(screen.queryByText(AVISO)).toBeNull();
    await userEvent.selectOptions(selectDeRol(), "admin");
    const aviso = screen.getByText(AVISO);
    expect(aviso.closest("[role]")?.getAttribute("role")).toBe("status");
    await userEvent.selectOptions(selectDeRol(), "commercial");
    expect(screen.queryByText(AVISO)).toBeNull();
  });

  it("si la acción niega, el error se ve como alerta en el formulario", async () => {
    invite.mockResolvedValue({ error: DENIAL });
    await montar();
    await userEvent.selectOptions(selectDeRol(), "admin");
    await userEvent.type(screen.getByLabelText("Email"), "nueva@prueba.test");
    await userEvent.click(screen.getByRole("button", { name: "Generar link" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain(DENIAL);
    expect(invite).toHaveBeenCalledTimes(1);
    const fd = invite.mock.calls[0][1] as FormData;
    expect(fd.get("role")).toBe("admin");
  });
});
