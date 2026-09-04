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

describe("controles de edición del perfil · SDD-0435", () => {
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
        viewUrl="https://example.test/cedula"
        quota={quota(2)}
      />,
    );

    expect(screen.getByRole("link", { name: /^ver$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cambiar foto/i })).toBeTruthy();
    expect(screen.getByText(/2 de 3 cambios disponibles/i)).toBeTruthy();
  });

  it("bloquea el reemplazo agotado, pero no la primera carga faltante", () => {
    const { rerender } = render(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        viewUrl="https://example.test/cedula"
        quota={quota(0)}
      />,
    );
    expect(screen.queryByRole("button", { name: /cambiar foto/i })).toBeNull();
    expect(screen.getByText(/cupo agotado/i)).toBeTruthy();

    rerender(
      <CedulaPhotoRow
        label="Cédula de identidad / RIF"
        viewUrl={null}
        quota={quota(0)}
      />,
    );
    expect(screen.getByRole("button", { name: /subir foto/i })).toBeTruthy();
    expect(screen.getByText(/primera carga no usa tu cupo/i)).toBeTruthy();
  });
});
