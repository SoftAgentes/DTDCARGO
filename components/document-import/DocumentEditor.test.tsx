/**
 * SDD-0473 · El editor donde el cliente revisa lo que salió de sus documentos.
 *
 * Lo que se fija acá no es que el formulario "funcione", sino que no mienta:
 * un dato que el documento no traía tiene que verse como pendiente, las cajas
 * compartidas por dos productos se cuentan una sola vez, y las incidencias se
 * pueden marcar Y desmarcar — un aviso que desaparece sin vuelta atrás es peor
 * que no tenerlo.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyDocumentDraft, type DocumentDraft } from "@/lib/shared/document-import";
import { DocumentEditor } from "./DocumentEditor";

afterEach(cleanup);

/** Dos productos en las MISMAS 5 cajas: 58 unidades, USD 132, 15 kg, 2,5 m³. */
function mixto(): DocumentDraft {
  const d = emptyDocumentDraft();
  d.currency = "USD";
  d.supplier.company = "Proveedor";
  d.supplier.wechat = "wechat-demo";
  d.products = [
    { id: "p1", name: "Vasos", nameZh: "杯子", code: "VAS-01", brand: "", material: "", quantity: 50, unitPrice: 2, currency: "USD", unit: "pcs" },
    { id: "p2", name: "Tapas", nameZh: "盖子", code: "TAP-02", brand: "", material: "", quantity: 8, unitPrice: 4, currency: "USD", unit: "pcs" },
  ];
  d.groups = [
    { id: "g1", label: "", cartons: 5, grossWeightKg: 15, cbm: 2.5, items: [{ productId: "p1", quantity: 50 }, { productId: "p2", quantity: 8 }] },
  ];
  return d;
}

const totales = () => screen.getAllByLabelText("Totales")[0];

/** El editor es controlado: sin un padre que reinyecte el draft, editar no se ve. */
function Controlado({ inicial, locale = "es" as const }: { inicial: DocumentDraft; locale?: "es" | "zh" | "en" }) {
  const [draft, setDraft] = useState(inicial);
  return <DocumentEditor draft={draft} onChange={setDraft} locale={locale} />;
}

describe("DocumentEditor (SDD-0473)", () => {
  it("permite recorrer toda la evidencia y distingue origen seleccionado de alternativa", () => {
    const d = mixto(); d.sources = [{id:"s1",kind:"invoice",fileName:"synthetic.xlsx",locations:Array.from({length:41},(_,i)=>({path:"products.p1.name",sheet:"Datos",cell:`A${i+1}`,page:null,evidenceId:`e${i}`,observedValue:i===40?"Última alternativa":"Vasos"}))}];
    d.fieldDecisions = [{path:"products.p1.name",origin:"source",references:[{sourceId:"s1",evidenceId:"e0"}]}];
    render(<DocumentEditor draft={d}/>);
    fireEvent.click(screen.getByText("Fuentes extraídas · por revisar"));
    expect(screen.getByText(/Fuente seleccionada/)).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:"Siguientes referencias"}));
    expect(screen.getByText("Última alternativa")).toBeVisible();
    expect(screen.getByRole("button",{name:"Siguientes referencias"})).toBeDisabled();
  });
  it("edita neto separado y vuelve a pedir las declaraciones cuando cambia la mercancía", () => {
    const d = mixto(); d.groups[0].netWeightKg = 12;
    render(<Controlado inicial={d}/>);
    const battery = screen.getByRole("combobox", { name: "Lleva baterías" });
    const regulated = screen.getByRole("combobox", { name: "Carga especial o regulada" });
    expect(battery).toHaveValue(""); expect(regulated).toHaveValue("");
    fireEvent.change(battery, { target: { value: "yes" } }); fireEvent.change(regulated, { target: { value: "no" } });
    expect(battery).toHaveValue("yes"); expect(regulated).toHaveValue("no");
    fireEvent.change(screen.getByRole("textbox", { name: "Peso neto TOTAL (kg)" }), { target: { value: "11" } });
    expect(screen.getByRole("textbox", { name: "Peso bruto TOTAL (kg)" })).toHaveValue("15");
    expect(screen.getByRole("textbox", { name: "Peso neto TOTAL (kg)" })).toHaveValue("11");
    expect(battery).toHaveValue(""); expect(regulated).toHaveValue("");
  });
  it("permite escribir CBM decimal progresivo y peso con coma sin borrar el separador",()=>{
    render(<Controlado inicial={mixto()}/>);
    const cbm=screen.getByRole("textbox",{name:"CBM TOTAL (m³)"});
    fireEvent.change(cbm,{target:{value:"0"}});fireEvent.change(cbm,{target:{value:"0."}});expect(cbm).toHaveValue("0.");fireEvent.change(cbm,{target:{value:"0.6"}});expect(cbm).toHaveValue("0.6");
    const weight=screen.getByRole("textbox",{name:"Peso bruto TOTAL (kg)"});
    fireEvent.change(weight,{target:{value:"120,"}});expect(weight).toHaveValue("120,");fireEvent.change(weight,{target:{value:"120,5"}});expect(weight).toHaveValue("120,5");
    expect(within(totales()).getByText("120,5 kg")).toBeVisible();
  });
  it("el formato estándar reemplaza campos guiados y conserva edición al volver desde la línea",()=>{
    render(<Controlado inicial={mixto()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Formato estándar"}));
    expect(screen.queryByRole("textbox",{name:"Empresa"})).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button",{name:"Editar Vasos"})[0]);
    const name=screen.getByRole("textbox",{name:"Producto"});expect(name).toHaveValue("Vasos");
    fireEvent.change(name,{target:{value:"Vasos corregidos"}});fireEvent.click(screen.getByRole("button",{name:"Guardar producto"}));
    fireEvent.click(screen.getByRole("button",{name:"Formato estándar"}));expect(screen.getAllByText("Vasos corregidos")[0]).toBeVisible();
  });
  it("cuenta las cajas, el peso y el volumen una sola vez aunque dos productos las compartan", () => {
    render(<DocumentEditor draft={mixto()} locale="es" />);
    const t = totales();
    // 5 cajas, no 10. 15 kg, no 30. 2,5 m³, no 5.
    expect(within(t).getByText("5")).toBeVisible();
    expect(within(t).getByText("58")).toBeVisible();
    expect(within(t).getByText("15 kg")).toBeVisible();
    expect(within(t).getByText("2,5 m³")).toBeVisible();
  });

  it("muestra «Pendiente» donde el documento no trajo el dato, nunca un cero", () => {
    const d = mixto();
    d.groups[0].grossWeightKg = null;
    d.groups[0].cbm = null;
    render(<DocumentEditor draft={d} locale="es" />);
    const t = totales();
    expect(within(t).getByText("Pendiente kg")).toBeVisible();
    expect(within(t).queryByText("0 kg")).not.toBeInTheDocument();
  });

  it("deja marcar una incidencia como revisada y volver a desmarcarla", () => {
    const d = mixto();
    d.issues = [{ id: "i1", code: "source_conflict", message: "La factura y el packing list difieren en la cantidad.", severity: "warning", path: "products.p1.quantity", blocking: true, resolved: false }];
    let actual = d;
    const onChange = vi.fn((next: DocumentDraft) => { actual = next; });
    const view = render(<DocumentEditor draft={actual} onChange={onChange} locale="es" />);

    fireEvent.click(screen.getByText("Ver detalle original"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Revisé y corregí el dato/ }));
    expect(actual.issues[0].resolved).toBe(true);

    // Marcada, sale del panel de pendientes… pero NO desaparece sin vuelta atrás.
    view.rerender(<DocumentEditor draft={actual} onChange={onChange} locale="es" />);
    expect(screen.getByText("Ya revisadas · 1")).toBeVisible();
    const casilla = screen.getByRole("checkbox", { name: /Revisé y corregí el dato/ });
    expect(casilla).toBeChecked();

    fireEvent.click(casilla);
    expect(actual.issues[0].resolved).toBe(false);
  });

  it("no deja guardar un producto sin nombre en ninguno de los dos idiomas", () => {
    render(<Controlado inicial={mixto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(screen.getByText("Escribe el nombre del producto.")).toBeVisible();
  });

  it("avisa que quitar un producto también lo quita de las cajas", () => {
    render(<Controlado inicial={mixto()} />);
    fireEvent.click(screen.getByRole("button", { name: "Quitar Vasos" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/elimina también su asignación a las cajas/i);
  });

  it("en modo lectura no ofrece ningún control de edición", () => {
    render(<DocumentEditor draft={mixto()} locale="es" readOnly />);
    expect(screen.queryByRole("button", { name: "Agregar producto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    // Pero el documento sí se ve.
    expect(screen.getByText("Vasos")).toBeVisible();
  });

  it("arranca en chino para el proveedor y conserva los datos al cambiar de idioma", () => {
    const view = render(<DocumentEditor draft={mixto()} locale="zh" />);
    expect(screen.getByRole("button", { name: "引导填写" })).toBeVisible();
    expect(screen.getAllByText("杯子").length).toBeGreaterThan(0);
    view.rerender(<DocumentEditor draft={mixto()} locale="en" />);
    // El dato no se traduce: el nombre en inglés es el que cargó el documento.
    expect(screen.getAllByText("Vasos").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Guided entry" })).toBeVisible();
  });

  it("no se inventa una moneda cuando el documento no la declara", () => {
    const d = mixto();
    d.currency = null;
    d.products = d.products.map((p) => ({ ...p, currency: null }));
    render(<DocumentEditor draft={d} locale="es" />);
    expect(within(totales()).getByText("Pendiente")).toBeVisible();
  });
});
