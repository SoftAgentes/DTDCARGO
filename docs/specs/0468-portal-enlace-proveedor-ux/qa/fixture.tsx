import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProviderShareClient } from "@/app/p/[token]/ProviderShareClient";
import { ShareProviderButton } from "@/app/portal/_components/ShareProviderButton";
import { DTD_BRAND } from "@/lib/shared/brand-context";
import { validatePackingListInput } from "@/lib/studio/prealertas/packlist-form";
import "@/app/globals.css";

const query = new URLSearchParams(location.search);
const embedded = query.has("embedded");
const TOKEN = "local-fixture-only-0468";
let version = 0;
// Only these explicitly injected requests can run. No backend/global-fetch interception.
const request: typeof fetch = async (input, init) => {
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
function Fixture() {
  const [page, setPage] = useState(query.get("page") || "client");
  const [width, setWidth] = useState("desktop");
  const [theme, setTheme] = useState(query.get("theme") || "light");
  const path = location.pathname;
  const supplierUrl = `${location.origin}${path}?page=supplier&embedded=1&theme=${theme}`;
  const props = { token: TOKEN, code: "DTD-DEMO-1-1", markbox: "DTD-DEMO", supplierName: "示例供应商 · Proveedor de muestra", supplierWechat: "demo-wechat", labels: Array.from({ length: 5 }, (_, i) => ({ code: "DTD-DEMO-1-1", boxN: i + 1, totalBoxes: 5, boxCode: `DTD-B-DEMO-${i + 1}` })), brand: DTD_BRAND, request, excelHref: "/templates/dtd-packing-list-invoice.xlsx" };
  return <main data-portal-theme={theme} className="min-h-screen bg-paper text-ink">
    <div className="no-print border-b border-grey-200 bg-grey-100 px-4 py-3"><p className="text-sm font-semibold">Vista de revisión · datos ficticios · envío y carga simulados</p>{!embedded && <div className="mt-3 flex flex-wrap items-center gap-3"><button className="btn btn-ghost" onClick={() => setPage("client")}>Cliente: compartir enlace</button><button className="btn btn-ghost" onClick={() => setPage("supplier")}>Proveedor: completar documento</button><label className="flex items-center gap-2 text-sm">Pantalla<select aria-label="Pantalla" className="min-h-11 rounded border border-grey-300 bg-white p-2" value={width} onChange={event => setWidth(event.target.value)}><option value="desktop">Escritorio</option><option value="375">375 px</option><option value="390">390 px</option></select></label><label className="flex items-center gap-2 text-sm">Tema<select aria-label="Tema" className="min-h-11 rounded border border-grey-300 bg-white p-2" value={theme} onChange={event => setTheme(event.target.value)}><option value="light">Claro</option><option value="dark">Oscuro</option></select></label><label className="flex items-center gap-2 text-sm">Simulación<select aria-label="Simulación" className="min-h-11 rounded border border-grey-300 bg-white p-2" value={query.get("scenario") || "ok"} onChange={event => { query.set("scenario", event.target.value); query.set("page", page); location.search = query.toString(); }}><option value="ok">Correcto</option><option value="partial">Carga parcial</option><option value="network">Sin conexión</option><option value="error">Servidor 503</option></select></label></div>}</div>
    {!embedded && width !== "desktop" ? <iframe title={`Vista real de ${width} píxeles`} src={`${path}?embedded=1&page=${page}&theme=${theme}&scenario=${query.get("scenario") || "ok"}`} width={width} height="900" className="mx-auto block max-w-full border-x border-grey-300"/> : page === "supplier" ? <ProviderShareClient {...props}/> : <div className="mx-auto max-w-3xl p-4 sm:p-8"><h1 className="mb-2 text-3xl font-bold">Compra de muestra</h1><p className="mb-8 font-mono text-grey-700">DTD-DEMO-1-1 · 5 cajas</p><ShareProviderButton token={TOKEN}/><a className="btn btn-ghost mt-6" href={supplierUrl}>Abrir lo que recibe el proveedor</a></div>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
