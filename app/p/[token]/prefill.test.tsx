/**
 * SDD-0473 · El enlace del proveedor llega precargado con lo que cargó el cliente.
 *
 * Es la razón de ser del enlace: el proveedor no transcribe, corrige y confirma.
 * Pero la precarga NO puede pisar su trabajo — si ya empezó a llenar en este
 * dispositivo, su borrador manda. Esa es la única regla dura de este archivo.
 *
 * Vive aparte de `supplier-flow.test.tsx` a propósito: ese archivo monta el
 * formulario completo 23 veces y tarda ~108 s, lo bastante cerca del límite de
 * 20 s por prueba como para que sumarle montajes empujara a las suyas al timeout
 * cuando la suite corre en paralelo. Separado, cada uno corre en su worker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProviderShareClient } from "./ProviderShareClient";
import { resolveBrand } from "@/lib/shared/brand-context";
import { packlistDraftKey } from "@/lib/studio/prealertas/packlist-draft";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const props = {
  token: "prefill-test-only",
  code: "DTD-0000-1-1",
  markbox: "DTD-0000",
  supplierName: "Proveedor",
  supplierWechat: "wechat",
  brand: resolveBrand(null),
  labels: [{ code: "DTD-0000-1-1", boxN: 1, totalBoxes: 1, boxCode: "DTD-B-000001" }],
};

const language = (value: string) =>
  fireEvent.change(screen.getByRole("combobox", { name: "语言 / Idioma / Language" }), {
    target: { value },
  });
const step = (n: number) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${n} `) }));
const empresa = () => screen.getByRole("textbox", { name: "Empresa / Persona" });

/** Lo que el cliente ya cargó: dos productos en las mismas 5 cajas. */
const prefill = {
  company: "义乌供应商",
  wechat: "wechat-del-cliente",
  currency: "USD" as const,
  rows: [
    { zh: "杯子", es: "Vasos", ctns: "5", perctn: "10", unit: "2", wkg: "3", cbm: "0.5" },
    { zh: "盖子", es: "Tapas", same: true, qtyDirect: "8", unit: "4" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "print").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("precarga del documento en el enlace del proveedor (SDD-0473)", () => {
  it("llega con los productos del cliente, sin que el proveedor transcriba nada", async () => {
    render(<ProviderShareClient {...props} prefill={prefill} />);
    language("es");
    await waitFor(() => expect(empresa()).toHaveValue("义乌供应商"));
    step(2);
    expect(await screen.findByDisplayValue("Vasos")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tapas")).toBeInTheDocument();
  });

  it("NO pisa el borrador que el proveedor ya tenía en este dispositivo", async () => {
    localStorage.setItem(
      packlistDraftKey(props.token),
      JSON.stringify({
        company: "Lo que yo escribí",
        rows: [{ es: "Mi producto", ctns: "1", perctn: "1", unit: "1" }],
      }),
    );
    render(<ProviderShareClient {...props} prefill={prefill} />);
    language("es");
    // Su trabajo manda: ni la empresa ni los productos del cliente lo reemplazan.
    await waitFor(() => expect(empresa()).toHaveValue("Lo que yo escribí"));
    step(2);
    expect(await screen.findByDisplayValue("Mi producto")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Vasos")).not.toBeInTheDocument();
  });

  it("sin documento del cliente, el formulario abre como siempre", async () => {
    render(<ProviderShareClient {...props} />);
    language("es");
    await waitFor(() => expect(empresa()).toHaveValue("Proveedor"));
  });
});
