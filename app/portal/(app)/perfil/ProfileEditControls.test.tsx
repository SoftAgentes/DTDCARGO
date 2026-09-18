import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProfileEditQuota } from "@/lib/portal/profile-edit-quota";

vi.mock("./actions", () => ({
  uploadCedulaPhotoAction: vi.fn(async () => ({})),
  submitDataChangeRequestAction: vi.fn(async () => ({})),
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
  it("bloquea nuevas correcciones de datos cuando se agotaron los 3 cambios", () => {
    render(
      <DataChangeEditor
        isEmpresa={false}
        current={{ name: "Ana Pérez", doc: "V-12345678", phone: "04121234567" }}
        openRequest={null}
        lastRejected={null}
        quota={quota(0)}
      />,
    );

    expect(screen.queryByRole("button", { name: /actualizar mis datos/i })).toBeNull();
    expect(screen.getByText(/ya usaste tus 3 cambios/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /hablar con soporte/i })).toBeTruthy();
  });

  it("mantiene el editor disponible mientras quede cupo", async () => {
    const user = userEvent.setup();
    render(
      <DataChangeEditor
        isEmpresa={false}
        current={{ name: "Ana Pérez", doc: "V-12345678", phone: "04121234567" }}
        openRequest={null}
        lastRejected={null}
        quota={quota(1)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /actualizar mis datos/i }));
    expect(screen.getByRole("button", { name: /enviar solicitud/i })).toBeTruthy();
    expect(screen.getByText(/1 de 3 cambios disponibles/i)).toBeTruthy();
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
