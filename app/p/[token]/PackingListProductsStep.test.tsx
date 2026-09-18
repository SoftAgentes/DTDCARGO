import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProviderShareClient } from "./ProviderShareClient";
import { resolveBrand } from "@/lib/shared/brand-context";
import { computeTotals } from "@/lib/studio/prealertas/packlist-form";
import { packlistDraftKey, packlistHistoryKey } from "@/lib/studio/prealertas/packlist-draft";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const props = { token: "product-lines-only", code: "DTD-DEMO-1-1", markbox: "DTD-DEMO", supplierName: "", supplierWechat: "", brand: resolveBrand(null), labels: [] };
const language = (value: string) => fireEvent.change(screen.getByRole("combobox", { name: "语言 / Idioma / Language" }), { target: { value } });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const savedRows = () => JSON.parse(localStorage.getItem(packlistDraftKey(props.token)) || "{}").rows;
const group = (index = 1) => screen.getByRole("region", { name: `Grupo de cajas ${index}` });
const editor = () => screen.getByRole("region", { name: "Editor del producto" });
// SDD-0486: cada consulta se acota a su región. La página monta también una copia
// imprimible oculta (`.pl-print-only`, unos 300 nodos). getByRole nunca la devuelve,
// pero antes de descartarla calcula el nombre accesible de cada candidato, y jsdom
// rehace la cascada CSS de cada nodo después de cada render. En toda la página, una
// consulta costaba de 150 a 400 ms, y más de 1 s con dos grupos. Dentro de su región
// cuesta decenas de ms. Las aserciones negativas siguen sobre toda la página.
const step = (n: number) => fireEvent.click(within(screen.getByRole("navigation", { name: "Pasos del documento" })).getByRole("button", { name: new RegExp(`^${n} `) }));
const inGroup = (name: string | RegExp, index = 1) => within(group(index)).getByRole("button", { name });
const field = (name: string | RegExp, value: string, index = 1) => fireEvent.change(within(group(index)).getByRole("textbox", { name }), { target: { value } });
const product = (name: string | RegExp) => within(editor()).getByRole("textbox", { name });
const save = () => fireEvent.click(within(editor()).getByRole("button", { name: "Guardar producto" }));
const mixed = [{ zh: "杯子", es: "Vasos", ctns: "5", perctn: "10", unit: "2", wkg: "3", cbm: "0.5" }, { zh: "盖子", es: "Tapas", same: true, qtyDirect: "8", unit: "4", hs: "Plástico", carton: "C1-C5" }];
async function start(request = vi.fn()) {
  render(<ProviderShareClient {...props} request={request}/>);
  language("es"); await waitFor(() => expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toBeInTheDocument());
  step(2); return request;
}
function base() {
  field("Cajas · 1", "5"); field("kg/caja · 1", "3"); field("m³/caja · 1", "0,5");
  field("Nombre del producto · 1", "Vasos"); field("Unidades por caja · 1", "10"); field("Precio unitario (USD) · 1", "2");
}
beforeEach(() => { localStorage.clear(); Element.prototype.scrollIntoView = vi.fn(); vi.spyOn(window, "print").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("supplier invoice product lines", () => {
  it("requires explicit acceptance and presents invoice lines using the unchanged mixed-carton model", async () => {
    const request = await start(); base();
    expect(within(editor()).getByText("10 uds./caja × 5 cajas = 50 uds.")).toBeVisible();
    expect(within(group()).queryByRole("list", { name: "Productos del grupo" })).not.toBeInTheDocument();
    save();
    expect(screen.queryByRole("region", { name: "Editor del producto" })).not.toBeInTheDocument();
    const line = within(group()).getByRole("listitem"); expect(line).toHaveTextContent("Vasos"); expect(line).toHaveTextContent("USD 100,00");
    expect(line).not.toHaveTextContent("Producto 1");
    await waitFor(() => expect(inGroup("Editar Vasos")).toHaveFocus());
    fireEvent.click(inGroup("Agregar otro producto"));
    expect(screen.getAllByRole("region", { name: "Editor del producto" })).toHaveLength(1);
    await waitFor(() => expect(product("Nombre del producto · 2")).toHaveFocus());
    expect(inGroup("Editar Vasos")).toBeDisabled();
    field("Nombre del producto · 2", "Tapas"); field("Unidades del grupo · 2", "8"); field("Precio unitario (USD) · 2", "4");
    expect(within(editor()).getByText(/8 uds. en todo el grupo.*No se multiplica por cajas/)).toBeVisible();
    save(); expect(within(group()).getAllByRole("listitem")).toHaveLength(2);
    expect(group().querySelector("footer")).toHaveTextContent("5 cajas· 58 uds.· 15 kg· 2,5 m³· USD 132,00");
    fireEvent.click(inGroup("Agregar otro producto")); field("Nombre del producto · 3", "Cucharas"); field("Unidades del grupo · 3", "12"); field("Precio unitario (USD) · 3", "0,50"); save();
    fireEvent.click(button("Guardar borrador"));
    expect(computeTotals(savedRows()).totals).toEqual({ ctns: 5, qty: 70, amount: 138, weight: 15, cbm: 2.5 });
    expect(savedRows()[1]).toMatchObject({ same: true, qtyDirect: "8" }); expect(savedRows()[2]).toMatchObject({ same: true, qtyDirect: "12" });
    expect(JSON.stringify(savedRows())).not.toMatch(/accepted|editor|isNew/); expect(request).not.toHaveBeenCalled();
  });
  it("reopens only the chosen line, keeps group totals and removes additional products without moving them", async () => {
    localStorage.setItem(packlistDraftKey(props.token), JSON.stringify({ rows: mixed })); await start();
    await waitFor(() => expect(inGroup("Editar Tapas")).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Editor del producto" })).not.toBeInTheDocument();
    fireEvent.click(inGroup("Editar Tapas"));
    expect(screen.queryByRole("textbox", { name: "Nombre del producto · 1" })).not.toBeInTheDocument();
    field("Unidades del grupo · 2", "10"); save();
    expect(group().querySelector("footer")).toHaveTextContent("60 uds."); expect(group().querySelector("footer")).toHaveTextContent("USD 140,00");
    fireEvent.click(inGroup("Quitar Tapas")); fireEvent.click(button("Guardar borrador"));
    expect(savedRows()).toEqual([mixed[0]]);
    expect(computeTotals(savedRows()).totals).toEqual({ ctns: 5, qty: 50, amount: 100, weight: 15, cbm: 2.5 });
  });
  it("preserves live edits and the active editor through language, steps and Excel, then restores the existing draft shape", async () => {
    await start(); base();
    step(3); step(2); expect(product("Nombre del producto · 1")).toHaveValue("Vasos");
    fireEvent.click(button("Usar Excel")); fireEvent.click(button("Volver al formulario"));
    expect(product("Nombre del producto · 1")).toHaveValue("Vasos");
    language("zh"); expect(screen.getByRole("textbox", { name: "中文品名 · 1" })).toHaveValue("");
    fireEvent.click(screen.getByText("品牌及其他资料")); expect(screen.getByRole("textbox", { name: "西文品名（选填） · 1" })).toHaveValue("Vasos");
    language("es"); fireEvent.click(button("Guardar borrador")); const rows = savedRows();
    cleanup(); await start(); await waitFor(() => expect(inGroup("Editar Vasos")).toBeInTheDocument());
    fireEvent.click(inGroup("Editar Vasos")); expect(product("Unidades por caja · 1")).toHaveValue("10");
    fireEvent.click(button("Guardar borrador")); expect(savedRows()).toEqual(rows);
  });
  it("accepts either stored language or brand, never requires unit price/quantity, and announces a missing name accessibly", async () => {
    await start(); save();
    const name = product("Nombre del producto · 1");
    expect(name).toHaveAttribute("aria-invalid", "true"); expect(name).toHaveAccessibleDescription("Escribe el nombre del producto en cualquiera de los idiomas.");
    await waitFor(() => expect(name).toHaveFocus());
    field("Nombre del producto · 1", "Solo nombre"); fireEvent.keyDown(name, { key: "Enter" });
    expect(inGroup("Editar Solo nombre")).toBeInTheDocument();
    fireEvent.click(inGroup("Agregar otro producto")); fireEvent.click(screen.getByText("Marca y más detalles"));
    field("Nombre en chino (opcional) · 2", "杯子"); save(); expect(inGroup("Editar 杯子")).toBeInTheDocument();
  });
  it("keeps all secondary values and unit-price precision in accepted lines and the final payload", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, folio: "DEMO", versionNo: 1 })));
    const rows = [{ ...mixed[0], unit: "0.004", brand: "Marca", code: "ABC", hs: "Cerámica", carton: "C1-C5" }];
    localStorage.setItem(packlistDraftKey(props.token), JSON.stringify({ rows, wechat: "demo-contact" }));
    await start(request); await waitFor(() => expect(inGroup("Editar Vasos")).toBeInTheDocument());
    expect(within(group()).getAllByText("USD 0,004").length).toBeGreaterThan(0);
    fireEvent.click(inGroup("Editar Vasos")); fireEvent.click(screen.getByText("Marca y más detalles"));
    expect(product("Material / HS (opcional) · 1")).toHaveValue("Cerámica"); save();
    step(4); fireEvent.click(button("Enviar documento a DTD")); await screen.findByRole("heading", { name: "Documento enviado" });
    expect(JSON.parse(request.mock.calls[0][1].body).rows).toEqual(rows);
    expect(document.querySelector('.pl-print-only input[value="Cerámica"]')).toBeInTheDocument();
  });
  it("confirms deletion of a base line as its whole group and resets an empty editor after removing the last group", async () => {
    localStorage.setItem(packlistDraftKey(props.token), JSON.stringify({ rows: [{ es: "Anterior", ctns: "1", perctn: "2" }, ...mixed] }));
    await start(); await waitFor(() => expect(inGroup("Quitar Vasos", 2)).toBeInTheDocument());
    fireEvent.click(inGroup("Quitar Vasos", 2));
    expect(screen.getByRole("region", { name: "Confirmar eliminación del grupo" })).toHaveTextContent("todos sus productos");
    fireEvent.click(inGroup("Eliminar grupo completo", 2)); fireEvent.click(button("Guardar borrador"));
    expect(savedRows()).toEqual([{ es: "Anterior", ctns: "1", perctn: "2" }]);
    fireEvent.click(inGroup("Quitar Anterior")); fireEvent.click(inGroup("Eliminar grupo completo"));
    expect(editor()).toBeVisible(); expect(product("Nombre del producto · 1")).toHaveValue("");
  });
  it("returns focus to the group action when cancelling removal before its base product has been accepted", async () => {
    await start();
    fireEvent.click(inGroup("Eliminar grupo"));
    await waitFor(() => expect(inGroup("Eliminar grupo completo")).toHaveFocus());
    fireEvent.click(inGroup("Cancelar"));
    await waitFor(() => expect(inGroup("Eliminar grupo")).toHaveFocus());
    expect(editor()).toBeVisible();
  });
  it("adds another group and isolates its measurements and totals", async () => {
    await start(); base(); save(); fireEvent.click(button("Agregar otro grupo de cajas"));
    field("Cajas · 2", "2", 2); field("kg/caja · 2", "4", 2); field("m³/caja · 2", "0,2", 2); field("Nombre del producto · 2", "Platos", 2); field("Unidades por caja · 2", "3", 2); field("Precio unitario (USD) · 2", "5", 2); save();
    expect(group(2).querySelector("footer")).toHaveTextContent("2 cajas· 6 uds.· 8 kg· 0,4 m³· USD 30,00");
    fireEvent.click(button("Guardar borrador"));
    expect(computeTotals(savedRows()).totals).toEqual({ ctns: 7, qty: 56, amount: 130, weight: 23, cbm: 2.9 });
  });
  it("resets the active product editor when a mixed-carton history version is restored", async () => {
    localStorage.setItem(packlistDraftKey(props.token), JSON.stringify({ rows: [mixed[0], { es: "Platos", ctns: "2", perctn: "3", unit: "5", wkg: "4", cbm: "0,2" }] }));
    localStorage.setItem(packlistHistoryKey(props.token), JSON.stringify([{ t: 1, label: "mixto", data: JSON.stringify({ rows: mixed }) }]));
    await start(); await waitFor(() => expect(inGroup("Editar Platos", 2)).toBeInTheDocument()); fireEvent.click(inGroup("Editar Platos", 2));
    fireEvent.click(button("Historial")); fireEvent.click(button("Restaurar")); step(2);
    expect(inGroup("Editar Tapas")).toBeInTheDocument(); expect(screen.queryByRole("region", { name: "Editor del producto" })).not.toBeInTheDocument();
  });
});
