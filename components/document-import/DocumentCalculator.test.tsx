/**
 * SDD-0473 · Contratos que la calculadora del documento no puede romper.
 *
 * El riesgo de esta pantalla no es que no calcule: es que calcule de más.
 * Que cotice con ceros cuando falta el peso, que deje en pantalla el precio
 * de otro destino, o que sume el flete con el valor de la mercancía y le
 * muestre al cliente un "costo de importación" que no incluye aranceles.
 * Cada prueba de acá fija una de esas fronteras.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import type { EnvioCotizacion } from "@/lib/calculadora";
import { DocumentCalculator, type DocumentEstimate } from "./DocumentCalculator";
import { DocumentRequestError, type DocumentClient } from "./document-client";

afterEach(cleanup);

const IDS = ["00000000-0000-4000-8000-000000000001"];
const WORKSPACES = IDS.map(id => ({ id, revision: 2, confirmedRevision: null, expiresAt: null, draft: { ...emptyDocumentDraft(), transportDeclarations: { battery: false, specialCargo: false } } }));

/** Una cotización con desglose que reconcilia: base + ciudad = total. */
function cotizacion(patch: Partial<EnvioCotizacion> = {}): EnvioCotizacion {
  return {
    cbm: 2.5,
    densidadKgM3: 6,
    sinPeso: false,
    pesoMaxSinRecargoKg: 0,
    precioBase: 420,
    recargoExcedente: 0,
    recargoCiudad: 80,
    recargoEmbalaje: 0,
    recargoBateria: 0,
    descuentoSede: 0,
    ajusteMinimo: 0,
    total: 500,
    ciudad: null,
    embalaje: "estandar",
    ...patch,
  };
}

function estimado(patch: Partial<DocumentEstimate> = {}): DocumentEstimate {
  return {
    kind: "transport_estimate",
    currency: "USD",
    totals: { cbm: 2.5, grossWeightKg: 15, cartons: 5 },
    result: cotizacion(),
    input: {} as DocumentEstimate["input"],
    rates: {
      rate: { per_cbm: 168, min_charge: 250, valid_until: null },
      params: {} as DocumentEstimate["rates"]["params"],
    },
    documentRevisions: [{ workspaceId: IDS[0], revision: 2, confirmed: false }],
    generatedAt: "2026-09-17T12:00:00.000Z",
    notice: "Estimado sujeto a confirmación de tarifa por DTD.",
    ...patch,
  };
}

type Guion = { estimate?: DocumentEstimate; falla?: DocumentRequestError };

function cliente(guion: Guion = {}) {
  const calls: { action: string; body?: Record<string, unknown> }[] = [];
  const client: DocumentClient = {
    get: vi.fn(async (action: string) => {
      calls.push({ action });
      if (action === "destinations")
        return {
          cities: [
            { id: "ccs", label: "Caracas" },
            { id: "mcbo", label: "Maracaibo" },
          ],
        } as never;
      throw new Error("acción GET no esperada: " + action);
    }),
    post: vi.fn(async (action: string, body?: Record<string, unknown>) => {
      calls.push({ action, body });
      if (action === "estimate") {
        if (guion.falla) throw guion.falla;
        return (guion.estimate ?? estimado()) as never;
      }
      throw new Error("acción POST no esperada: " + action);
    }),
    upload: vi.fn(async () => undefined),
    download: vi.fn(async () => new Blob()),
    setAnonymousToken: vi.fn(),
    id: () => "11111111-1111-4111-8111-111111111111",
  };
  return { client, calls };
}

/** Elige el destino y pide el cálculo. Sin destino el botón está deshabilitado. */
async function calcular(ciudad = "ccs") {
  await waitFor(() =>
    expect(screen.getByLabelText("Destino en Venezuela")).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("Destino en Venezuela"), {
    target: { value: ciudad },
  });
  fireEvent.click(screen.getByRole("button", { name: "Calcular el transporte" }));
}

describe("DocumentCalculator (SDD-0473)", () => {
  it("envía revisión explícita y retira un resultado al cambiar la revisión guardada", async () => {
    const { client, calls } = cliente(); const view = render(<DocumentCalculator workspaces={WORKSPACES} client={client}/>);
    await calcular(); expect(await screen.findByText("USD 500,00")).toBeVisible();
    expect(calls.find(c => c.action === "estimate")?.body).toMatchObject({ expectedRevisions: [{ workspaceId: IDS[0], revision: 2 }] });
    view.rerender(<DocumentCalculator workspaces={[{ ...WORKSPACES[0], revision: 3 }]} client={client}/>);
    expect(screen.queryByText("USD 500,00")).not.toBeInTheDocument();
  });
  it.each(["revision", "destination", "selection", "dirty", "unmount"])("ignora la respuesta tardía tras cambiar %s", async mode => {
    let resolve!: (value: DocumentEstimate) => void;
    const pending = new Promise<DocumentEstimate>(done => { resolve = done; });
    const { client } = cliente(); vi.mocked(client.post).mockImplementationOnce(async () => pending as never);
    const view = render(<DocumentCalculator workspaces={WORKSPACES} client={client}/>); await calcular();
    if (mode === "revision") view.rerender(<DocumentCalculator workspaces={[{ ...WORKSPACES[0], revision: 3 }]} client={client}/>);
    if (mode === "destination") fireEvent.change(screen.getByLabelText("Destino en Venezuela"), { target: { value: "mcbo" } });
    if (mode === "selection") view.rerender(<DocumentCalculator workspaces={[{ ...WORKSPACES[0], id: "other-workspace" }]} client={client}/>);
    if (mode === "dirty") view.rerender(<DocumentCalculator workspaces={WORKSPACES} client={client} disabled/>);
    if (mode === "unmount") view.unmount();
    await act(async () => { resolve(estimado()); await pending; });
    expect(screen.queryByText("USD 500,00")).not.toBeInTheDocument();
  });
  it("no transforma pendiente en no ni oculta un sí de otra compra", async () => {
    const { client } = cliente();
    const a = { ...WORKSPACES[0], draft: { ...WORKSPACES[0].draft, transportDeclarations: { battery: true, specialCargo: false } } };
    const b = { ...WORKSPACES[0], id: "other", draft: emptyDocumentDraft() };
    render(<DocumentCalculator workspaces={[a, b]} client={client}/>);
    await waitFor(() => expect(screen.getByLabelText("Destino en Venezuela")).toBeEnabled());
    expect(screen.getByText(/Sí · faltan compras por revisar/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Calcular el transporte" })).toBeDisabled();
    expect(client.post).not.toHaveBeenCalled();
  });
  it("toma el volumen y el peso del documento, sin pedírselos otra vez al cliente", async () => {
    const { client, calls } = cliente();
    render(<DocumentCalculator workspaces={WORKSPACES} client={client} />);
    await calcular();

    // El precio sale del servidor, que corre el MISMO motor que /tarifas.
    expect(await screen.findByText("USD 500,00")).toBeInTheDocument();
    // Y los datos de carga vienen del documento, no de un campo que el cliente llenó.
    expect(screen.getByText("2,5 m³")).toBeInTheDocument();
    expect(screen.getByText("15 kg")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(calls.find((c) => c.action === "estimate")?.body).toMatchObject({
      workspaceIds: IDS,
      cityId: "ccs",
    });
  });

  it("si al documento le falta el peso, devuelve al documento en vez de cotizar en cero", async () => {
    const volver = vi.fn();
    const { client } = cliente({
      falla: new DocumentRequestError(
        422,
        "missing_logistics",
        "Completa el peso bruto y el CBM de todas las compras antes de calcular.",
      ),
    });
    render(
      <DocumentCalculator workspaces={WORKSPACES} client={client} onNeedsDocument={volver} />,
    );
    await calcular();

    expect(await screen.findByRole("alert")).toHaveTextContent(/peso bruto y el CBM/);
    // Cero total en pantalla: un precio sin peso sería mentira, no un estimado.
    expect(screen.queryByText(/^USD /)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver al documento" }));
    expect(volver).toHaveBeenCalledTimes(1);
  });

  it("nombra el mínimo facturable como línea propia cuando aplica", async () => {
    // Carga chica: 0,4 m³ × 168 = 67,20, pero el piso son 250.
    const { client } = cliente({
      estimate: estimado({
        totals: { cbm: 0.4, grossWeightKg: 3, cartons: 1 },
        result: cotizacion({ precioBase: 67.2, recargoCiudad: 0, ajusteMinimo: 182.8, total: 250 }),
      }),
    });
    render(<DocumentCalculator workspaces={WORKSPACES} client={client} />);
    await calcular();

    expect(await screen.findByText("USD 250,00")).toBeInTheDocument();
    // Sin esta línea el desglose no llega al total y el cliente cree que le cobraron de más.
    expect(screen.getByText(/Ajuste al mínimo facturable/)).toBeInTheDocument();
    expect(screen.getByText("USD 182,80")).toBeInTheDocument();
  });

  it("muestra la mercancía al lado del flete, pero JAMÁS los suma", async () => {
    const { client } = cliente();
    render(
      <DocumentCalculator
        workspaces={WORKSPACES}
        client={client}
        merchandise={{ amount: 1200, currency: "USD" }}
      />,
    );
    await calcular();

    expect(await screen.findByText("USD 500,00")).toBeInTheDocument();
    expect(screen.getByText("USD 1.200,00")).toBeInTheDocument();
    // 500 + 1200 = 1700 no existe: sumarlos daría un "costo de importar" sin aranceles.
    expect(screen.queryByText(/1\.700/)).not.toBeInTheDocument();
    expect(screen.getByText(/no se suman/)).toBeInTheDocument();
  });

  it("cambiar el destino borra el estimado anterior en vez de dejarlo en pantalla", async () => {
    const { client } = cliente();
    render(<DocumentCalculator workspaces={WORKSPACES} client={client} />);
    await calcular("ccs");
    expect(await screen.findByText("USD 500,00")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Destino en Venezuela"), {
      target: { value: "mcbo" },
    });
    // El precio de Caracas no puede quedar colgado bajo el rótulo de Maracaibo.
    await waitFor(() => expect(screen.queryByText("USD 500,00")).not.toBeInTheDocument());
  });

  it("sin cajas declaradas dice 'Sin declarar', no cero", async () => {
    const { client } = cliente({
      estimate: estimado({ totals: { cbm: 2.5, grossWeightKg: 15, cartons: null } }),
    });
    render(<DocumentCalculator workspaces={WORKSPACES} client={client} />);
    await calcular();

    expect(await screen.findByText("Sin declarar")).toBeInTheDocument();
    expect(screen.queryByText(/0 cajas/)).not.toBeInTheDocument();
  });

  it("una alerta del motor reemplaza el desglose: no hay precio que mostrar", async () => {
    const { client } = cliente({
      estimate: estimado({
        result: cotizacion({
          alerta: { tipo: "ciudad_sin_cobertura", mensaje: "No llegamos hasta ese destino." },
          cercana: { label: "Valencia", ventaCbm: 40 },
        }),
      }),
    });
    render(<DocumentCalculator workspaces={WORKSPACES} client={client} />);
    await calcular();

    expect(await screen.findByText("No llegamos hasta ese destino.")).toBeInTheDocument();
    expect(screen.getByText("Valencia")).toBeInTheDocument();
    expect(screen.queryByText("USD 500,00")).not.toBeInTheDocument();
  });
});
