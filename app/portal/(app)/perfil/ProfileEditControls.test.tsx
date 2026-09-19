import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProfileEditQuota } from "@/lib/portal/profile-edit-quota";

const actions = vi.hoisted(() => ({
  update: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(
    async () => ({}),
  ),
}));

vi.mock("./actions", () => ({
  uploadCedulaPhotoAction: vi.fn(async () => ({})),
  updateMyProfileAction: (...args: unknown[]) => actions.update(...args),
  cancelDataChangeRequestAction: vi.fn(async () => ({})),
}));

const { DataChangeEditor } = await import("./DataChangeEditor");
const { CedulaPhotoRow } = await import("./CedulaPhotoRow");

afterEach(cleanup);

function quota(remaining: number, available = true): ProfileEditQuota {
  return {
    limit: 3,
    applied: 3 - remaining,
    reserved: 0,
    remaining,
    available,
  };
}

describe("controles de edición del perfil · SDD-0439", () => {
  it("bloquea la edición de datos cuando se agotaron los 3 cambios", () => {
    render(
      <DataChangeEditor
        isEmpresa={false}
        current={{ name: "Ana Pérez", doc: "V-12345678", phone: "04121234567" }}
        openRequest={null}
        lastRejected={null}
        quota={quota(0)}
      />,
    );

    expect(screen.queryByRole("button", { name: /editar mis datos/i })).toBeNull();
    expect(screen.getByText(/ya usaste tus 3 cambios/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /hablar con soporte/i })).toBeTruthy();
  });

  it("edita directo con confirmación antes de gastar un cambio · SDD-0482", async () => {
    const user = userEvent.setup();
    actions.update.mockResolvedValueOnce({ ok: true });
    render(
      <DataChangeEditor
        isEmpresa={false}
        current={{ name: "Ana Pérez", doc: "V-12345678", phone: "04121234567" }}
        openRequest={null}
        lastRejected={null}
        quota={quota(1)}
      />,
    );

    expect(screen.getByText(/1 de 3 cambios disponibles/i)).toBeTruthy();
    expect(screen.getByText(/se aplica al\s+instante/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /editar mis datos/i }));

    const phone = screen.getByLabelText(/teléfono/i) as HTMLInputElement;
    expect(phone.value).toBe("04121234567");
    await user.clear(phone);
    await user.type(phone, "04141234567");

    // Primer paso: sólo informa el costo; todavía no guarda.
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));
    expect(actions.update).not.toHaveBeenCalled();
    expect(screen.getByText(/usa 1 de tus 1 cambio disponible y se aplica al instante/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /sí, guardar/i }));
    expect(actions.update).toHaveBeenCalledTimes(1);
    const form = actions.update.mock.calls[0][1] as FormData;
    expect(form.get("phone")).toBe("04141234567");
    expect(form.get("doc")).toBe("V-12345678");
    expect(await screen.findByText("Datos actualizados.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sí, guardar/i })).toBeNull();
  });

  it("un error del servidor conserva lo escrito y vuelve al primer paso", async () => {
    const user = userEvent.setup();
    actions.update.mockResolvedValueOnce({
      error: "Revisa los datos marcados.",
      fieldErrors: { doc: "Cédula o pasaporte inválido." },
    });
    render(
      <DataChangeEditor
        isEmpresa={false}
        current={{ name: "Ana Pérez", doc: "V-12345678", phone: "04121234567" }}
        openRequest={null}
        lastRejected={null}
        quota={quota(2)}
      />,
    );
    await user.click(screen.getByRole("button", { name: /editar mis datos/i }));
    const doc = screen.getByLabelText(/cédula \/ rif/i) as HTMLInputElement;
    await user.clear(doc);
    await user.type(doc, "X-1");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await user.click(screen.getByRole("button", { name: /sí, guardar/i }));

    expect(await screen.findByText("Cédula o pasaporte inválido.")).toBeTruthy();
    expect((screen.getByLabelText(/cédula \/ rif/i) as HTMLInputElement).value).toBe("X-1");
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeTruthy();
  });

  it("una solicitud vieja en revisión se puede reemplazar editando ahora", async () => {
    const user = userEvent.setup();
    render(
      <DataChangeEditor
        isEmpresa={false}
        current={{ name: "Ana Pérez", doc: "V-12345678", phone: "04121234567" }}
        openRequest={{
          id: "req",
          tenantId: "t",
          clientId: "c",
          proposedName: "Ana María Pérez",
          proposedRif: null,
          proposedPhone: null,
          prevName: "Ana Pérez",
          prevRif: null,
          prevPhone: null,
          status: "pending",
          source: "client",
          submittedAt: "2026-09-01T10:00:00Z",
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
        }}
        lastRejected={null}
        quota={quota(2)}
      />,
    );

    expect(screen.getByText(/cambio en revisión/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancelar esta solicitud/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /editar ahora/i }));
    expect(screen.getByText(/tu solicitud en revisión se reemplaza/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeTruthy();
  });

  it("permite reemplazar una foto existente cuando queda cupo, previa confirmación · SDD-0481", async () => {
    const user = userEvent.setup();
    render(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        hasExistingPhoto
        viewUrl="https://example.test/cedula"
        quota={quota(2)}
      />,
    );

    expect(screen.getByRole("link", { name: /^ver$/i })).toBeTruthy();
    expect(screen.getByText(/2 de 3 cambios disponibles/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /pedir ayuda/i })).toBeNull();

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][name="cedula_photo"]',
    )!;
    const pick = vi.spyOn(input, "click").mockImplementation(() => {});

    // Primer paso: sólo informa el costo; todavía no abre el selector.
    await user.click(screen.getByRole("button", { name: /cambiar foto/i }));
    expect(pick).not.toHaveBeenCalled();
    expect(
      screen.getByText(/usa 1 de tus 2 cambios disponibles.*asesor revisa la nueva/i),
    ).toBeTruthy();

    // Cancelar cierra la confirmación sin abrir nada.
    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(screen.queryByRole("button", { name: /elegir foto nueva/i })).toBeNull();
    expect(pick).not.toHaveBeenCalled();

    // Segundo paso: recién ahí se abre el selector de archivos.
    await user.click(screen.getByRole("button", { name: /cambiar foto/i }));
    await user.click(screen.getByRole("button", { name: /elegir foto nueva/i }));
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it("con un solo cambio restante lo dice en singular", async () => {
    const user = userEvent.setup();
    render(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        hasExistingPhoto
        viewUrl="https://example.test/cedula"
        quota={quota(1)}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cambiar foto/i }));
    expect(screen.getByText(/usa 1 de tus 1 cambio disponible\./i)).toBeTruthy();
  });

  it.each([
    ["agotado", quota(0), /ya usaste tus 3 cambios/i],
    // Cupo ilegible falla cerrado aunque el número diga que queda.
    ["ilegible", quota(3, false), /no pudimos consultar tu cupo/i],
  ])("sin cupo %s no ofrece reemplazar y conduce a soporte", (_caso, q, texto) => {
    render(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        hasExistingPhoto
        viewUrl="https://example.test/cedula"
        quota={q}
      />,
    );

    expect(screen.getByRole("link", { name: /^ver$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /cambiar foto/i })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText(texto)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /pedir ayuda con el documento/i }),
    ).toBeTruthy();
  });

  it("no confunde un fallo de firma con la ausencia del documento", () => {
    const { rerender } = render(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        hasExistingPhoto
        viewUrl={null}
        quota={quota(0)}
      />,
    );
    expect(screen.queryByRole("button", { name: /cambiar foto/i })).toBeNull();
    expect(screen.getByText(/vista temporal no disponible/i)).toBeTruthy();
    expect(screen.queryByText(/^pendiente$/i)).toBeNull();

    rerender(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        hasExistingPhoto={false}
        viewUrl={null}
        quota={quota(0)}
      />,
    );
    expect(screen.getByRole("button", { name: /subir foto/i })).toBeTruthy();
    expect(screen.getByText(/primera carga no usa tu cupo/i)).toBeTruthy();
  });

  it("la primera carga abre el selector sin confirmación aunque el cupo esté agotado", async () => {
    const user = userEvent.setup();
    render(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        hasExistingPhoto={false}
        viewUrl={null}
        quota={quota(0)}
      />,
    );
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][name="cedula_photo"]',
    )!;
    const pick = vi.spyOn(input, "click").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: /subir foto/i }));
    expect(pick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /elegir foto nueva/i })).toBeNull();
  });
});
