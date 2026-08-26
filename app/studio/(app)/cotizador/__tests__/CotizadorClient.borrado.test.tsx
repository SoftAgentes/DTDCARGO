/**
 * SDD-0300 — el borrado de un estimado, desde el listado.
 *
 * Lo que se prueba acá es el CABLEADO, que es justo lo que faltaba: la acción
 * existía desde SDD-0011 pero vivía dentro del drawer de edición y no había
 * forma de llegar a ella sin pasar por "Editar" (sólo visible en `draft`).
 *
 * Lo que NO se prueba acá: posicionamiento del panel y objetivo táctil — jsdom
 * no hace layout. Eso vive en el navegador; ver la sección de verificación de
 * la spec.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `vi.mock` se iza al tope del archivo, así que sus dobles no pueden ser
 *  variables de módulo normales: van por `vi.hoisted`. */
const { refresh, softDeleteQuote } = vi.hoisted(() => ({
  refresh: vi.fn(),
  softDeleteQuote: vi.fn<() => Promise<{ ok?: boolean; error?: string }>>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/studio/cotizador",
  useSearchParams: () => new URLSearchParams(""),
}));
// El drawer arrastra el árbol de server actions; acá no se ejercita.
vi.mock("../_components/QuoteDrawer", () => ({ QuoteDrawer: () => null }));
vi.mock("../actions", () => ({ softDeleteQuote }));

import { CotizadorClient } from "../_components/CotizadorClient";
import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";
import type { Quote } from "@/lib/studio/quote-types";
import type { QuoteFilters } from "@/lib/studio/quote-queries";

const FILTROS: QuoteFilters = { status: "all", source: "all" };

function mkQuote(over: Partial<Quote> = {}): Quote {
  return {
    id: "q-1",
    tenant_id: "t-1",
    quote_code: "EST-2026-0002",
    client_markbox: null,
    client_name: "",
    service: "consolidado_lcl",
    origin: "Yiwu, CN",
    destination: "Valencia, VE",
    cbm: 2,
    weight_kg: null,
    boxes: null,
    packaging: "estandar",
    rate_per_cbm: null,
    flat_rate: null,
    rate_used_id: null,
    subtotal_usd: 1600,
    packaging_cost: 0,
    total_usd: 1600,
    status: "draft",
    valid_until: "2026-07-08",
    sent_at: null,
    accepted_at: null,
    converted_to_shipment_id: null,
    sales_order_id: null,
    notes: null,
    prospect_name: "Prueba Vieja",
    prospect_email: null,
    prospect_whatsapp: null,
    nota: null,
    source: "web",
    created_at: "2026-06-08T10:00:00.000Z",
    updated_at: "2026-06-08T10:00:00.000Z",
    deleted_at: null,
    ...over,
  };
}

function pintar(quotes: Quote[]) {
  return render(
    <ToastProvider>
      <CotizadorClient quotes={quotes} filters={FILTROS} />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  softDeleteQuote.mockResolvedValue({ ok: true });
});

describe("SDD-0300 · borrar un estimado desde el listado", () => {
  it("cada fila expone su menú de acciones sin entrar al detalle", () => {
    pintar([mkQuote()]);
    expect(
      screen.getByRole("button", { name: "Acciones de EST-2026-0002" }),
    ).toBeInTheDocument();
  });

  it("un estimado sin convertir se elimina: confirma y llama a la acción", async () => {
    const user = userEvent.setup();
    pintar([mkQuote()]);

    await user.click(
      screen.getByRole("button", { name: "Acciones de EST-2026-0002" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Eliminar/ }));

    // El diálogo nombra el estimado y dice la consecuencia real.
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("EST-2026-0002");
    expect(dialogo).toHaveTextContent(/portal del cliente/i);

    await user.click(
      within(dialogo).getByRole("button", { name: "Eliminar" }),
    );

    await waitFor(() => expect(softDeleteQuote).toHaveBeenCalledWith("q-1"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("un estimado ya convertido a embarque NO se puede eliminar, y dice por qué", async () => {
    const user = userEvent.setup();
    pintar([mkQuote({ converted_to_shipment_id: "shp-1" })]);

    await user.click(
      screen.getByRole("button", { name: "Acciones de EST-2026-0002" }),
    );
    const opcion = await screen.findByRole("menuitem", { name: /Eliminar/ });
    expect(opcion).toHaveAttribute("aria-disabled", "true");
    expect(opcion).toHaveTextContent(/ya se convirtió en un embarque/i);

    await user.click(opcion);
    expect(softDeleteQuote).not.toHaveBeenCalled();
  });

  it("cancelar no borra nada", async () => {
    const user = userEvent.setup();
    pintar([mkQuote()]);

    await user.click(
      screen.getByRole("button", { name: "Acciones de EST-2026-0002" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /Eliminar/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(softDeleteQuote).not.toHaveBeenCalled();
  });
});
