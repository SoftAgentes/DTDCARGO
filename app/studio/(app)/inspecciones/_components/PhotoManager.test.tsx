/**
 * SDD-0678 fase 2 · la × que elimina una foto de inspección muestra que trabaja (BTN-01 §5): deshabilitada, con
 * `aria-busy` y «Eliminando foto…»; un doble clic borra una vez, y si el servidor falla lo dice (LOD-01) en vez de
 * quedarse callada.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InspectionPhotoItem } from "@/lib/studio/inspecciones/photos";

let terminar: (r: { ok?: boolean; error?: string }) => void = () => {};
const deleteInspectionPhotoAction = vi.fn(
  (_id: string) =>
    new Promise<{ ok?: boolean; error?: string }>((ok) => {
      terminar = ok;
    }),
);
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

vi.mock("../actions", () => ({
  uploadInspectionPhotosAction: vi.fn(async () => ({})),
  deleteInspectionPhotoAction: (id: string) => deleteInspectionPhotoAction(id),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => toast }));

import { PhotoManager } from "./PhotoManager";

const FOTO: InspectionPhotoItem = {
  id: "p1",
  reportId: "r1",
  category: null,
  caption: "Caja máster",
  storagePath: "x/p1.jpg",
  redacted: false,
  sort: 0,
  createdAt: "2026-11-19T00:00:00Z",
  url: null,
};

beforeEach(() => {
  deleteInspectionPhotoAction.mockClear();
  for (const f of Object.values(toast)) f.mockClear();
});
afterEach(cleanup);

describe("PhotoManager · eliminar foto con estado de trabajo", () => {
  it("mientras borra: deshabilitada, aria-busy y «Eliminando foto…»; un doble clic borra una vez", async () => {
    const user = userEvent.setup();
    render(<PhotoManager reportId="r1" photos={[FOTO]} />);

    const x = screen.getByRole("button", { name: "Eliminar foto" });
    expect(x).toHaveAttribute("aria-busy", "false");
    await user.dblClick(x);

    const borrando = await screen.findByRole("button", { name: "Eliminando foto…" });
    expect(borrando).toBeDisabled();
    expect(borrando).toHaveAttribute("aria-busy", "true");
    expect(deleteInspectionPhotoAction).toHaveBeenCalledTimes(1);

    await act(async () => terminar({ ok: true }));
    expect(toast.success).toHaveBeenCalledWith("Foto eliminada");
    expect(await screen.findByRole("button", { name: "Eliminar foto" })).toBeEnabled();
  });

  it("si el servidor falla, lo dice y la × vuelve a estar disponible", async () => {
    const user = userEvent.setup();
    render(<PhotoManager reportId="r1" photos={[FOTO]} />);

    await user.click(screen.getByRole("button", { name: "Eliminar foto" }));
    await screen.findByRole("button", { name: "Eliminando foto…" });
    await act(async () => terminar({ error: "sin permiso" }));

    expect(toast.error).toHaveBeenCalledWith("No se pudo eliminar la foto: sin permiso");
    expect(toast.success).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Eliminar foto" })).toBeEnabled();
  });
});
