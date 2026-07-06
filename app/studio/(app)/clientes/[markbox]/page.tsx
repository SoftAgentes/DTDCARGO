/**
 * Detalle de cliente — datos + histórico de envíos.
 *
 * SDD-0010. Server component lee cliente + shipments via lookup textual
 * (sin FK constraint). El botón "Editar" se maneja en ClientDetailClient.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  getClientByMarkbox,
  listShipmentsByMarkbox,
  getClientPortalAccess,
  getClientPortalApprovedAt,
} from "@/lib/studio/client-queries";
import { listTenantAdvisors } from "@/lib/studio/user-queries";
import {
  clientCompleteness,
  docKindLabel,
  tierBadgeTone,
  tierLabel,
} from "@/lib/studio/client-types";
import {
  SERVICE_LABELS,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import { isAutoVerifyEnabled } from "@/lib/studio/identity";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import { ClientDetailClient } from "../_components/ClientDetailClient";
import { PortalAccessCard } from "../_components/PortalAccessCard";
import { AdvisorAssignCard } from "../_components/AdvisorAssignCard";
import { DeliveryAddressesCard } from "../_components/DeliveryAddressesCard";
import { IdentityVerificationCard } from "../_components/IdentityVerificationCard";
import { listClientDeliveryAddresses } from "@/lib/studio/client-address-queries";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";
import {
  getPublicCalculatorCities,
  getPublicCalculatorConfig,
} from "@/lib/public/rates-queries";
import { DocsPanel } from "@/app/studio/_components/documents/DocsPanel";
import { listDocumentsByEntity } from "@/lib/studio/documents/queries";
import { getOpenChangeRequest } from "@/lib/portal/change-request-queries";
import type { ClientChangeRequest } from "@/lib/portal/change-request-types";
import { ChangeRequestCard } from "../_components/ChangeRequestCard";

export const metadata = { title: "Detalle cliente" };

type ShipmentRow = {
  id: string;
  code: string;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ markbox: string }>;
}) {
  const { markbox } = await params;
  const supabase = await createClient();

  const client = await getClientByMarkbox(supabase, markbox);
  if (!client) notFound();

  const shipments = (await listShipmentsByMarkbox(supabase, markbox)) as ShipmentRow[];
  const portalAccess = await getClientPortalAccess(supabase, client.id);
  const portalApprovedAt = await getClientPortalApprovedAt(supabase, client.id);

  // Asesores asignables (ERP→Norte · clients.advisor_id). El listado de miembros
  // del tenant se resuelve con el admin client (la RLS de user_tenants tapa a los
  // no-admin más allá de su propia fila), scopeado por el tenant del usuario.
  const { data: tenantLink } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const advisors = tenantLink?.tenant_id
    ? await listTenantAdvisors(createAdminClient(), tenantLink.tenant_id)
    : [];

  // Documentos del DMS genérico (SDD-0049) adjuntos a este cliente — KYC, RIF,
  // contratos, poderes. Coexiste con shipment_documents.
  const dmsDocuments = await listDocumentsByEntity(supabase, "client", client.id);

  // Direcciones de entrega (SDD-0138 Slice B). Best-effort: si la migración 0198
  // todavía no está aplicada, la query falla → degradamos a lista vacía sin romper.
  let deliveryAddresses: ClientDeliveryAddress[] = [];
  try {
    deliveryAddresses = await listClientDeliveryAddresses(supabase, client.id);
  } catch {
    deliveryAddresses = [];
  }
  // Slice C: catálogo de ciudades + config del calculador (fuente /studio/tarifas)
  // para estimar el recargo de entrega por dirección. Nunca tiran; sin data → sin
  // estimado.
  const [calcCities, calcConfig] = await Promise.all([
    getPublicCalculatorCities(),
    getPublicCalculatorConfig(),
  ]);
  const lastMileParams = calcConfig
    ? {
        thresholdCascoKm: calcConfig.thresholdCascoKm,
        tarifaKmFueraCasco: calcConfig.tarifaKmFueraCasco,
      }
    : null;

  // SDD-0046: la verificación de identidad aplica a clientes self-registrados
  // o con foto de documento. El badge es advisory — nunca bloquea al cliente.
  // SDD-0131: además de portal/foto, mostramos la card en cualquier cliente que
  // ya tenga documento (el alta interna ahora fija doc_kind → se puede rutear la
  // verificación y ofrecer el piso manual). El badge sigue siendo advisory.
  const hasDocument = client.rif != null && client.rif.trim() !== "";
  const showIdentityCard =
    client.registration_channel === "portal" ||
    client.cedula_photo_path != null ||
    hasDocument;

  // SDD-0131: completitud del perfil — checklist derivado de qué falta para
  // tener el cliente listo para operar/analizar.
  const completeness = clientCompleteness(client);

  // SDD-0151: solicitud de cambio de datos pendiente (la propuso el cliente
  // desde el portal). Best-effort: sin migración 0220 → null, sin romper.
  let changeRequest: ClientChangeRequest | null = null;
  try {
    changeRequest = await getOpenChangeRequest(supabase, client.id);
  } catch {
    changeRequest = null;
  }

  // Signed URL (60s) de la foto de cédula/RIF (bucket privado client-docs). La RLS
  // de storage deja al admin del tenant leerla. Si no hay foto o el sign falla → null.
  let identityPhotoUrl: string | null = null;
  if (showIdentityCard && client.cedula_photo_path) {
    const { data: signed } = await supabase.storage
      .from("client-docs")
      .createSignedUrl(client.cedula_photo_path, 60);
    identityPhotoUrl = signed?.signedUrl ?? null;
  }

  // SDD-0046 (V1 manual-only): la verificación AUTO solo se habilita si hay un
  // provider wired (CNE vía IDENTITY_CNE_URL; SENIAT no construido). Si no, la
  // card oculta el botón auto y deja prominente el piso manual — no ofrecemos un
  // botón que siempre falla.
  const autoVerifyEnabled = showIdentityCard
    ? isAutoVerifyEnabled(client.doc_kind)
    : false;

  return (
    <div style={{ maxWidth: 1200 }}>
      <Link
        href="/studio/clientes"
        style={{
          font: "500 12px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 14 }}>←</span> Volver al listado
      </Link>

      <ClientDetailClient client={client}>
        {/* Header con MARKBOX + nombre + tier badge */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                font: "800 18px/1 var(--f-mono)",
                color: "var(--ink)",
                letterSpacing: "0.02em",
                padding: "8px 14px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
              }}
            >
              {client.markbox}
            </span>
            <h1
              className="studio-display"
              style={{
                fontSize: 26,
                margin: 0,
                color: "var(--ink)",
                flex: 1,
                minWidth: 0,
              }}
            >
              {client.name}
            </h1>
            {client.doc_kind && (
              <Badge tone="neutral" size="md">
                {docKindLabel(client.doc_kind)}
              </Badge>
            )}
            <Badge tone={tierBadgeTone(client.tier)} size="md">
              {tierLabel(client.tier)}
            </Badge>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Columna izquierda: datos del cliente + acceso al portal */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Solicitud de cambio de datos pendiente (SDD-0151) — arriba del todo:
              es un pendiente accionable que el asesor debe resolver. */}
          {changeRequest && (
            <ChangeRequestCard
              req={changeRequest}
              markbox={client.markbox}
              isEmpresa={client.doc_kind === "empresa"}
            />
          )}

          {/* Card datos */}
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            <div className="studio-eyebrow" style={{ marginBottom: 14 }}>
              Datos del cliente
            </div>
            <DataRow label="Tipo" value={docKindLabel(client.doc_kind)} mono={false} />
            {client.doc_kind === "empresa" && (
              <DataRow label="Contacto" value={client.contact_name} mono={false} />
            )}
            <DataRow label="Email" value={client.email} mono={false} />
            <DataRow label="Teléfono" value={client.phone} mono />
            <DataRow label="Dirección" value={client.address} mono={false} />
            <DataRow
              label={client.doc_kind === "empresa" ? "RIF" : "Cédula"}
              value={client.rif}
              mono
            />
            {client.notes && (
              <div style={{ marginTop: 14 }}>
                <div className="studio-eyebrow" style={{ marginBottom: 6 }}>
                  Notas
                </div>
                <p
                  style={{
                    font: "500 13px/1.5 var(--f-sans)",
                    color: "var(--ink)",
                    margin: 0,
                  }}
                >
                  {client.notes}
                </p>
              </div>
            )}
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              Creado {formatDate(client.created_at)}
            </div>
          </section>

          {/* Perfil del cliente · qué falta para completar (SDD-0131) */}
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span className="studio-eyebrow">Perfil del cliente</span>
              <Badge
                tone={completeness.isComplete ? "success" : "warning"}
                size="md"
              >
                {completeness.isComplete
                  ? "Completo"
                  : `${completeness.doneCount}/${completeness.total}`}
              </Badge>
            </div>

            {/* Barra de progreso */}
            <div
              aria-hidden
              style={{
                height: 6,
                borderRadius: 999,
                background: "var(--bg-elevated)",
                overflow: "hidden",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: `${completeness.pct}%`,
                  height: "100%",
                  background: completeness.isComplete
                    ? "var(--success)"
                    : "var(--wine)",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {completeness.items.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 0",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 999,
                      color: item.done ? "var(--ink-inv)" : "var(--ink-mute)",
                      background: item.done ? "var(--success)" : "transparent",
                      border: item.done ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {item.done ? Icon.check(10) : null}
                  </span>
                  <span
                    style={{
                      font: item.done
                        ? "500 13px/1.4 var(--f-sans)"
                        : "600 13px/1.4 var(--f-sans)",
                      color: item.done ? "var(--ink-soft)" : "var(--ink)",
                    }}
                  >
                    {/* Estado accesible: el ✓/borde es aria-hidden; el lector lee
                        "completo"/"falta" para no depender solo de color/forma. */}
                    <span
                      style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: "hidden",
                        clip: "rect(0 0 0 0)",
                        whiteSpace: "nowrap",
                        border: 0,
                      }}
                    >
                      {item.done ? "Completo: " : "Falta: "}
                    </span>
                    {item.label}
                  </span>
                  {!item.done && (
                    <span
                      style={{
                        marginLeft: "auto",
                        font: "600 10.5px/1 var(--f-sans)",
                        color: "var(--wine)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      Falta
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: "12px 0 0",
              }}
            >
              {completeness.isComplete
                ? "El perfil tiene todos los datos para operar."
                : "Usa «Editar» para completar los datos que faltan; la foto y la verificación se cargan en sus paneles."}
            </p>
          </section>

          <PortalAccessCard
            clientId={client.id}
            markbox={client.markbox}
            email={client.email}
            access={portalAccess}
            approvedAt={portalApprovedAt}
          />

          <AdvisorAssignCard
            clientId={client.id}
            markbox={client.markbox}
            currentAdvisorId={client.advisor_id}
            advisors={advisors}
          />

          <DeliveryAddressesCard
            clientId={client.id}
            markbox={client.markbox}
            addresses={deliveryAddresses}
            cities={calcCities.map((c) => ({
              id: c.id,
              label: c.label,
              km: c.km,
              casco: c.casco,
            }))}
            lastMileParams={lastMileParams}
          />

          {showIdentityCard && (
            <IdentityVerificationCard
              clientId={client.id}
              markbox={client.markbox}
              name={client.name}
              docKind={client.doc_kind}
              rif={client.rif}
              docVerifyStatus={client.doc_verify_status}
              docVerifySource={client.doc_verify_source}
              docRegistryName={client.doc_registry_name}
              docVerifiedAt={client.doc_verified_at}
              photoUrl={identityPhotoUrl}
              autoEnabled={autoVerifyEnabled}
            />
          )}

          {/* Documentos del cliente (SDD-0049 · KYC/RIF/contratos) */}
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            <DocsPanel
              entityType="client"
              entityId={client.id}
              documents={dmsDocuments}
              title="Documentos · hub"
            />
          </section>
          </div>

          {/* Histórico de envíos */}
          <section
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 14,
              }}
            >
              <span className="studio-eyebrow">Historial de envíos</span>
              <span
                style={{
                  font: "500 12px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                {shipments.length}{" "}
                {shipments.length === 1 ? "envío" : "envíos"}
              </span>
            </div>

            {shipments.length === 0 ? (
              <p
                style={{
                  font: "500 13px/1.5 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: 0,
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                Sin envíos registrados con este Shipping Mark todavía.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {shipments.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/studio/tracking/${s.id}`}
                    className="studio-tracking-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 1fr 120px 100px",
                      gap: 10,
                      padding: "12px 8px",
                      borderTop: i > 0 ? "1px solid var(--border)" : 0,
                      alignItems: "center",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span
                      style={{
                        font: "700 12px/1 var(--f-mono)",
                        color: "var(--ink)",
                      }}
                    >
                      {s.code}
                    </span>
                    <div
                      style={{
                        font: "500 12px/1.4 var(--f-sans)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {s.origin ?? "?"} → {s.destination ?? "?"}
                    </div>
                    <span
                      style={{
                        font: "600 11px/1 var(--f-sans)",
                        color: "var(--ink)",
                      }}
                    >
                      {SERVICE_LABELS[s.shipment_service].primary}
                    </span>
                    <span
                      style={{
                        font: "500 11px/1 var(--f-sans)",
                        color: "var(--ink-soft)",
                        textAlign: "right",
                      }}
                    >
                      {formatDate(s.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </ClientDetailClient>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: mono
            ? "500 13px/1.3 var(--f-mono)"
            : "500 13px/1.4 var(--f-sans)",
          color: value ? "var(--ink)" : "var(--ink-mute)",
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
