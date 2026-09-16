import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProviderShareClient } from "@/app/p/[token]/ProviderShareClient";
import { ShareProviderButton } from "@/app/portal/_components/ShareProviderButton";
import { DTD_BRAND } from "@/lib/shared/brand-context";
import { validatePackingListInput } from "@/lib/studio/prealertas/packlist-form";
import { FIXTURE_TOKEN as TOKEN, prepareFixtureOrigin, resetFixtureDraft, type FixtureOrigin } from "./fixture-draft";
import "@/app/globals.css";

const query = new URLSearchParams(location.search);
const embedded = query.has("embedded");
function createDemoRequest(): typeof fetch {
  let version = 0;
  // Only these explicitly injected requests can run. Each remount has its own
  // receipt sequence, including when a request from a discarded session finishes.
  return async (input, init) => {
    const url = String(input);
    if (init?.method !== "POST") throw new Error("Fixture: only simulated POST is supported");
    await new Promise(resolve => setTimeout(resolve, 350));
    const scenario = query.get("scenario");
    if (scenario === "network") throw new Error("Simulated offline");
    if (scenario === "error") return new Response(JSON.stringify({ error: "Servicio temporalmente no disponible" }), { status: 503 });
    if (url === `/p/${TOKEN}/packlist`) {
      const payload = JSON.parse(String(init.body));
      const result = validatePackingListInput(payload);
      if (result.fieldErrors) return new Response(JSON.stringify({ error: "Revisa los datos", fieldErrors: result.fieldErrors }), { status: 400 });
      return new Response(JSON.stringify({ ok: true, folio: "PL-DEMO-0468", versionNo: ++version, labelsNeedReview: result.input!.totals.ctns !== 5 }));
    }
    if (url === `/p/${TOKEN}/upload`) {
      const count = (init.body as FormData).getAll("files").length;
      return new Response(JSON.stringify({ ok: true, uploaded: scenario === "partial" ? Math.max(0, count - 1) : count }));
    }
    throw new Error("Fixture blocked unexpected request");
  };
}
function ProviderSession() {
  const [request] = useState(createDemoRequest);
  return <ProviderShareClient token={TOKEN} code="DTD-DEMO-1-1" markbox="DTD-DEMO" supplierName="" supplierWechat="" labels={Array.from({ length: 5 }, (_, i) => ({ code: "DTD-DEMO-1-1", boxN: i + 1, totalBoxes: 5, boxCode: `DTD-B-DEMO-${i + 1}` }))} brand={DTD_BRAND} request={request} excelHref="/templates/dtd-packing-list-invoice.xlsx"/>;
}
function originText(origin: FixtureOrigin) {
  if (origin.kind === "restored") return "Borrador local restaurado";
  if (origin.kind === "unavailable") return "Datos de ejemplo · almacenamiento no disponible";
  if (origin.kind === "invalid") return "Borrador local no recuperable";
  return "Datos de ejemplo";
}
function SupplierDemo() {
  const [origin, setOrigin] = useState(() => prepareFixtureOrigin(() => window.localStorage));
  const [generation, setGeneration] = useState(0);
  const [resetError, setResetError] = useState(false);
  function reset() {
    if (!resetFixtureDraft(() => window.localStorage)) { setResetError(true); return; }
    setOrigin({ kind: "example" });
    setResetError(false);
    setGeneration(value => value + 1);
  }
  return <>
    <div className="no-print border-b border-grey-200 bg-white px-4 py-2 text-xs">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p role="status" className="font-medium">{originText(origin)}</p>
        <button type="button" className="min-h-11 rounded px-2 font-semibold text-wine-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-wine-text" onClick={reset}>Restablecer ejemplo</button>
      </div>
      {origin.clearedLegacyContact && <p className="mx-auto max-w-7xl text-grey-700">Se quitaron los contactos de muestra de una demo anterior. Tus otros datos se conservaron.</p>}
      {origin.kind === "unavailable" && <p className="mx-auto max-w-7xl text-grey-700">No se pudo restaurar un borrador. Los cambios de esta sesión pueden perderse al recargar.</p>}
      {origin.kind === "invalid" && <p className="mx-auto max-w-7xl text-grey-700">El borrador se conservó sin abrir. Usa «Restablecer ejemplo» para descartar solo los datos de esta compra ficticia.</p>}
      {resetError && <p role="alert" className="mx-auto max-w-7xl font-medium">No se pudo completar el restablecimiento. El formulario sigue abierto; habilita el almacenamiento e inténtalo de nuevo.</p>}
    </div>
    {origin.kind !== "invalid" && <ProviderSession key={generation}/>}
  </>;
}
function Fixture() {
  const [page, setPage] = useState(query.get("page") || "client");
  const [width, setWidth] = useState("desktop");
  const [theme, setTheme] = useState(query.get("theme") || "light");
  const path = location.pathname;
  const supplierUrl = `${location.origin}${path}?page=supplier&embedded=1&theme=${theme}`;
  return <main data-portal-theme={theme} className="min-h-screen bg-paper text-ink">
    <header className="no-print sticky top-0 z-30 border-b border-grey-200 bg-grey-100 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide">DEMO · datos ficticios<span className="sr-only"> · envío y carga simulados</span></p>
        {!embedded && <details className="text-xs"><summary className="min-h-11 cursor-pointer content-center rounded px-2 font-semibold focus-visible:outline-2 focus-visible:outline-wine-text">Controles de revisión</summary><div className="mt-2 flex flex-wrap items-center gap-3 pb-2"><button className="btn btn-ghost" onClick={() => setPage("client")}>Cliente: compartir enlace</button><button className="btn btn-ghost" onClick={() => setPage("supplier")}>Proveedor: completar documento</button><label className="flex items-center gap-2">Pantalla<select aria-label="Pantalla" className="min-h-11 rounded border border-grey-300 bg-white p-2 text-ink" value={width} onChange={event => setWidth(event.target.value)}><option value="desktop">Escritorio</option><option value="375">375 px</option><option value="390">390 px</option></select></label><label className="flex items-center gap-2">Tema<select aria-label="Tema" className="min-h-11 rounded border border-grey-300 bg-white p-2 text-ink" value={theme} onChange={event => setTheme(event.target.value)}><option value="light">Claro</option><option value="dark">Oscuro</option></select></label><label className="flex items-center gap-2">Simulación<select aria-label="Simulación" className="min-h-11 rounded border border-grey-300 bg-white p-2 text-ink" value={query.get("scenario") || "ok"} onChange={event => { query.set("scenario", event.target.value); query.set("page", page); location.search = query.toString(); }}><option value="ok">Correcto</option><option value="partial">Carga parcial</option><option value="network">Sin conexión</option><option value="error">Servidor 503</option></select></label></div><details className="border-t border-grey-200 py-2"><summary className="min-h-11 cursor-pointer content-center font-semibold">Caso de prueba: líneas de factura y cajas mixtas</summary><ol className="max-w-prose list-decimal space-y-2 py-3 pl-5"><li>Restablece el ejemplo. En el paso 2: 5 cajas, 3 kg/caja y 0,5 m³/caja. Producto Vasos, código VAS-01: 10 uds./caja, USD 2. Pulsa Guardar producto.</li><li>Agrega Tapas en esas cajas: 8 unidades del grupo, USD 4. Guarda. Debe quedar una segunda línea; total: 5 cajas, 58 uds., 15 kg, 2,5 m³, USD 132.</li><li>Agrega Cucharas: 12 unidades del grupo, USD 0,50. Guarda. Total: 70 uds. y USD 138; cajas/peso/volumen iguales.</li><li>Alterna Formato estándar y Llenado guiado. Producto y código deben ir primero; cambia el código en la hoja y verifica la misma línea al volver. Selecciona archivos y comprueba que permanecen entre ambas opciones, Excel e idiomas.</li><li>Edita Tapas a 10 unidades y guarda: 72 uds., USD 146. Quítalo: 62 uds., USD 106. Revisa en 375/390, oscuro, idiomas y tras recarga.</li></ol><p className="max-w-prose pb-2 text-grey-700">Estos pasos no cargan datos ni reemplazan el borrador automáticamente. Todos los envíos de esta preview son simulados.</p></details></details>}
      </div>
    </header>
    {!embedded && width !== "desktop" ? <iframe title={`Vista real de ${width} píxeles`} src={`${path}?embedded=1&page=${page}&theme=${theme}&scenario=${query.get("scenario") || "ok"}`} width={width} height="900" className="mx-auto block max-w-full border-x border-grey-300"/> : page === "supplier" ? <SupplierDemo/> : <div className="mx-auto max-w-3xl p-4 sm:p-8"><h1 className="mb-2 text-3xl font-bold">Compra de muestra</h1><p className="mb-8 font-mono text-grey-700">DTD-DEMO-1-1 · 5 cajas</p><ShareProviderButton token={TOKEN}/><a className="btn btn-ghost mt-6" href={supplierUrl}>Abrir lo que recibe el proveedor</a></div>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
