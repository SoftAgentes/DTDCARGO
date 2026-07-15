/**
 * Vista detalle de envio.
 *
 * Layout 2 columnas en desktop, stack en mobile.
 * Columna izquierda: datos editables (ShipmentDataPanel).
 * Columna derecha: estado actual + acciones + customer preview + timeline.
 * Footer: cancelar + eliminar.
 *
 * Server component lee shipment + events via lib/studio/shipment-queries.
 * 404 si no se encuentra (RLS oculta los de otros tenants).
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  getShipmentById,
  getShipmentEvents,
} from "@/lib/studio/shipment-queries";
import { ShipmentHeader } from "./_components/ShipmentHeader";
import { ShipmentDataPanel } from "./_components/ShipmentDataPanel";
import { StateActionsPanel } from "./_components/StateActionsPanel";
import { CustomerPreview } from "./_components/CustomerPreview";
import { TimelinePanel } from "./_components/TimelinePanel";
import { FooterActions } from "./_components/FooterActions";
import { ShipmentDocsPanel } from "./_components/ShipmentDocsPanel";
import {
  listShipmentDocuments,
  signDocumentUrls,
} from "@/lib/studio/shipment-document-queries";
import { DocsPanel } from "@/app/studio/_components/documents/DocsPanel";
import { listDocumentsByEntity } from "@/lib/studio/documents/queries";
import { getUser, getUserTenantId } from "@/lib/auth/session";
import {
  listComments,
  loadTenantUsers,
} from "@/lib/studio/comments/comments-queries";
import { CommentsThread } from "@/app/studio/(app)/_components/comments/CommentsThread";
import type { CommentTenantUser } from "@/lib/studio/comments/types";

export const metadata = {
  title: "Detalle envío",
};

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const shipment = await getShipmentById(supabase, id);
  if (!shipment) notFound();

  const events = await getShipmentEvents(supabase, id);

  // Documentos del envío (SDD-0042 Fase 3b) + signed URLs (user client del
  // equipo: storage RLS por tenant le permite leer del bucket shipment-docs).
  const documents = await listShipmentDocuments(supabase, id);
  const docUrls = await signDocumentUrls(
    supabase,
    documents.map((d) => d.storage_path),
  );

  // Documentos del DMS genérico (SDD-0049) adjuntos a este embarque. Coexiste
  // con shipment_documents (portal-facing) — son repositorios separados.
  const dmsDocuments = await listDocumentsByEntity(supabase, "shipment", id);

  // Comentarios internos del equipo (SDD-0045). Embed canónico del módulo.
  const authUser = await getUser();
  const tenantId = await getUserTenantId();
  const tenantUsers = tenantId ? await loadTenantUsers(tenantId) : [];

  // Rol del usuario → el "Expediente de defensa" (SDD-0070) es admin-only
  // (evidencia con PII). Mismo gate que /studio/legal.
  const { data: roleRow } = await supabase
    .from("user_tenants")
    .select("role")
    .maybeSingle<{ role: string }>();
  const isAdmin = roleRow?.role === "admin";
  const comments = authUser
    ? await listComments(supabase, "shipment", id, tenantUsers, authUser.id)
    : [];
  const currentUser: CommentTenantUser | null = authUser
    ? (tenantUsers.find((u) => u.id === authUser.id) ?? {
        id: authUser.id,
        name: "Yo",
        avatar: "YO",
        role: "Equipo",
      })
    : null;

  // Si esta en excepcion, buscar el evento mas reciente con status="exception"
  // para mostrar su nota en un banner arriba.
  const lastExceptionEvent =
    shipment.status === "exception"
      ? events.find((e) => e.status === "exception")
      : null;

  function formatRelative(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.round(diffMs / 60_000);
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `hace ${hr} h`;
    const days = Math.round(hr / 24);
    return `hace ${days} ${days === 1 ? "día" : "días"}`;
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <ShipmentHeader shipment={shipment} />

      {/* Cancellation reason banner — solo si el envio esta cancelado */}
      {shipment.status === "cancelled" && shipment.cancellation_reason && (
        <div
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            padding: "var(--s-3) var(--s-4)",
            marginBottom: 24,
          }}
        >
          <div
            className="studio-eyebrow"
            style={{ color: "var(--danger)", marginBottom: 6 }}
          >
            Razón de cancelación
          </div>
          <p
            style={{
              font: "500 13px/1.5 var(--f-sans)",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {shipment.cancellation_reason}
          </p>
        </div>
      )}

      {/* Exception banner — activo solo mientras status=exception */}
      {lastExceptionEvent && (
        <div
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            padding: "14px 18px",
            marginBottom: 24,
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 22,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ⚠
          </span>
          <div style={{ flex: 1 }}>
            <div
              className="studio-eyebrow"
              style={{ color: "var(--danger)", marginBottom: 6 }}
            >
              Excepción activa · {formatRelative(lastExceptionEvent.occurred_at)}
            </div>
            <p
              style={{
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              {lastExceptionEvent.note ?? "Sin descripción."}
            </p>
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "6px 0 0",
              }}
            >
              Resuelve el problema y cambia el estado en el panel de acciones
              para que el envío continúe.
            </p>
          </div>
        </div>
      )}

      <div className="studio-detail-grid">
        {/* Columna izquierda — datos editables + documentos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <ShipmentDataPanel shipment={shipment} />
          </section>
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <ShipmentDocsPanel
              shipmentId={shipment.id}
              documents={documents}
              signedUrls={docUrls}
            />
          </section>
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <DocsPanel
              entityType="shipment"
              entityId={shipment.id}
              documents={dmsDocuments}
              title="Documentos internos · hub"
              badge={{ tone: "neutral", label: "Interno" }}
              subtitle="Adjuntos internos del equipo. Aparecen en el hub de Documentos; el cliente NO los ve."
            />
          </section>
        </div>

        {/* Columna derecha — operación */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <StateActionsPanel
              shipmentId={shipment.id}
              service={shipment.shipment_service}
              status={shipment.status}
            />
          </section>

          {/* Expediente de defensa (SDD-0070) — admin-only. Abre la cadena de
              evidencia consolidada de esta operación en pestaña nueva. */}
          {isAdmin && (
            <section
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 20,
              }}
            >
              <div
                className="studio-eyebrow"
                style={{ color: "var(--ink-soft)", marginBottom: 8 }}
              >
                Legal · evidencia
              </div>
              <p
                style={{
                  font: "500 12.5px/1.5 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: "0 0 12px",
                }}
              >
                Reúne en 1 documento la aceptación de términos, packing, fotos de
                origen, cronología y prueba de entrega de esta operación.
              </p>
              <a
                className="studio-btn studio-btn-ghost studio-btn-sm"
                href={`/studio/legal/expediente/${encodeURIComponent(shipment.code)}`}
                target="_blank"
                rel="noopener"
              >
                Expediente de defensa
              </a>
            </section>
          )}

          <section>
            <CustomerPreview
              service={shipment.shipment_service}
              status={shipment.status}
            />
          </section>

          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <TimelinePanel
              shipmentId={shipment.id}
              service={shipment.shipment_service}
              events={events}
            />
          </section>
        </aside>
      </div>

      {/* Comentarios internos del equipo (SDD-0045) */}
      {currentUser && (
        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 24,
            marginTop: 20,
          }}
        >
          <CommentsThread
            entityType="shipment"
            entityId={shipment.id}
            entityCode={shipment.code}
            entityLabel="embarque"
            users={tenantUsers}
            currentUser={currentUser}
            initialComments={comments}
          />
        </section>
      )}

      <FooterActions
        shipmentId={shipment.id}
        shipmentCode={shipment.code}
        status={shipment.status}
      />
    </div>
  );
}
