"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { computeDocumentTotals, confirmationIssues, type DocumentDraft } from "@/lib/shared/document-import";
import { DocumentEditor, DocumentSummary } from "@/components/document-import/DocumentEditor";
import { DocumentImportPanel } from "@/components/document-import/DocumentImportPanel";
import {
  createDocumentClient,
  DocumentRequestError,
  type DocumentClient,
  type DocumentReceipt,
  type DocumentWorkspace,
} from "@/components/document-import/document-client";
import s from "@/components/document-import/document-import.module.css";
import { ShareProviderButton } from "@/app/portal/_components/ShareProviderButton";
import { ArrowIcon, CheckIcon, WarningIcon } from "@/components/Icon";

type Estado = "cargando" | "listo" | "no-disponible" | "error";
type Aviso = { text: string; error: boolean } | null;

type DocumentReviewProps = {
  code: string;
  shareToken: string | null;
  client?: DocumentClient;
};

export function DocumentReviewClient(props: DocumentReviewProps) {
  return <DocumentReviewWorkspace key={props.code} {...props} />;
}

function DocumentReviewWorkspace({ code, shareToken, client }: DocumentReviewProps) {
  const [transport] = useState<DocumentClient>(() => client ?? createDocumentClient());
  const [estado, setEstado] = useState<Estado>("cargando");
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null);
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [conflicto, setConflicto] = useState(false);
  const [compartida, setCompartida] = useState<DocumentWorkspace | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [salir, setSalir] = useState(false);
  const [intento, setIntento] = useState(0);
  const avisoRef = useRef<HTMLDivElement>(null);
  const compararRef = useRef<HTMLButtonElement>(null);
  const cambiosRef = useRef(false);
  const compraHref = `/portal/compras/${encodeURIComponent(code)}`;

  const adoptar = useCallback((next: DocumentWorkspace) => {
    setWorkspace(next);
    setDraft(next.draft);
    cambiosRef.current = false;
    setSucio(false);
    setConflicto(false);
    setCompartida(null);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const caps = await transport.get<{ available: boolean; portal?: boolean }>("capabilities");
        if (!vivo) return;
        if (caps.available !== true || caps.portal !== true) {
          setEstado("no-disponible");
          return;
        }
        const abierto = await transport.post<{ workspace: DocumentWorkspace }>("open", { purchaseCode: code });
        if (!vivo) return;
        adoptar(abierto.workspace);
        setEstado("listo");
      } catch {
        if (vivo) setEstado("error");
      }
    })();
    return () => { vivo = false; };
  }, [transport, code, adoptar, intento]);

  useEffect(() => {
    if (!sucio) return;
    const conservar = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", conservar);
    return () => window.removeEventListener("beforeunload", conservar);
  }, [sucio]);

  useEffect(() => {
    if (aviso?.error) avisoRef.current?.focus();
  }, [aviso]);

  async function guardar() {
    if (!workspace || !draft || guardando) return;
    setGuardando(true);
    setAviso(null);
    try {
      const recibo = await transport.post<DocumentReceipt>("save", {
        workspaceId: workspace.id,
        draft,
        expectedRevision: workspace.revision,
        commandId: transport.id(),
      });
      setWorkspace({
        ...workspace,
        draft,
        revision: recibo.revision,
        confirmedRevision: recibo.confirmed ? recibo.revision : workspace.confirmedRevision,
      });
      setSucio(false);
      cambiosRef.current = false;
      setConflicto(false);
      setCompartida(null);
      setSalir(false);
      setAviso({ text: `Guardado. El proveedor verá la revisión ${recibo.revision} al abrir el enlace.`, error: false });
    } catch (error) {
      if (error instanceof DocumentRequestError && error.status === 409) {
        setConflicto(true);
        setAviso({ text: "Otra persona guardó una revisión más reciente. Tus cambios siguen en pantalla. Compara las versiones antes de continuar.", error: true });
      } else {
        setAviso({ text: "No pudimos confirmar el guardado. Tus cambios siguen en pantalla; inténtalo de nuevo.", error: true });
      }
    } finally {
      setGuardando(false);
    }
  }

  async function comparar() {
    if (!workspace || consultando) return;
    setConsultando(true);
    try {
      const response = await transport.get<{ workspace: DocumentWorkspace }>("workspace", { workspaceId: workspace.id });
      setCompartida(response.workspace);
      setAviso({ text: "La versión compartida está abajo para comparar. Tus cambios todavía se conservan.", error: false });
    } catch {
      setAviso({ text: "No pudimos consultar la revisión compartida. Tus cambios se conservan; vuelve a intentarlo.", error: true });
    } finally {
      setConsultando(false);
    }
  }

  if (estado === "cargando") {
    return <div className={[s.root, s.card].join(" ")} role="status" aria-busy="true">Abriendo el documento de tu compra…</div>;
  }

  if (estado === "no-disponible" || estado === "error") {
    return <section className={[s.root, s.card, s.stack].join(" ")}>
      <div className={s.pageHeader}><h1>Packing List + Factura</h1><p>{estado === "error"
        ? "No pudimos abrir el documento. Puedes volver a intentarlo."
        : "El documento compartido todavía no está disponible. Puedes solicitar los datos a tu proveedor desde la compra."}</p></div>
      <div className={s.actions}>
        <Link href={compraHref} className="btn btn-ghost"><ArrowIcon size={16} className="rotate-180" /> Volver a la compra</Link>
        {estado === "error" && <button type="button" className="btn btn-primary" onClick={() => { setEstado("cargando"); setIntento((value) => value + 1); }}>Volver a intentar</button>}
      </div>
      {estado === "no-disponible" && shareToken && <ShareProviderButton token={shareToken} />}
    </section>;
  }

  const confirmado = !!workspace && workspace.confirmedRevision === workspace.revision;
  const pendientes = draft ? confirmationIssues(draft).filter((issue) => issue.blocking).length : 0;
  const puedeCompartir = !!workspace && workspace.revision > 0 && !sucio && !guardando;

  return <div className={[s.root, s.stack].join(" ")}>
    <div className={s.bar}>
      <Link href={compraHref} className="btn btn-ghost" onClick={(event) => {
        if (sucio || guardando) { event.preventDefault(); setSalir(true); }
      }}><ArrowIcon size={16} className="rotate-180" /> Volver a la compra</Link>
      <span className={s.status}>{sucio ? <WarningIcon size={16} /> : confirmado ? <CheckIcon size={16} /> : null}
        {sucio ? "Cambios sin guardar" : confirmado ? "Despacho confirmado por el proveedor" : workspace?.revision ? "Borrador guardado" : "Borrador por completar"} · Revisión {workspace?.revision ?? 0}
      </span>
    </div>

    <header className={s.pageHeader}>
      <p className={s.muted}>Compra <strong>{code}</strong></p>
      <h1>Packing List + Factura</h1>
      <p>Revisa lo que cargaste y completa lo que ya conoces. Tu proveedor abrirá este mismo documento, corregirá el peso y el CBM y confirmará lo que despacha.</p>
    </header>

    <ol className={s.journeySteps} aria-label="Pasos del documento compartido">
      <li>1. Revisa productos y cajas</li>
      <li>2. Guarda y comparte</li>
      <li>3. El proveedor confirma e imprime</li>
    </ol>

    {salir && <div className={s.notice} role="alert">
      <p>{guardando ? "El guardado está en curso. Espera la confirmación antes de salir." : "Tienes cambios sin guardar. Guárdalos para que tu proveedor pueda verlos."}</p>
      {!guardando && <div className={s.actions}>
        <button type="button" className="btn btn-ghost" onClick={() => setSalir(false)}>Seguir editando</button>
        <Link href={compraHref} className="btn btn-ghost">Salir sin guardar</Link>
      </div>}
    </div>}

    {aviso && <div ref={avisoRef} tabIndex={-1} className={s.notice} role={aviso.error ? "alert" : "status"}>
      <p>{aviso.text}</p>
      {conflicto && <button ref={compararRef} type="button" className="btn btn-ghost" disabled={consultando || guardando} aria-busy={consultando} onClick={() => void comparar()}>{consultando ? "Consultando…" : "Comparar con la versión compartida"}</button>}
    </div>}

    {compartida && draft && <section className={[s.card, s.stack].join(" ")} aria-labelledby="comparar-versiones">
      <h2 id="comparar-versiones">Compara antes de reemplazar tus cambios</h2>
      <div className={s.fields}>
        <VersionResumen title="Tus cambios en pantalla" draft={draft} revision={workspace?.revision ?? 0} />
        <VersionResumen title="Versión compartida" draft={compartida.draft} revision={compartida.revision} />
      </div>
      <details><summary>Ver el documento compartido completo</summary><DocumentEditor draft={compartida.draft} onChange={() => undefined} locale="es" disabled revision={compartida.revision} hideSummary /></details>
      <p>Usar la versión compartida reemplazará los cambios que tienes en pantalla. Puedes conservarlos mientras revisas las diferencias.</p>
      <div className={s.actions}>
        <button type="button" className="btn btn-ghost" onClick={() => { setCompartida(null); compararRef.current?.focus(); }}>Conservar mis cambios</button>
        <button type="button" className="btn btn-ghost" onClick={() => {
          adoptar(compartida);
          setAviso({ text: `Ahora ves la revisión compartida ${compartida.revision}.`, error: false });
        }}>Descartar mis cambios y usar revisión {compartida.revision}</button>
      </div>
    </section>}

    <div className={s.workspace}>
      <div className={s.stack}>
        <details className={[s.card, s.stack].join(" ")} open={!draft?.products.length}>
          <summary>Importar factura, PI o packing list</summary>
          {sucio && <p className={s.notice}>Guarda tus cambios antes de agregar otro documento. Así se conserva lo que acabas de corregir.</p>}
          <fieldset disabled={guardando || sucio} className={[s.stack, "m-0 min-w-0 border-0 p-0"].join(" ")} onDropCapture={(event) => {
            if (guardando || sucio) { event.preventDefault(); event.stopPropagation(); }
          }}>
            <DocumentImportPanel workspace={workspace} openParams={{ purchaseCode: code }} onWorkspace={(next) => {
              if (cambiosRef.current) {
                setCompartida(next);
                setConflicto(true);
                setAviso({ text: "El documento importado llegó mientras editabas. Tus cambios siguen en pantalla; compara las versiones antes de reemplazarlos.", error: true });
              } else adoptar(next);
            }} locale="es" client={transport} />
          </fieldset>
        </details>

        {draft && <DocumentEditor draft={draft} onChange={(next) => { cambiosRef.current = true; setDraft(next); setSucio(true); if (!conflicto) setAviso(null); }} locale="es" disabled={guardando} revision={workspace?.revision} confirmed={confirmado && !sucio} hideSummary />}

        <section id="compartir-borrador" className={[s.card, s.stack].join(" ")} aria-label="Compartir el documento guardado">
          <h2>{confirmado&&!sucio?"Documento confirmado por el proveedor":"Comparte el borrador guardado"}</h2>
          <p>{confirmado&&!sucio?"El proveedor confirmó esta revisión. Si cambias datos, deberá volver a confirmar antes de imprimir etiquetas vigentes.":pendientes > 0
            ? `Hay ${pendientes} datos por completar para confirmar el despacho. Puedes guardar y compartir el borrador; tu proveedor completa lo que falte.`
            : "Los datos necesarios están completos. El proveedor debe revisarlos y confirmar el despacho desde su enlace."}</p>
          {shareToken && (puedeCompartir ? <ShareProviderButton token={shareToken} documentConfirmed={confirmado&&!sucio} /> : <div className={s.notice}>
            <p><strong>Guarda antes de compartir.</strong> El proveedor verá únicamente la revisión guardada, nunca los cambios que aún tienes en pantalla.</p>
          </div>)}
          {confirmado && !sucio && <Link href={`${compraHref}/etiquetas`} className="btn btn-ghost">Ver documento y etiquetas confirmadas <ArrowIcon size={16} /></Link>}
        </section>
      </div>
      {draft && <aside className={[s.summary, s.stack].join(" ")} aria-label="Resumen de la compra">
        <DocumentSummary draft={draft} locale="es" revision={workspace?.revision} confirmed={confirmado && !sucio} />
        <div className={[s.card, s.stack].join(" ")}>
          <button type="button" className="btn btn-primary" disabled={guardando || !sucio} aria-busy={guardando} onClick={() => void guardar()}>{guardando ? "Guardando…" : "Guardar borrador"}</button>
          <p className={s.muted}>{sucio ? "Guarda para que tu proveedor vea estas correcciones." : workspace?.revision ? `Revisión ${workspace.revision} guardada` : "Agrega datos o importa un documento para guardar"}</p>
          <a href="#compartir-borrador" className="btn btn-ghost">Ver opciones para compartir</a>
        </div>
      </aside>}
    </div>
  </div>;
}

function VersionResumen({ title, draft, revision }: { title: string; draft: DocumentDraft; revision: number }) {
  const totals = computeDocumentTotals(draft);
  return <div className={s.stack}>
    <h3>{title} · Revisión {revision}</h3>
    <p>{draft.supplier.company || "Proveedor por completar"}</p>
    <dl>
      <dt>Productos</dt><dd>{draft.products.length}</dd>
      <dt>Cajas</dt><dd>{totals.cartons ?? "Por completar"}</dd>
      <dt>Peso bruto</dt><dd>{totals.grossWeightKg ?? "Por completar"} kg</dd>
      <dt>CBM</dt><dd>{totals.cbm ?? "Por completar"} m³</dd>
      <dt>Valor de productos</dt><dd>{Object.entries(totals.amounts).map(([currency, amount]) => `${currency} ${amount.toFixed(2)}`).join(" · ") || "Por completar"}</dd>
    </dl>
    <p>{draft.products.map((product) => product.name || product.nameZh || product.code).filter(Boolean).join(" · ") || "Sin productos todavía"}</p>
  </div>;
}
