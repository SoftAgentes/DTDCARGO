"use client";

/**
 * SDD-0473 · El envoltorio que decide si la importación se ofrece o no.
 *
 * Existe para que cablear el panel sea seguro. Mientras `DOCUMENT_IMPORT_ENABLED`
 * no esté en "true", este componente no renderiza NADA y el formulario manual
 * queda exactamente como estaba: cero cambio visible, cero riesgo.
 *
 * Pregunta por `capabilities`, que es la única acción de la API que responde sin
 * el flag encendido. Si la consulta falla, se calla — un error de red no puede
 * ofrecerle al cliente una función que quizá no exista.
 *
 * Frontera: vive en `components/`, así que sólo importa de `lib/shared/`.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createDocumentClient,
  type DocumentClient,
  type DocumentLocale,
  type DocumentWorkspace,
} from "./document-client";
import { DocumentImportPanel } from "./DocumentImportPanel";

type Capabilities = { available: boolean; formats: string[]; maxBytes: number };

export function DocumentImportEntry({
  purchaseCode,
  locale = "es",
  onManual,
  onReview,
  reviewHref,
  client,
}: {
  /** Compra a la que se adjunta el documento. Sin ella el workspace sería anónimo. */
  purchaseCode: string;
  locale?: DocumentLocale;
  onManual?: () => void;
  onReview?: (workspace: DocumentWorkspace) => void;
  /** A dónde lleva «Revisar documento». Sin esto y sin `onReview`, el botón no aparece. */
  reviewHref?: string;
  /** Inyección explícita sólo para pruebas y fixtures. */
  client?: DocumentClient;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null);

  // Inicializador perezoso en vez de un ref: crea el transporte UNA sola vez sin
  // leer `.current` durante el render, que es lo que React desaconseja.
  const [transport] = useState<DocumentClient>(() => client ?? createDocumentClient());
  const router = useRouter();

  useEffect(() => {
    let vivo = true;
    transport
      .get<Capabilities>("capabilities")
      .then((caps) => {
        if (vivo) setAvailable(caps.available === true);
      })
      // Silencio deliberado: si no se pudo preguntar, no se ofrece.
      .catch(() => {
        if (vivo) setAvailable(false);
      });
    return () => {
      vivo = false;
    };
  }, [transport]);

  if (available !== true) return null;

  return (
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
    />
  );
}
