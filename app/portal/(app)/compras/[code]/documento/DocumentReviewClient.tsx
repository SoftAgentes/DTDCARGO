"use client";

/**
 * SDD-0473 · Donde el cliente revisa lo que salió de sus documentos.
 *
 * Es el eslabón entre cargar y compartir. Lo que se carga acá NO es una versión
 * confirmada: es un borrador que el cliente corrige y después manda al proveedor,
 * que es quien confirma lo que realmente despacha.
 *
 * Dos cosas que este componente no hace nunca:
 *  - Guardar solo. El guardado es un clic explícito, porque cada guardado avanza
 *    la revisión compartida y el proveedor puede estar mirando la misma compra.
 *  - Pisar en silencio. Si el servidor avanzó por otro lado, el guardado devuelve
 *    409 y acá se avisa conservando lo escrito, en vez de descartarlo.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { computeDocumentTotals, confirmationIssues, type DocumentDraft } from "@/lib/shared/document-import";
import { DocumentEditor } from "@/components/document-import/DocumentEditor";
import { DocumentImportPanel } from "@/components/document-import/DocumentImportPanel";
import {
  createDocumentClient,
  DocumentRequestError,
  type DocumentClient,
  type DocumentWorkspace,
} from "@/components/document-import/document-client";
import { ShareProviderButton } from "@/app/portal/_components/ShareProviderButton";
import { ArrowIcon } from "@/components/Icon";

type Estado = "cargando" | "listo" | "no-disponible" | "error";

export function DocumentReviewClient({
  code,
  shareToken,
  client,
}: {
  code: string;
  /** Token del enlace del proveedor, si la compra ya lo tiene. */
  shareToken: string | null;
  /** Inyección explícita sólo para pruebas y fixtures. */
  client?: DocumentClient;
}) {
  const [transport] = useState<DocumentClient>(() => client ?? createDocumentClient());
  const [estado, setEstado] = useState<Estado>("cargando");
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null);
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const adoptar = useCallback((next: DocumentWorkspace) => {
    setWorkspace(next);
    setDraft(next.draft);
    setSucio(false);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const caps = await transport.get<{ available: boolean }>("capabilities");
        if (!vivo) return;
        if (caps.available !== true) {
          setEstado("no-disponible");
          return;
        }
        const abierto = await transport.post<{ workspace: DocumentWorkspace }>("open", {
          purchaseCode: code,
        });
        if (!vivo) return;
        adoptar(abierto.workspace);
        setEstado("listo");
      } catch {
        if (vivo) setEstado("error");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [transport, code, adoptar]);

  async function guardar() {
    if (!workspace || !draft) return;
    setGuardando(true);
    setAviso(null);
    try {
      const guardado = await transport.post<DocumentWorkspace>("save", {
        workspaceId: workspace.id,
        draft,
        expectedRevision: workspace.revision,
        commandId: transport.id(),
      });
      // El servidor devuelve la revisión nueva; adoptarla evita un 409 en el
      // guardado siguiente.
      setWorkspace(guardado);
      setSucio(false);
      setAviso("Guardado. El proveedor verá esta versión al abrir el enlace.");
    } catch (error) {
      if (error instanceof DocumentRequestError && error.status === 409) {
        setAviso(
          "Alguien más cambió este documento mientras lo editabas. Tus cambios siguen en pantalla: vuelve a abrir la compra para ver la versión compartida antes de guardarlos.",
        );
      } else {
        setAviso("No pudimos guardar. Tus cambios siguen en pantalla; inténtalo de nuevo.");
      }
    } finally {
      setGuardando(false);
    }
  }

  if (estado === "cargando") {
    return (
      <p className="text-[13px] text-grey-700" role="status">
        Abriendo el documento…
      </p>
    );
  }

  if (estado === "no-disponible" || estado === "error") {
    return (
      <section className="card-shadow bg-white border border-grey-200 rounded-[16px] p-6">
        <h1 className="text-xl font-bold m-0">Documento de la compra</h1>
        <p className="mt-3 text-grey-700">
          {estado === "error"
            ? "No pudimos abrir el documento. Tus datos están a salvo; inténtalo de nuevo en un momento."
            : "La lectura de documentos todavía no está disponible. Puedes completar el packing list desde el enlace del proveedor."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/portal/compras/${encodeURIComponent(code)}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-700 hover:text-ink transition-colors"
          >
            <ArrowIcon size={15} className="rotate-180" /> Volver a la compra
          </Link>
          {shareToken && <ShareProviderButton token={shareToken} />}
        </div>
      </section>
    );
  }

  const totales = draft ? computeDocumentTotals(draft) : null;
  const pendientes = draft ? confirmationIssues(draft).filter((i) => i.blocking).length : 0;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link
          href={`/portal/compras/${encodeURIComponent(code)}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-grey-700 hover:text-ink transition-colors"
        >
          <ArrowIcon size={15} className="rotate-180" /> Volver a la compra
        </Link>
        <span className="text-[12.5px] text-grey-700">
          Revisión {workspace?.revision ?? 0}
          {sucio ? " · con cambios sin guardar" : ""}
        </span>
      </div>

      <DocumentImportPanel
        workspace={workspace}
        openParams={{ purchaseCode: code }}
        onWorkspace={adoptar}
        locale="es"
        client={transport}
      />

      {draft && (
        <DocumentEditor
          draft={draft}
          onChange={(next) => {
            setDraft(next);
            setSucio(true);
          }}
          locale="es"
          disabled={guardando}
          revision={workspace?.revision}
          confirmed={workspace?.confirmedRevision === workspace?.revision}
        />
      )}

      {aviso && (
        <p
          className="rounded-[12px] border border-grey-200 bg-grey-100 p-4 text-[13.5px] leading-[1.55]"
          role="alert"
        >
          {aviso}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={guardando || !sucio}
          onClick={() => void guardar()}
        >
          {guardando ? "Guardando…" : "Guardar borrador"}
        </button>
        {shareToken && <ShareProviderButton token={shareToken} />}
        {totales && (
          <span className="text-[12.5px] text-grey-700">
            {draft?.products.length ?? 0} productos ·{" "}
            {totales.cartons ?? "pendiente"} cajas ·{" "}
            {totales.grossWeightKg ?? "pendiente"} kg ·{" "}
            {totales.cbm ?? "pendiente"} m³
          </span>
        )}
      </div>

      <p className="text-[12.5px] text-grey-700 leading-[1.55] max-w-[60ch]">
        {pendientes > 0
          ? `Faltan ${pendientes} datos para que el proveedor pueda confirmar el despacho. Puedes compartir el enlace igual: él completa lo que falte.`
          : "El documento tiene todo lo necesario. El proveedor confirma el despacho desde su enlace, y ahí se habilitan las etiquetas."}
      </p>
    </div>
  );
}
