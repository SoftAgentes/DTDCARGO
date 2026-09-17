/**
 * SDD-0473 · Vista local para revisar la importación documental con los ojos.
 *
 * Todo lo de acá es FICTICIO y el transporte está simulado: ninguna petición sale
 * de la máquina y el backend está bloqueado por el servidor del fixture. No
 * acredita producción, datos reales ni autorización.
 *
 * Lo que interesa mirar no es el camino feliz —ese se ve solo— sino los casos que
 * una captura bonita esconde: un documento al que le falta el peso, uno que llegó
 * a medias, dos productos compartiendo las mismas cajas, y un archivo que no se
 * pudo leer. Si alguno de esos muestra un cero donde debería decir "pendiente",
 * el diseño está mintiendo.
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  emptyDocumentDraft,
  type DocumentDraft,
} from "../../../../lib/shared/document-import";
import { DocumentEditor } from "../../../../components/document-import/DocumentEditor";
import { DocumentImportPanel } from "../../../../components/document-import/DocumentImportPanel";
import { CotizadorClient } from "../../../../app/cotizador/CotizadorClient";
import type {
  DocumentClient,
  DocumentLocale,
  DocumentWorkspace,
} from "../../../../components/document-import/document-client";
import "../../../../app/globals.css";

const WORKSPACE: DocumentWorkspace = {
  id: "00000000-0000-4000-8000-0000000004f3",
  revision: 2,
  draft: emptyDocumentDraft(),
  confirmedRevision: null,
  expiresAt: null,
};

type Caso = "completo" | "sin-peso" | "sin-asignar" | "monedas" | "vacio";

/** Dos productos en las MISMAS 5 cajas: 58 uds, USD 132, 15 kg, 2,5 m³. */
function base(): DocumentDraft {
  const d = emptyDocumentDraft();
  d.currency = "USD";
  d.docDate = "2026-09-17";
  d.supplier.company = "示例供应商 · Proveedor de muestra";
  d.supplier.wechat = "demo-wechat";
  d.products = [
    { id: "p1", name: "Vasos", nameZh: "杯子", code: "VAS-01", brand: "", material: "", quantity: 50, unitPrice: 2, currency: "USD", unit: "pcs" },
    { id: "p2", name: "Tapas", nameZh: "盖子", code: "TAP-02", brand: "", material: "", quantity: 8, unitPrice: 4, currency: "USD", unit: "pcs" },
  ];
  d.groups = [
    { id: "g1", label: "A", cartons: 5, grossWeightKg: 15, cbm: 2.5, items: [{ productId: "p1", quantity: 50 }, { productId: "p2", quantity: 8 }] },
  ];
  return d;
}

function caso(kind: Caso): DocumentDraft {
  const d = base();
  if (kind === "completo") return d;
  if (kind === "vacio") return emptyDocumentDraft();
  if (kind === "sin-peso") {
    // Lo que manda un proveedor que sólo pasó la proforma: precios sí, logística no.
    d.groups[0].grossWeightKg = null;
    d.groups[0].cbm = null;
    d.issues = [{ id: "i1", code: "source_conflict", message: "La factura y el packing list difieren en la cantidad de Vasos.", severity: "warning", path: "products.p1.quantity", blocking: true, resolved: false }];
    return d;
  }
  if (kind === "sin-asignar") {
    // Un producto de la factura que nadie dijo en qué caja viaja.
    d.products.push({ id: "p3", name: "Sorbetes", nameZh: "吸管", code: "SOR-03", brand: "", material: "", quantity: 100, unitPrice: 1, currency: "USD", unit: "pcs" });
    return d;
  }
  // Monedas mezcladas: el documento final necesita una sola.
  d.products[1].currency = "RMB";
  return d;
}

/**
 * Un estimado con el mínimo facturable APLICADO, que es el caso que hay que mirar:
 * 2,5 m³ × 168 = 420 de flete base, más 80 de entrega nacional. Si el desglose no
 * suma el total en pantalla, el cliente siente que le cobraron de más.
 */
function estimadoDemo() {
  return {
    kind: "transport_estimate",
    currency: "USD",
    totals: { cbm: 2.5, grossWeightKg: 15, cartons: 5 },
    result: {
      cbm: 2.5, densidadKgM3: 6, sinPeso: false, pesoMaxSinRecargoKg: 0,
      precioBase: 420, recargoExcedente: 0, recargoCiudad: 80, recargoEmbalaje: 0,
      recargoBateria: 0, descuentoSede: 0, ajusteMinimo: 0, total: 500,
      ciudad: { id: "ccs", label: "Caracas" }, embalaje: "estandar",
    },
    input: {},
    rates: { rate: { per_cbm: 168, min_charge: 250, valid_until: null }, params: {} },
    documentRevisions: [{ workspaceId: WORKSPACE.id, revision: 3, confirmed: false }],
    generatedAt: "2026-09-17T12:00:00.000Z",
    notice: "Estimado de transporte sujeto a confirmación de datos y tarifa por DTD. El valor de la mercancía se presenta por separado.",
  };
}

/**
 * Transporte simulado: nada sale de esta máquina.
 *
 * Responde como el servidor de VERDAD, no como conviene a la demo: `apply` y
 * `save` devuelven un RECIBO (`{revision, confirmed}`), no el workspace. Un doble
 * más amable escondía un defecto real —la pantalla se quedaba sin documento al
 * aplicar— hasta que uno honesto lo destapó.
 */
function cliente(escenario: "ok" | "parcial" | "falla"): DocumentClient {
  const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 300));
  let aplicado = false;
  const leido = () => caso(escenario === "parcial" ? "sin-peso" : "completo");
  return {
    get: async (action) => {
      if (action === "capabilities") return espera({ available: true, formats: ["xlsx", "csv", "pdf"], maxBytes: 15 * 1024 * 1024 } as never);
      if (action === "job") {
        if (escenario === "falla") return espera({ job: { status: "failed", result: null, errorCode: "legacy_xls" } } as never);
        return espera({ job: { status: escenario === "parcial" ? "partial" : "ready", result: leido(), errorCode: null } } as never);
      }
      // El borrador fusionado sólo existe del lado del servidor: por eso se relee.
      if (action === "workspace")
        return espera({ workspace: { ...WORKSPACE, revision: aplicado ? 3 : 2, draft: aplicado ? leido() : emptyDocumentDraft() } } as never);
      if (action === "destinations")
        return espera({ cities: [{ id: "ccs", label: "Caracas" }, { id: "vlc", label: "Valencia" }, { id: "mcbo", label: "Maracaibo" }] } as never);
      return espera({} as never);
    },
    post: async (action) => {
      if (action === "open") return espera({ workspace: WORKSPACE, anonymousToken: "demo" } as never);
      if (action === "upload") return espera({ jobId: "job-demo", status: "uploading", uploadUrl: "about:blank", contentType: "application/pdf" } as never);
      if (action === "uploaded") return espera({ jobId: "job-demo", status: "queued" } as never);
      if (action === "apply") { aplicado = true; return espera({ revision: 3, confirmed: false } as never); }
      if (action === "save") return espera({ revision: 4, confirmed: false } as never);
      if (action === "estimate") return espera(estimadoDemo() as never);
      return espera({} as never);
    },
    upload: async () => undefined,
    download: async () => new Blob(),
    setAnonymousToken: () => {},
    id: () => "11111111-1111-4111-8111-" + String(Math.floor(Math.random() * 1e12)).padStart(12, "0"),
  };
}

function Fixture() {
  const [kind, setKind] = useState<Caso>("sin-peso");
  const [locale, setLocale] = useState<DocumentLocale>("es");
  const [escenario, setEscenario] = useState<"ok" | "parcial" | "falla">("ok");
  const [pantalla, setPantalla] = useState<"cotizador" | "editor" | "carga">("cotizador");
  const [ancho, setAncho] = useState<"escritorio" | "375" | "390">("escritorio");
  const [draft, setDraft] = useState<DocumentDraft>(() => caso("sin-peso"));

  const cambiarCaso = (next: Caso) => {
    setKind(next);
    setDraft(caso(next));
  };

  const contenido =
    pantalla === "cotizador" ? (
      // El recorrido COMPLETO del visitante sin cuenta: cargar, revisar, precio.
      <CotizadorClient key={escenario} client={cliente(escenario)} pollMs={400} />
    ) : pantalla === "carga" ? (
      <DocumentImportPanel
        key={escenario}
        workspace={WORKSPACE}
        openParams={{ purchaseCode: "DTD-DEMO-1-1" }}
        onWorkspace={() => {}}
        onManual={() => {}}
        onReview={() => {}}
        locale={locale}
        client={cliente(escenario)}
        pollMs={400}
      />
    ) : (
      <DocumentEditor
        draft={draft}
        onChange={setDraft}
        locale={locale}
        shippingMark="DTD-DEMO"
        revision={2}
      />
    );

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-paper)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: 12, background: "var(--color-white)", borderBottom: "1px solid var(--color-grey-200)" }}>
        <strong style={{ fontSize: 13 }}>DEMO · datos ficticios · transporte simulado</strong>
        <label style={{ fontSize: 13 }}>
          Pantalla{" "}
          <select value={pantalla} onChange={(e) => setPantalla(e.target.value as typeof pantalla)}>
            <option value="cotizador">Cotizador completo (3 pasos)</option>
            <option value="editor">Revisar documento</option>
            <option value="carga">Cargar archivos</option>
          </select>
        </label>
        {pantalla === "editor" && (
          <label style={{ fontSize: 13 }}>
            Caso{" "}
            <select value={kind} onChange={(e) => cambiarCaso(e.target.value as Caso)}>
              <option value="sin-peso">Sin peso ni CBM (+ conflicto)</option>
              <option value="completo">Completo</option>
              <option value="sin-asignar">Producto sin caja asignada</option>
              <option value="monedas">Monedas mezcladas</option>
              <option value="vacio">Documento vacío</option>
            </select>
          </label>
        )}
        {pantalla !== "editor" && (
          <label style={{ fontSize: 13 }}>
            Lectura{" "}
            <select value={escenario} onChange={(e) => setEscenario(e.target.value as typeof escenario)}>
              <option value="ok">Se leyó todo</option>
              <option value="parcial">Se leyó a medias</option>
              <option value="falla">No se pudo leer</option>
            </select>
          </label>
        )}
        <label style={{ fontSize: 13 }}>
          Idioma{" "}
          <select value={locale} onChange={(e) => setLocale(e.target.value as DocumentLocale)}>
            <option value="es">Español</option>
            <option value="zh">简体中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Pantalla{" "}
          <select value={ancho} onChange={(e) => setAncho(e.target.value as typeof ancho)}>
            <option value="escritorio">Escritorio</option>
            <option value="375">375 px</option>
            <option value="390">390 px</option>
          </select>
        </label>
        <button type="button" onClick={() => cambiarCaso(kind)}>
          Restablecer ejemplo
        </button>
      </div>

      {ancho === "escritorio" ? (
        <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>{contenido}</div>
      ) : (
        <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
          <div style={{ width: Number(ancho), border: "1px solid var(--color-grey-300)", borderRadius: 12, overflow: "auto", maxHeight: "80vh", padding: 16, background: "var(--color-paper)" }}>
            {contenido}
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
