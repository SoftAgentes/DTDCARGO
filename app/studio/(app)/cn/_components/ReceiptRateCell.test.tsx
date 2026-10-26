/**
 * SDD-0571 · La columna «Tarifa» del Almacén CN: los tres estados (no
 * disponible, sin tarifa, con tarifa) y el aviso de CBM cambiado.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReceiptRateCell } from "./ReceiptRateCell";
import type { RateSnapshot } from "@/lib/studio/rate-snapshots/types";

vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));

afterEach(cleanup);

const snapshot = {
  id: "s1", receipt_id: "r1", source: "lista", rate_origin: "descuento", per_cbm: 765, min_charge: 50,
  cbm: 2, weight_kg: 900, amount_to_invoice: 1530, excess_weight_kg: 0, included_kg_per_cbm: 500,
} as RateSnapshot;

describe("ReceiptRateCell", () => {
  it("sin la 0496: «No disponible», sin botón", () => {
    render(<ReceiptRateCell snapshot={null} disponible={false} currentCbm={2} receiptCode="WR-1" onOpen={() => {}} />);
    expect(screen.getByText("warehouse_cn.rate.cell.unavailable")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("sin tarifa: «Sin tarifa» y el botón abre el cajón para congelar", async () => {
    const onOpen = vi.fn();
    render(<ReceiptRateCell snapshot={null} disponible currentCbm={2} receiptCode="WR-1" onOpen={onOpen} />);
    expect(screen.getByText("warehouse_cn.rate.cell.none")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /warehouse_cn\.rate\.cell\.freeze_aria/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("con tarifa: $/m³, a facturar y la fuente; sin aviso si el CBM no cambió", () => {
    render(<ReceiptRateCell snapshot={snapshot} disponible currentCbm={2} receiptCode="WR-1" onOpen={() => {}} />);
    expect(screen.getByText(/warehouse_cn\.rate\.cell\.per_cbm .*765\.00/)).toBeTruthy();
    expect(screen.getByText("$1,530.00")).toBeTruthy();
    expect(screen.getByText("warehouse_cn.rate.source.lista")).toBeTruthy();
    expect(screen.queryByText("warehouse_cn.rate.cell.cbm_changed")).toBeNull();
    expect(screen.getByRole("button", { name: /warehouse_cn\.rate\.cell\.open_aria/ })).toBeTruthy();
  });

  it("con tarifa y el CBM corregido después: avisa", () => {
    render(<ReceiptRateCell snapshot={snapshot} disponible currentCbm={2.4} receiptCode="WR-1" onOpen={() => {}} />);
    expect(screen.getByText("warehouse_cn.rate.cell.cbm_changed")).toBeTruthy();
  });
});
