/**
 * SDD-0473 · Contratos del cotizador público.
 *
 * Acá no se prueba que la pantalla "funcione": se fijan las fronteras que, si
 * alguien las cruza sin darse cuenta, no se ven rotas — se ven bien y mienten.
 *
 *  - Que abra un workspace ANÓNIMO. El día que alguien le pase `openParams`,
 *    el servidor exigiría sesión y el visitante sin cuenta quedaría fuera.
 *  - Que no haya precio antes de que haya documento, ni con las correcciones
 *    sin guardar: el servidor cotiza sobre lo guardado.
 *  - Que un fallo del servidor no deje un número en pantalla.
 *  - Que el plazo de borrado salga del `expiresAt` del servidor y no de un "+24 h"
 *    calculado acá.
 *
 * El RPC devuelve un recibo; la puerta S2 añade el workspace autoritativo a save.
 * La aplicación de importación conserva además la relectura del documento.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EnvioCotizacion } from "@/lib/calculadora";
import { emptyDocumentDraft, type DocumentDraft } from "@/lib/shared/document-import";
import type { DocumentEstimate } from "@/components/document-import/DocumentCalculator";
import {
  DocumentRequestError,
  type DocumentClient,
  type DocumentWorkspace,
} from "@/components/document-import/document-client";
import { CotizadorClient } from "./CotizadorClient";

afterEach(cleanup);

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const EXPIRA = "2026-09-18T15:00:00.000Z";

/** Dos productos en las MISMAS 5 cajas: 50 × 2 + 8 × 4 = 132 USD de mercancía. */
function extraido(): DocumentDraft {
  const draft = emptyDocumentDraft();
  draft.currency = "USD"; draft.transportDeclarations = { battery: false, specialCargo: false };
  draft.products = [
    { id: "p1", name: "Vasos", nameZh: "", code: "VAS-01", brand: "", material: "", quantity: 50, unitPrice: 2, currency: "USD" },
    { id: "p2", name: "Tapas", nameZh: "", code: "TAP-02", brand: "", material: "", quantity: 8, unitPrice: 4, currency: "USD" },
  ];
  draft.groups = [
    {
      id: "g1",
      label: "",
      cartons: 5,
      grossWeightKg: 15,
      cbm: 2.5,
      items: [
        { productId: "p1", quantity: 50 },
        { productId: "p2", quantity: 8 },
      ],
    },
  ];
  return draft;
}

function workspace(draft: DocumentDraft, revision: number, expiresAt: string | null): DocumentWorkspace {
  return { id: WORKSPACE_ID, revision, draft, confirmedRevision: null, expiresAt };
}

function cotizacion(): EnvioCotizacion {
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
  };
}

function estimado(): DocumentEstimate {
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
    documentRevisions: [{ workspaceId: WORKSPACE_ID, revision: 1, confirmed: false }],
    generatedAt: "2026-09-17T12:00:00.000Z",
    notice: "Estimado sujeto a confirmación de tarifa por DTD.",
  };
}

type Guion = {
  expiresAt?: string | null;
  abrirFalla?: DocumentRequestError;
  estimarFalla?: DocumentRequestError;
  guardarFalla?: DocumentRequestError;
};

function cliente(guion: Guion = {}) {
  const calls: { action: string; body?: Record<string, unknown> }[] = [];
  // El workspace sólo trae documento DESPUÉS de aplicar la extracción.
  let aplicado = false;
  const expiresAt = guion.expiresAt === undefined ? EXPIRA : guion.expiresAt;

  const client: DocumentClient = {
    get: vi.fn(async (action: string, params?: Record<string, string>) => {
      calls.push({ action, body: params });
      if (action === "workspace")
        return {
          workspace: aplicado
            ? workspace(extraido(), 1, expiresAt)
            : workspace(emptyDocumentDraft(), 0, expiresAt),
        } as never;
      if (action === "job")
        return { job: { status: "ready", result: extraido(), errorCode: null } } as never;
      if (action === "destinations") return { cities: [{ id: "ccs", label: "Caracas" }] } as never;
      throw new Error("acción GET no esperada: " + action);
    }),
    post: vi.fn(async (action: string, body?: Record<string, unknown>) => {
      calls.push({ action, body });
      if (action === "open") {
        if (guion.abrirFalla) throw guion.abrirFalla;
        return {
          workspace: workspace(emptyDocumentDraft(), 0, expiresAt),
          anonymousToken: "a".repeat(64),
        } as never;
      }
      if (action === "upload")
        return {
          jobId: "job-1",
          status: "uploading",
          uploadUrl: "https://upload.test/x",
          contentType: "application/pdf",
        } as never;
      if (action === "uploaded") return { jobId: "job-1", status: "queued" } as never;
      // `apply` y `save` devuelven el recibo del RPC, nunca el workspace.
      if (action === "apply") {
        aplicado = true;
        return { revision: 1, confirmed: false } as never;
      }
      if (action === "save") {
        if (guion.guardarFalla) throw guion.guardarFalla;
        return { revision: 2, confirmed: false, workspace: workspace(body!.draft as DocumentDraft, 2, expiresAt) } as never;
      }
      if (action === "estimate") {
        if (guion.estimarFalla) throw guion.estimarFalla;
        return { ...estimado(), documentRevisions: (body!.expectedRevisions as {workspaceId:string;revision:number}[]).map(r => ({...r,confirmed:false})) } as never;
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

function archivo(name = "proforma.pdf") {
  const file = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: 1024 });
  return file;
}

function elegir(files: File[]) {
  fireEvent.change(screen.getByLabelText("Elige tus archivos o suéltalos aquí"), {
    target: { files },
  });
}

/** Recorre el camino real hasta tener el documento en la pantalla de revisión. */
async function hastaRevisar(client: DocumentClient) {
  render(<CotizadorClient client={client} pollMs={1} />);
  elegir([archivo()]);
  fireEvent.click(await screen.findByRole("button", { name: "Aplicar al documento" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Revisar documento" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Revisar documento" }));
  await screen.findByRole("heading", { name: "Revisa lo que leímos" });
}

/** Del paso de revisión al estimado, eligiendo destino y pidiendo el cálculo. */
async function calcular(boton: string) {
  fireEvent.click(screen.getByRole("button", { name: boton }));
  // El selector de destino nace deshabilitado hasta que llega el catálogo del
  // servidor: cambiarlo antes no haría nada y el cálculo nunca saldría.
  const destino = await screen.findByLabelText(/Destino en Venezuela/);
  await waitFor(() => expect(destino).toBeEnabled());
  fireEvent.change(destino, { target: { value: "ccs" } });
  const calculo = screen.getByRole("button", { name: "Calcular el transporte" });
  await waitFor(() => expect(calculo).toBeEnabled());
  fireEvent.click(calculo);
}

describe("Cotizador público (SDD-0473)", () => {
  it("el precio usa la revisión y el borrador normalizados por el servidor al guardar", async () => {
    const { client, calls } = cliente();
    const original = vi.mocked(client.post).getMockImplementation()!;
    vi.mocked(client.post).mockImplementation(async (action, body) => {
      if (action !== "save") return original(action, body) as never;
      const d = structuredClone(body!.draft as DocumentDraft); d.groups[0].grossWeightKg = 31;
      return { revision: 8, confirmed: false, workspace: workspace(d, 8, EXPIRA) } as never;
    });
    await hastaRevisar(client);
    fireEvent.change(screen.getByLabelText(/Peso bruto TOTAL \(kg\)/), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Lleva baterías"), { target: { value: "no" } });
    fireEvent.change(screen.getByLabelText("Carga especial o regulada"), { target: { value: "no" } });
    await calcular("Guardar y ver cuánto cuesta");
    await waitFor(() => expect(calls.find(c => c.action === "estimate")?.body).toMatchObject({ expectedRevisions: [{ workspaceId: WORKSPACE_ID, revision: 8 }] }));
    fireEvent.click(screen.getByRole("button", { name: "Volver a revisar el documento" }));
    expect(screen.getByLabelText(/Peso bruto TOTAL \(kg\)/)).toHaveValue("31");
  });
  it("abre un workspace ANÓNIMO: no le manda ninguna compra al servidor", async () => {
    const { client, calls } = cliente();
    render(<CotizadorClient client={client} pollMs={1} />);
    elegir([archivo()]);

    await waitFor(() => expect(calls.some((c) => c.action === "open")).toBe(true));
    // Cuerpo vacío: ni `purchaseCode`, ni `purchaseId`, ni `authenticated`.
    // Cualquiera de los tres haría que el servidor exigiera sesión de portal.
    expect(calls.find((c) => c.action === "open")!.body).toEqual({});
    // Y el token anónimo se guarda: es la única identidad que tiene el visitante.
    expect(client.setAnonymousToken).toHaveBeenCalledWith("a".repeat(64));
  });

  it("no deja cotizar antes de tener documento: abrir el workspace no alcanza", async () => {
    const { client } = cliente();
    render(<CotizadorClient client={client} pollMs={1} />);

    expect(screen.getByRole("button", { name: "3 Precio" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Calcular el transporte" })).not.toBeInTheDocument();

    elegir([archivo()]);
    // El workspace ya está abierto, pero viene vacío: todavía no hay nada que cotizar.
    await waitFor(() => expect(client.post).toHaveBeenCalledWith("upload", expect.anything()));
    expect(screen.getByRole("button", { name: "3 Precio" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Calcular el transporte" })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Aplicar al documento" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "3 Precio" })).toBeEnabled());
  });

  it("un error del servidor no deja un precio en pantalla", async () => {
    const { client } = cliente({
      estimarFalla: new DocumentRequestError(
        422,
        "missing_logistics",
        "Completa el peso bruto y el CBM de todas las compras antes de calcular.",
      ),
    });
    await hastaRevisar(client);
    await calcular("Ver cuánto cuesta");

    await screen.findByText(/Completa el peso bruto y el CBM/);
    expect(screen.queryByText(/USD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/500/)).not.toBeInTheDocument();

    // Y la salida es volver al documento, no reintentar a ciegas.
    fireEvent.click(screen.getByRole("button", { name: "Volver al documento" }));
    expect(await screen.findByRole("heading", { name: "Revisa lo que leímos" })).toBeVisible();
  });

  it("no cotiza con el peso viejo: guarda las correcciones antes de pedir el precio", async () => {
    const { client, calls } = cliente();
    await hastaRevisar(client);

    fireEvent.change(screen.getByLabelText(/Peso bruto TOTAL \(kg\)/), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Lleva baterías"), { target: { value: "no" } });
    fireEvent.change(screen.getByLabelText("Carga especial o regulada"), { target: { value: "no" } });
    await calcular("Guardar y ver cuánto cuesta");

    const guardado = calls.find((c) => c.action === "save");
    expect(guardado).toBeTruthy();
    const cuerpo = guardado!.body as { draft: DocumentDraft; expectedRevision: number };
    expect(cuerpo.draft.groups[0].grossWeightKg).toBe(30);
    expect(cuerpo.expectedRevision).toBe(1);
    // El estimado se pide DESPUÉS del guardado, nunca antes.
    await waitFor(() => expect(calls.some((c) => c.action === "estimate")).toBe(true));
    expect(calls.findIndex((c) => c.action === "save")).toBeLessThan(
      calls.findIndex((c) => c.action === "estimate"),
    );
  });

  it("el recibo de `apply` no deja la pantalla sin documento", async () => {
    const { client, calls } = cliente();
    await hastaRevisar(client);

    // `apply` respondió {revision, confirmed}: sin id y sin borrador. La pantalla
    // relee el workspace en vez de quedarse vacía.
    expect(calls.filter((c) => c.action === "workspace")).toHaveLength(1);
    // El resumen sale del borrador que quedó en pantalla: 2 productos en las
    // mismas 5 cajas, contadas una sola vez.
    expect(screen.getByText("2 productos · 5 cajas · 15 kg · 2.5 m³")).toBeVisible();
  });

  it("muestra la mercancía aparte del flete y no la suma", async () => {
    const { client } = cliente();
    await hastaRevisar(client);
    await calcular("Ver cuánto cuesta");

    expect(await screen.findByText("Mercancía (aparte)")).toBeVisible();
    expect(screen.getByText(/132[.,]00/)).toBeVisible();
    // 500 de flete + 132 de mercancía NO son 632: sumarlos sería un costo de
    // importación falso, sin aranceles.
    expect(screen.queryByText(/632/)).not.toBeInTheDocument();
  });

  it("el aviso de borrado usa la fecha del servidor", async () => {
    const { client } = cliente();
    render(<CotizadorClient client={client} pollMs={1} />);
    elegir([archivo()]);

    const aviso = await screen.findByText(/se borra solo el/i);
    expect(aviso.querySelector("time")).toHaveAttribute("datetime", EXPIRA);
  });

  it("sin fecha del servidor no promete ningún plazo", async () => {
    const { client } = cliente({ expiresAt: null });
    render(<CotizadorClient client={client} pollMs={1} />);
    elegir([archivo()]);

    await waitFor(() => expect(client.post).toHaveBeenCalledWith("upload", expect.anything()));
    expect(screen.queryByText(/se borra solo/i)).not.toBeInTheDocument();
    expect(document.querySelector("time")).toBeNull();
  });

  it("si el servidor dice que no hay servicio, repite SU mensaje y manda al asesor", async () => {
    const { client } = cliente({
      abrirFalla: new DocumentRequestError(
        503,
        "not_configured",
        "La lectura de documentos todavía no está disponible. Puedes completar los datos manualmente.",
      ),
    });
    render(<CotizadorClient client={client} pollMs={1} />);
    elegir([archivo()]);

    await screen.findByText(/todavía no está disponible/);
    expect(screen.queryByText(/USD/)).not.toBeInTheDocument();
    const asesor = screen.getByRole("link", { name: /asesor por WhatsApp/i });
    expect(asesor.getAttribute("href")).toContain("wa.me");
  });

  it("un guardado que falla se VE, esté el visitante en el paso que esté", async () => {
    // El camino real: corriges algo, vuelves al paso 1 a cargar otro archivo, y
    // desde ahí pides el precio. `cotizar` guarda primero, el guardado falla, y
    // el aviso se escribía dentro del bloque del paso 2 — que no se renderiza.
    // El visitante veía que no pasaba nada y no sabía por qué.
    const { client } = cliente({ guardarFalla: new DocumentRequestError(503, "save_failed", "sin guardar") });
    await hastaRevisar(client);

    fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
    fireEvent.click(screen.getByRole("button", { name: "1 Documentos" }));
    await screen.findByLabelText("Elige tus archivos o suéltalos aquí");

    fireEvent.click(screen.getByRole("button", { name: "3 Precio" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos guardar tus correcciones/);
    // Y sin guardar no hay precio: el servidor cotiza sobre lo guardado.
    expect(screen.queryByText("USD 500,00")).not.toBeInTheDocument();
  });
});
