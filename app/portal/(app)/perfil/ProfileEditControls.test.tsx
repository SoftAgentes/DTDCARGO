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

  it("permite reemplazar una foto existente cuando queda cupo", () => {
    render(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        hasExistingPhoto
        viewUrl="https://example.test/cedula"
      />,
    );

    expect(screen.getByRole("link", { name: /^ver$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /cambiar foto/i })).toBeNull();
    expect(screen.getByText(/reemplazo directo está temporalmente deshabilitado/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /solicitar reemplazo/i })).toBeTruthy();
  });

  it("no confunde un fallo de firma con la ausencia del documento", () => {
    const { rerender } = render(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        hasExistingPhoto
        viewUrl={null}
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
      />,
    );
    expect(screen.getByRole("button", { name: /subir foto/i })).toBeTruthy();
    expect(screen.getByText(/primera carga no usa tu cupo/i)).toBeTruthy();
  });
});
