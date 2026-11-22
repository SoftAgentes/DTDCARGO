"use client";

/**
 * SDD-0473 · El envoltorio que decide si la importación se ofrece o no.
 *
 * Existe para que cablear el panel sea seguro. Mientras `DOCUMENT_IMPORT_ENABLED`
 * y `DOCUMENT_IMPORT_PORTAL_ENABLED` no estén las dos en "true", este componente
 * no renderiza NADA y el formulario manual queda exactamente como estaba: cero
 * cambio visible, cero riesgo. La primera sola enciende el cotizador público.
 *
 * Pregunta por `capabilities`, que es la única acción de la API que responde sin
 * el flag encendido. Si la consulta falla, se calla — un error de red no puede
 * ofrecerle al cliente una función que quizá no exista.
 *
 * Frontera: vive en `components/`, así que sólo importa de `lib/shared/`.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createDocumentClient,
  documentText,
  type DocumentClient,
  type DocumentLocale,
  type DocumentWorkspace,
} from "./document-client";
import { DocumentImportPanel } from "./DocumentImportPanel";
import s from "./document-import.module.css";

/** `portal` es el segundo interruptor: sin él, sólo existe el cotizador anónimo. */
type Capabilities = { available: boolean; portal?: boolean; formats: string[]; maxBytes: number };

export function DocumentImportEntry({
  purchaseCode,
  locale = "es",
  onManual,
  onReview,
  reviewHref,
  onAvailability,
  presentation = "upload",
  client,
}: {
  /** Compra a la que se adjunta el documento. Sin ella el workspace sería anónimo. */
  purchaseCode: string;
  locale?: DocumentLocale;
  onManual?: () => void;
  onReview?: (workspace: DocumentWorkspace) => void;
  /** A dónde lleva «Revisar documento». Sin esto y sin `onReview`, el botón no aparece. */
  reviewHref?: string;
  onAvailability?: (available: boolean) => void;
  presentation?: "upload" | "overview";
  /** Inyección explícita sólo para pruebas y fixtures. */
  client?: DocumentClient;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);

  // Inicializador perezoso en vez de un ref: crea el transporte UNA sola vez sin
  // leer `.current` durante el render, que es lo que React desaconseja.
  const [transport] = useState<DocumentClient>(() => client ?? createDocumentClient());

  useEffect(() => {
    let vivo = true;
    transport
      .get<Capabilities>("capabilities")
      .then((caps) => {
        // Esto vive dentro de una COMPRA: pide las dos llaves. Con sólo la
        // primera está encendido el cotizador, no la carga en el portal.
        if (vivo) {
          const enabled = caps.available === true && caps.portal === true;
          setAvailable(enabled);
          onAvailability?.(enabled);
        }
      })
      // Silencio deliberado: si no se pudo preguntar, no se ofrece.
      .catch(() => {
        if (vivo) {
          setAvailable(false);
          onAvailability?.(false);
        }
      });
    return () => {
      vivo = false;
    };
  }, [transport, onAvailability]);

  if (available !== true) return null;

  if (presentation === "overview") {
    return (
      <section className={[s.root, s.card, s.stack].join(" ")} aria-label="Documento compartido de la compra">
        <div className={s.pageHeader}>
          <h2>Packing List + Factura</h2>
          <p>Reúne productos, cajas, peso y volumen en un solo documento. Tu proveedor revisa esa misma información antes de despachar.</p>
        </div>
        <ol className={s.journeySteps} aria-label="Recorrido del documento">
          <li>1. Carga o completa los datos</li>
          <li>2. Revisa y guarda el borrador</li>
          <li>3. El proveedor confirma e imprime</li>
        </ol>
        {reviewHref && (
          <div className={s.actions}>
            <Link href={reviewHref} className="btn btn-primary">Abrir Packing List + Factura</Link>
          </div>
        )}
      </section>
    );
  }

  return <DocumentUploadEntry key={purchaseCode} purchaseCode={purchaseCode} locale={locale} onManual={onManual} onReview={onReview} reviewHref={reviewHref} transport={transport} />;
}

function DocumentUploadEntry({ purchaseCode, locale, onManual, onReview, reviewHref, transport }: {
  purchaseCode: string;
  locale: DocumentLocale;
  onManual?: () => void;
  onReview?: (workspace: DocumentWorkspace) => void;
  reviewHref?: string;
  transport: DocumentClient;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null);
  return (
    <div className={[s.root, s.stack].join(" ")}>
    <DocumentImportPanel
      workspace={workspace}
      openParams={{ purchaseCode }}
      onWorkspace={(next) => setWorkspace(next)}
      onManual={onManual}
      onReview={
        onReview && workspace
          ? () => onReview(workspace)
          : reviewHref
            ? () => router.push(reviewHref)
            : undefined
      }
      locale={locale}
      client={transport}
      canReview={(workspace?.revision ?? 0) > 0}
    />
    {workspace?.revision === 0 && <p className={s.muted}>{documentText(locale,
      "读取完成后，请先将建议应用到文件，再查看完整内容。",
      "Cuando termine la lectura, aplica la propuesta para revisar el documento completo. Lo extraído todavía no confirma el despacho.",
      "When reading finishes, apply the proposal before reviewing the complete document. Extracted data does not confirm dispatch.",
    )}</p>}
    </div>
  );
}
