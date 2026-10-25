/**
 * SDD-0566 · El cajón «Nuevo asiento» con una fecha de período cerrado: cuando
 * el servidor devuelve el aviso, el mismo formulario lleva la superclave y el
 * motivo con los nombres que lee `createJournalEntry` (`cierre_superclave`,
 * `cierre_motivo`), y la superclave se vacía después de cada respuesta.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Account } from "@/lib/studio/account-types";

const acciones = vi.hoisted(() => ({ createJournalEntry: vi.fn() }));
vi.mock("@/app/studio/(app)/contabilidad/actions", () => acciones);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { EntryDrawer } from "../_components/EntryDrawer";

const CLAVE = "Clave-Secreta-77";
const AVISO = { closingDate: "2026-01-31", modo: "superclave" as const, superclaveDefinida: true };

const cuenta = (id: string, code: string): Account => ({
  id,
  tenant_id: "t",
  code,
  name: `Cuenta ${code}`,
  type: "A",
  parent_id: null,
  qbo_type: null,
  subtype: null,
  is_postable: true,
  notes: null,
  created_at: "",
  updated_at: "",
});

describe("SDD-0566 · Nuevo asiento con fecha de período cerrado", () => {
  it("pide la excepción en el mismo formulario y la manda con los nombres que lee el servidor", async () => {
    const enviados: FormData[] = [];
    acciones.createJournalEntry.mockImplementation(async (_prev: unknown, fd: FormData) => {
      enviados.push(fd);
      return enviados.length === 1
        ? { error: "Este período ya cerró contablemente (cierre al 31/01/2026). Para cambiarlo, ingresa la superclave y el motivo.", cierre: AVISO }
        : { error: "La superclave no es correcta.", cierre: AVISO };
    });
    render(<EntryDrawer postableAccounts={[cuenta("caja", "1.1.1"), cuenta("ventas", "4.1")]} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^Fecha/), { target: { value: "2026-01-20" } });
    fireEvent.change(screen.getByLabelText("Cuenta línea 1"), { target: { value: "caja" } });
    fireEvent.change(screen.getByLabelText("Debe línea 1"), { target: { value: "75" } });
    fireEvent.change(screen.getByLabelText("Cuenta línea 2"), { target: { value: "ventas" } });
    fireEvent.change(screen.getByLabelText("Haber línea 2"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear y asentar" }));

    // El aviso, sin el bloque rojo de error: es el pedido de la excepción.
    const clave = await screen.findByLabelText("Superclave del cierre");
    expect(screen.queryByRole("alert")).toBeNull();
    const crear = screen.getByRole("button", { name: "Crear con excepción" });
    expect(crear).toBeDisabled();

    fireEvent.change(clave, { target: { value: CLAVE } });
    fireEvent.change(screen.getByLabelText("Motivo del cambio"), { target: { value: "Ajuste que faltaba" } });
    expect(crear).toBeEnabled();
    fireEvent.click(crear);

    await waitFor(() => expect(enviados).toHaveLength(2));
    expect(enviados[0].get("cierre_superclave")).toBeNull();
    expect(enviados[1].get("cierre_superclave")).toBe(CLAVE);
    expect(enviados[1].get("cierre_motivo")).toBe("Ajuste que faltaba");
    // La respuesta mala se ve, y la superclave queda vacía para reintentar.
    expect(await screen.findByRole("alert")).toHaveTextContent("La superclave no es correcta.");
    await waitFor(() => expect(screen.getByLabelText("Superclave del cierre")).toHaveValue(""));
  });
});
