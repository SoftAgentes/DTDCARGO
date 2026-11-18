/**
 * Vista detalle de envio.
 *
 * Ancho completo (SDD-0662). Tres zonas: datos (datos del envío y documentos),
 * operación (acciones, plan, legal) y seguimiento (cambios de cliente, lo que ve
 * el cliente y timeline). Tres columnas en pantallas anchas, dos en medianas y
 * una en angostas (`.studio-ficha-embarque-grid`).
 * Arriba, la franja «Cliente» con el cambio de cliente (ClienteDelEmbarque).
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
import { ShipmentPlanPanel } from "./_components/ShipmentPlanPanel";
import { CustomerPreview } from "./_components/CustomerPreview";
import { TimelinePanel } from "./_components/TimelinePanel";
import { FooterActions } from "./_components/FooterActions";
import { ClienteDelEmbarque } from "./_components/ClienteDelEmbarque";
import { CargaDelEmbarque } from "./_components/CargaDelEmbarque";
import { leerCargaDelEmbarque, leerGrupoDelEmbarque } from "@/lib/studio/medidas-embarque-queries";
import { ClienteCambiado } from "./_components/ClienteCambiado";
import { createAdminClient } from "@/lib/db/admin";
import { listarCambiosDeCliente } from "@/lib/studio/reasignar-historial";
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
import { canEditModule, canSpecial } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import {
  readCanSeeClientNames,
  segunVisibilidad,
} from "@/lib/studio/privacidad-cn";

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

  const leido = await getShipmentById(supabase, id);
  if (!leido) notFound();

  // SDD-0531 · PIPL: al equipo de China (región cn, no admin) no le llegan el
  // nombre del cliente ni la ubicación de entrega. Se ocultan acá, antes de que
  // el envío se pase a los paneles de cliente (que lo serializan entero).
  const puedeVerNombres = await readCanSeeClientNames(supabase);
  const shipment = segunVisibilidad(leido, puedeVerNombres);

  const events = await getShipmentEvents(supabase, id);

  // SDD-0673 · la carga de su línea del contenedor y el grupo de WeChat (sin la
  // 0563 el grupo no se lee y el campo no se muestra).
  const [carga, grupo] = await Promise.all([
    leerCargaDelEmbarque(supabase, id),
    leerGrupoDelEmbarque(supabase, id),
  ]);

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

  // SDD-0645 · D1 de Sam: el cambio de cliente queda a la vista, con quién y por qué.
  // La RLS ya dejó leer este embarque; la lectura de la bitácora va acotada a sus
  // eventos de cambio de cliente, en el tenant de la sesión (reasignar-historial.ts).
  const cambiosDeCliente = tenantId
    ? (await listarCambiosDeCliente(createAdminClient, tenantId, shipment.id)).map((c) => ({
        fecha: c.fecha,
        actor: tenantUsers.find((u) => u.id === c.actorId)?.name ?? "Alguien del equipo",
        anterior: c.anterior,
        nuevo: c.nuevo,
        // B-1: el motivo es texto libre; al equipo de China no se le manda.
        motivo: puedeVerNombres ? c.motivo : null,
        motivoOculto: !puedeVerNombres && c.motivo !== null,
      }))
    : [];

  // Rol del usuario → el "Expediente de defensa" (SDD-0070) es admin-only
  // (evidencia con PII). Mismo gate que /studio/legal.
  const { data: roleRow } = await supabase
    .from("user_tenants")
    .select("role")
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ role: StudioUserRole }>();
  const isAdmin = roleRow?.role === "admin";
  const canEditTracking = canEditModule(roleRow?.role, "tracking");
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
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(new Date(iso));
  }

  return (
    <div>
      <ShipmentHeader shipment={shipment} nombresOcultos={!puedeVerNombres} />

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

      {/* SDD-0662 · el cambio de cliente va arriba. SDD-0645: operations, commercial y
          admin (D2). El equipo de China (SDD-0531) no recibe el buscador: muestra nombres. */}
      <div className="studio-ficha-embarque-franja">
        <ClienteDelEmbarque
          shipmentId={shipment.id}
          shipmentCode={shipment.code}
          markbox={shipment.client_markbox}
          puedeVerNombres={puedeVerNombres}
          puedeReasignar={canSpecial(roleRow?.role, "reassign_shipment_owner")}
        />
        <CargaDelEmbarque
          shipmentId={shipment.id}
          shipmentCode={shipment.code}
          carga={carga}
          cbmEmbarque={shipment.volume_m3 ?? null}
          pesoEmbarque={shipment.weight_kg ?? null}
          grupo={grupo}
          puedeEditarGrupo={canEditTracking}
          puedeCorregir={canSpecial(roleRow?.role, "correct_shipment_measures")}
          puedePartir={canSpecial(roleRow?.role, "split_shipment")}
          puedeVerNombres={puedeVerNombres}
        />
      </div>

      <div className="studio-ficha-embarque-grid">
        {/* Zona de datos — datos editables + documentos */}
        <div className="studio-ficha-embarque-zona" data-zona="datos">
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <ShipmentDataPanel
              shipment={shipment}
              nombresOcultos={!puedeVerNombres}
              enContenedor={carga.enContenedor}
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

        {/* Zona de operación — acciones, plan y legal */}
        <div className="studio-ficha-embarque-zona" data-zona="operacion">
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

          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <ShipmentPlanPanel shipment={shipment} canEdit={canEditTracking} />
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

        </div>

        {/* Zona de seguimiento — cambios de cliente, lo que ve el cliente y timeline */}
        <aside className="studio-ficha-embarque-zona" data-zona="seguimiento">
          {cambiosDeCliente.length > 0 && (
            <section>
              <ClienteCambiado shipmentCode={shipment.code} cambios={cambiosDeCliente} />
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
            canEditComments={canEditModule(roleRow?.role, "tracking")}
            canModerateComments={canSpecial(
              roleRow?.role,
              "moderate_comments",
            )}
            canRestoreComments={canSpecial(roleRow?.role, "restore_comments")}
          />
        </section>
      )}

      <FooterActions
        shipmentId={shipment.id}
        shipmentCode={shipment.code}
        status={shipment.status}
        canDelete={canSpecial(roleRow?.role, "delete_shipments")}
      />
    </div>
  );
}
