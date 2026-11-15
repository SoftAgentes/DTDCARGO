/**
 * SDD-0603 · menores del Studio: el banner de alertas de consolidado.
 *
 * La franja (`role="status"`) lleva solo la frase fija. La lista de
 * contenedores va fuera: si estuviera dentro, al cerrar una alerta el lector
 * releería todas las que quedan (misma corrección que `SupplierDrawer`, #547).
 * Y ningún botón del banner va en vino: el primario de la pantalla es
 * «Nuevo gasto».
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const TEXTOS: Record<string, string> = {
  "expenses.alert.banner_title_one": "1 contenedor esperando gastos",
  "expenses.alert.banner_title_many": "{count} contenedores esperando gastos",
  "expenses.alert.banner_sub": "Ya están consolidados y no tienen gastos cargados.",
  "expenses.alert.load_btn": "Cargar gasto",
  "expenses.alert.close_btn": "Marcar cargado",
  "expenses.alert.closing": "Cerrando…",
  "expenses.alert.no_destination": "sin destino",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/studio/gastos",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/lib/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n")>()),
  useT: () => (key: string, vars?: Record<string, unknown>) =>
    (TEXTOS[key] ?? key).replace(/\{(\w+)\}/g, (_m, k: string) => String(vars?.[k] ?? "")),
  useLocale: () => "es",
}));
vi.mock("../actions", () => ({
  resolveExpenseAlertAction: vi.fn(async () => ({ ok: true })),
  exportExpensesCsvAction: vi.fn(),
}));
vi.mock("./ExpenseDrawer", () => ({ ExpenseDrawer: () => null }));
vi.mock("./ExpenseRowActions", () => ({ ExpenseRowActions: () => null }));

import { AlertBanner } from "./GastosClient";

afterEach(cleanup);

const ALERTAS = [
  { id: "a1", shipment_id: "s1", shipment_code: "S-2026-0001", destination: "Valencia", created_at: "2026-11-01" },
  { id: "a2", shipment_id: "s2", shipment_code: "S-2026-0002", destination: null, created_at: "2026-11-02" },
];

describe("AlertBanner de Gastos", () => {
  it("la franja lleva solo la frase fija; la lista queda fuera de toda región viva", () => {
    render(<AlertBanner alerts={ALERTAS} onLoad={vi.fn()} />);

    const franja = screen.getByRole("status");
    expect(franja).toHaveAttribute("data-tono", "atencion");
    expect(franja).toHaveTextContent("2 contenedores esperando gastos");
    expect(franja).toHaveTextContent("Ya están consolidados y no tienen gastos cargados.");
    expect(franja).not.toHaveTextContent("S-2026-0001");
    expect(within(franja).queryByRole("button")).toBeNull();

    const lista = screen.getByRole("list");
    expect(lista.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    const filas = screen.getAllByRole("listitem");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("S-2026-0001");
    expect(filas[0]).toHaveTextContent("Valencia");
    expect(filas[1]).toHaveTextContent("sin destino");
  });

  it("con una sola alerta usa el título en singular", () => {
    render(<AlertBanner alerts={ALERTAS.slice(0, 1)} onLoad={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 contenedor esperando gastos");
  });

  it("los botones del banner son secundarios: el vino queda para «Nuevo gasto»", () => {
    render(<AlertBanner alerts={ALERTAS} onLoad={vi.fn()} />);
    const botones = screen.getAllByRole("button");
    expect(botones).toHaveLength(4);
    for (const boton of botones) {
      expect(boton).toHaveClass("studio-btn", "studio-btn-ghost", "studio-btn-xs");
      expect(boton.className).not.toMatch(/studio-btn-(?:primary|dark)/);
    }
  });

  it("«Cargar gasto» abre el alta con el embarque de su fila", async () => {
    const onLoad = vi.fn();
    render(<AlertBanner alerts={ALERTAS} onLoad={onLoad} />);
    const fila = screen.getAllByRole("listitem")[1];
    await userEvent.click(within(fila).getByRole("button", { name: "Cargar gasto" }));
    expect(onLoad).toHaveBeenCalledWith("s2");
  });
});
