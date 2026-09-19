import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  setKind: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(async () => ({ ok: true, done: "kind" })),
  remove: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(async () => ({ ok: true, done: "removed" })),
  updateAvatar: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(async () => ({ ok: true })),
  prepare: vi.fn(),
}));

vi.mock("./billing-actions", () => ({
  setBillingKindAction: (...a: unknown[]) => actions.setKind(...a),
  removeBillingIdentityAction: (...a: unknown[]) => actions.remove(...a),
  saveBillingIdentityAction: vi.fn(async () => ({})),
}));
vi.mock("./avatar-actions", () => ({
  updateAvatarAction: (...a: unknown[]) => actions.updateAvatar(...a),
  removeAvatarAction: vi.fn(async () => ({ ok: true, removed: true })),
}));
vi.mock("@/lib/portal/avatar-image", () => ({
  prepareAvatar: (...a: unknown[]) => actions.prepare(...a),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const { BillingKindSelector } = await import("./BillingKindSelector");
const { BillingIdentityCard } = await import("./BillingIdentityCard");
const { AvatarEditor } = await import("./AvatarEditor");

afterEach(() => {
  cleanup();
  actions.setKind.mockClear();
  actions.remove.mockClear();
  actions.updateAvatar.mockClear();
  actions.prepare.mockReset();
});

const company = { kind: "empresa" as const, legalName: "Importadora Pérez C.A.", doc: "J-12345678-9", fiscalAddress: null };

describe("Facturar a nombre de · SDD-0487", () => {
  it("sin empresa, la opción de empresa está deshabilitada y dice qué falta", () => {
    render(
      <BillingKindSelector principalKind="persona" principalName="Carlos Pérez" principalDoc="V-12345678"
        secondary={null} billingKind="persona" />,
    );
    const group = screen.getByRole("group", { name: "Facturar a nombre de" });
    expect(group).toBeTruthy();
    const mine = screen.getByRole("radio", { name: /A mi nombre/ }) as HTMLInputElement;
    const theirs = screen.getByRole("radio", { name: /A nombre de mi empresa/ }) as HTMLInputElement;
    expect(mine.checked).toBe(true);
    expect(theirs.disabled).toBe(true);
    expect(screen.getByText("Primero agrega tu empresa.")).toBeTruthy();
    expect(screen.getByText("Cédula V-12345678")).toBeTruthy();
  });

  it("elegir la empresa la guarda y lo anuncia", async () => {
    render(
      <BillingKindSelector principalKind="persona" principalName="Carlos Pérez" principalDoc="V-12345678"
        secondary={company} billingKind="persona" />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /A nombre de mi empresa/ }));
    await waitFor(() => expect(actions.setKind).toHaveBeenCalledTimes(1));
    const fd = actions.setKind.mock.calls[0][1] as FormData;
    expect(fd.get("billing_kind")).toBe("empresa");
    expect(await screen.findByText("Listo. Tus próximas facturas salen a nombre de tu empresa.")).toBeTruthy();
    expect(screen.getByText("RIF J-12345678-9")).toBeTruthy();
  });

  it("si el guardado falla, vuelve a la opción del servidor y muestra el error", async () => {
    actions.setKind.mockResolvedValueOnce({ error: "No pudimos guardar tus datos. Prueba de nuevo." });
    render(
      <BillingKindSelector principalKind="persona" principalName="Carlos Pérez" principalDoc="V-12345678"
        secondary={company} billingKind="persona" />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /A nombre de mi empresa/ }));
    expect(await screen.findByText("No pudimos guardar tus datos. Prueba de nuevo.")).toBeTruthy();
    await waitFor(() =>
      expect((screen.getByRole("radio", { name: /A mi nombre/ }) as HTMLInputElement).checked).toBe(true),
    );
  });

  it("una cuenta de empresa ve primero su empresa y le falta la cédula para facturar a su nombre", () => {
    render(
      <BillingKindSelector principalKind="empresa" principalName="Comercial Andina C.A." principalDoc="J-50123456-1"
        secondary={null} billingKind="empresa" />,
    );
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(["empresa", "persona"]);
    expect(radios[1].disabled).toBe(true);
    expect(screen.getByText("Agrega tu nombre y tu cédula para usar esta opción.")).toBeTruthy();
  });
});

describe("Mi empresa · SDD-0487", () => {
  it("sin empresa ofrece agregarla en su pantalla", () => {
    render(<BillingIdentityCard principalKind="persona" secondary={null} />);
    expect(screen.getByRole("heading", { name: "Mi empresa" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Agregar empresa/ }).getAttribute("href")).toBe("/portal/perfil/empresa");
  });

  it("quitar la empresa pide confirmación antes de llamar a la action", async () => {
    render(<BillingIdentityCard principalKind="persona" secondary={company} />);
    expect(screen.getByText("Importadora Pérez C.A.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Quitar empresa" }));
    expect(actions.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sí, quitar" }));
    await waitFor(() => expect(actions.remove).toHaveBeenCalledTimes(1));
  });
});

describe("Foto de perfil · SDD-0487", () => {
  it("se encuentra: botón de cámara con nombre y botón visible «Subir foto de perfil»", () => {
    render(<AvatarEditor name="Carlos Pérez" avatarUrl={null} />);
    expect(screen.getByRole("button", { name: "Cambiar foto de perfil" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Subir foto de perfil/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quitar foto" })).toBeNull();
  });

  it("una foto que no se puede leer da el mensaje y no sube nada", async () => {
    actions.prepare.mockResolvedValue({ ok: false, error: "No pudimos leer esa foto. Elige otra o conviértela a JPG." });
    const { container } = render(<AvatarEditor name="Carlos Pérez" avatarUrl={null} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File([new Uint8Array(10)], "IMG_1.heic", { type: "image/heic" }));
    expect(await screen.findByText("No pudimos leer esa foto. Elige otra o conviértela a JPG.")).toBeTruthy();
    expect(actions.updateAvatar).not.toHaveBeenCalled();
  });

  it("una foto preparada se sube y se anuncia", async () => {
    const prepared = new File([new Uint8Array(10)], "avatar.jpg", { type: "image/jpeg" });
    actions.prepare.mockResolvedValue({ ok: true, file: prepared });
    const { container } = render(<AvatarEditor name="Carlos Pérez" avatarUrl={null} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File([new Uint8Array(10)], "foto.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(actions.updateAvatar).toHaveBeenCalledTimes(1));
    expect((actions.updateAvatar.mock.calls[0][1] as FormData).get("avatar")).toBe(prepared);
    expect(await screen.findByText("Foto actualizada")).toBeTruthy();
  });

  it("con foto, «Quitar foto» pide confirmación", async () => {
    render(<AvatarEditor name="Carlos Pérez" avatarUrl="https://storage.test/a.jpg" />);
    await userEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
    expect(screen.getByText("¿Quitar tu foto de perfil?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sí, quitar" })).toBeTruthy();
  });
});
