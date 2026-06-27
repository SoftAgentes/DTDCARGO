/**
 * Tests del ClientCombobox (SDD-0108 · §3 verificación).
 *
 * Cubre: abre al escribir, filtra (muestra coincidencias), navega con teclado y
 * selecciona con Enter, cierra con Esc, fallback manual (onManualChange con cada
 * tecla). La server action de búsqueda está mockeada — sin red ni DB.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { ClientSearchHit } from "@/lib/studio/client-search-action";

const searchMock = vi.fn();
vi.mock("@/lib/studio/client-search-action", () => ({
  searchClientsAction: (...args: unknown[]) => searchMock(...args),
}));

import { ClientCombobox } from "./ClientCombobox";

const HITS: ClientSearchHit[] = [
  { id: "c-1", markbox: "DTD-0001", name: "Ana Pérez", rif: "V-12345678", person_id: "p-1" },
  { id: "c-2", markbox: "DTD-0002", name: "Beto López", rif: "V-87654321", person_id: "p-2" },
];

/** Wrapper controlado (el combobox es controlado por el caller). */
function Harness({ onSelect }: { onSelect: (c: ClientSearchHit) => void }) {
  const [value, setValue] = useState("");
  return (
    <ClientCombobox
      id="cb"
      value={value}
      onManualChange={setValue}
      onSelect={onSelect}
      ariaLabel="Cliente"
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  searchMock.mockResolvedValue({ hits: HITS });
});

afterEach(() => cleanup());

describe("ClientCombobox", () => {
  it("abre y filtra al escribir (muestra cédula + Shipping Mark + nombre)", async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={() => {}} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "ana");

    await waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("V-12345678")).toBeInTheDocument();
    expect(screen.getByText("DTD-0001")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
  });

  it("navega con flechas y selecciona con Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "lo");
    await screen.findByRole("listbox");
    // Esperar a que las opciones estén renderizadas (post-debounce + search).
    await screen.findByText("Beto López");

    // active arranca en 0; bajamos al 1 y Enter elige el segundo.
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(HITS[1]);
  });

  it("Esc cierra el dropdown", async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={() => {}} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "ana");
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });

  it("fallback manual: onManualChange refleja el texto libre tecleado", async () => {
    const user = userEvent.setup();
    const onManual = vi.fn();
    function Manual() {
      return (
        <ClientCombobox
          id="cb"
          value=""
          onManualChange={onManual}
          onSelect={() => {}}
          ariaLabel="Cliente"
        />
      );
    }
    render(<Manual />);
    await user.type(screen.getByRole("combobox"), "X");
    expect(onManual).toHaveBeenCalledWith("X");
  });

  it("sin coincidencias → muestra mensaje (no rompe el alta)", async () => {
    searchMock.mockResolvedValue({ hits: [] });
    const user = userEvent.setup();
    render(<Harness onSelect={() => {}} />);

    await user.type(screen.getByRole("combobox"), "zz");
    expect(await screen.findByText(/Sin coincidencias/i)).toBeInTheDocument();
  });
});
