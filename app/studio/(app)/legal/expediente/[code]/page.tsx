/**
 * Expediente de defensa legal de UNA operación (SDD-0070 · SDD-E del handoff).
 *
 * Server component. Acceso: admin + capability `view_defense_file` (commercial/
 * support, SDD-0139) → el asesor de reclamos lo genera él mismo. Print-friendly:
 * "PDF" = imprimir del navegador — el `@media print` (patrón Reportes/Etiquetas)
 * oculta el shell del Studio y deja SOLO el expediente, con los tokens
 * re-anclados a su valor light canónico (no son hex inventados: son los valores
 * de :root de tokens.css) para que dark mode no sangre al papel.
 *
 * Reúne en 1 documento la cadena de evidencia del envío (dispersa hoy en 5
 * módulos): aceptación de T&C con hash verificado, packing/compras, fotos de
 * almacén origen, cronología y prueba de entrega (POD). Un ÍNDICE DE
 * COMPLETITUD al tope dice qué piezas existen. Cada sección es FAIL-SOFT: si no
 * hay datos renderiza "Sin registros" en vez de romper (es evidencia: se muestra
 * lo que hay).
 *
 * Acceso restringido porque la evidencia tiene PII (IP/user_agent de la
 * aceptación; nombre/cédula del receptor en el POD). RLS por tenant = 2ª capa.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { SERVICE_LABELS, STATUS_LABELS } from "@/lib/shared/shipment-public";
import type {
  ShipmentService,
  ShipmentStatus,
} from "@/lib/shared/shipment-public";
import { getDefenseFile } from "@/lib/studio/legal/expediente-queries";
import {
  summarizeCompleteness,
  type DefensePhoto,
} from "@/lib/studio/legal/expediente-types";
import { canSpecial } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Expediente de defensa · DTD Studio" };
export const dynamic = "force-dynamic";

/** ISO → "dd/mm/aaaa hh:mm:ss (UTC)" — la evidencia se muestra en UTC. */
function fmtUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} (UTC)`;
}

/** ISO → "dd/mm/aaaa" (fechas de día, p. ej. recepción CN). */
function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function serviceLabel(service: string): string {
  return SERVICE_LABELS[service as ShipmentService]?.primary ?? service;
}
function statusLabel(status: string): string {
  return STATUS_LABELS[status as ShipmentStatus] ?? status;
}

const FIELD_LABEL: React.CSSProperties = {
  font: "700 9.5px/1.3 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const FIELD_VALUE: React.CSSProperties = {
  font: "600 12.5px/1.5 var(--f-mono)",
  color: "var(--ink)",
  overflowWrap: "anywhere",
  margin: "3px 0 0",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={FIELD_LABEL}>{label}</div>
      <div style={FIELD_VALUE}>{value}</div>
    </div>
  );
}

/** Encabezado de sección con su contador (o "Sin registros"). */
function SectionHead({
  n,
  title,
  count,
}: {
  n: number;
  title: string;
  count: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "var(--s-3)",
        marginBottom: "var(--s-3)",
        paddingBottom: "var(--s-2)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="studio-display"
        style={{ font: "800 14px/1.2 var(--f-display)", color: "var(--ink)" }}
      >
        {n}. {title}
      </div>
      <div
        style={{
          font: "600 10.5px/1 var(--f-sans)",
          color: count > 0 ? "var(--success)" : "var(--ink-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
        }}
      >
        {count > 0 ? `${count} ${count === 1 ? "registro" : "registros"}` : "Sin registros"}
      </div>
    </div>
  );
}

/** Caja "Sin registros" de una sección vacía (fail-soft, no rompe). */
function EmptySection({ text }: { text: string }) {
  return (
    <div
      style={{
        font: "500 12px/1.5 var(--f-sans)",
        color: "var(--ink-soft)",
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-md)",
      }}
    >
      {text}
    </div>
  );
}

/** Grid de fotos firmadas; la url vacía muestra un placeholder textual. */
function PhotoGrid({ photos }: { photos: DefensePhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 10,
        marginTop: 10,
      }}
    >
      {photos.map((ph, i) => (
        <figure key={`${ph.path}-${i}`} style={{ margin: 0 }}>
          {ph.url ? (
            // Signed URL de storage privado (TTL 1h), no optimizable por
            // next/image; igual que el resto de los expedientes imprimibles.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ph.url}
              alt={ph.label}
              style={{
                width: "100%",
                height: 130,
                objectFit: "cover",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: 130,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                font: "600 10.5px/1.3 var(--f-sans)",
                color: "var(--ink)",
                textAlign: "center",
                padding: "var(--s-2)",
              }}
            >
              Imagen no disponible
            </div>
          )}
          <figcaption
            style={{
              font: "500 9.5px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: "var(--s-1)",
              textAlign: "center",
            }}
          >
            {ph.label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

const CARD: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "var(--r-md)",
  padding: 14,
  background: "var(--bg-surface)",
};

const SUBLABEL: React.CSSProperties = {
  font: "600 11px/1.4 var(--f-mono)",
  color: "var(--ink-soft)",
};

export default async function DefenseFilePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw ?? "").trim();

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pídele a un admin que te agregue al equipo."
      />
    );
  }

  // Acceso: admin siempre; además commercial/support vía la capability
  // `view_defense_file` (SDD-0139) — el asesor que atiende el reclamo genera el
  // expediente él mismo (decisión founder 2026-07-19). El resto de la capa legal
  // (/studio/legal, /studio/legal/evidencia) sigue admin-only.
  if (
    link.role !== "admin" &&
    !canSpecial(link.role as StudioUserRole, "view_defense_file")
  ) {
    redirect("/studio/dashboard");
  }

  const file = await getDefenseFile(supabase, {
    tenantId: link.tenant_id,
    shipmentCode: code,
  });

  if (!file) {
    return (
      <EmptyState
        eyebrow="Expediente de defensa"
        title="No existe ese envío."
        description={`No encontramos el envío "${code}" en este tenant.`}
      />
    );
  }

  const s = file.shipment;
  const summary = summarizeCompleteness(file);
  const generatedBy = userResp.user.email ?? userResp.user.id;

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Acciones de pantalla — NO van al papel (data-print-hide). */}
      <div
        data-print-hide
        style={{
          display: "flex",
          gap: "var(--s-2)",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "var(--s-4)",
        }}
      >
        <a
          className="studio-btn studio-btn-ghost studio-btn-sm"
          href={`/studio/tracking/${encodeURIComponent(s.id)}`}
        >
          ← Volver al envío
        </a>
        <PrintButton />
      </div>

      {/* El expediente — lo ÚNICO visible al imprimir. */}
      <div
        id="legal-expediente"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {/* Encabezado DTD Cargo */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "var(--s-4)",
            paddingBottom: "var(--s-4)",
            borderBottom: "2px solid var(--ink)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className="studio-display"
              style={{ font: "800 20px/1.1 var(--f-display)", color: "var(--ink)" }}
            >
              DTD Cargo
            </div>
            <div
              style={{
                font: "600 10.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: "var(--s-1)",
              }}
            >
              Expediente de defensa · operación
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={FIELD_LABEL}>Envío</div>
            <div
              style={{
                font: "800 18px/1.2 var(--f-mono)",
                color: "var(--wine-text)",
                marginTop: 3,
              }}
            >
              {s.code}
            </div>
          </div>
        </div>

        {/* Índice de completitud — qué prueba existe de un vistazo. */}
        <div>
          <div style={{ ...FIELD_LABEL, marginBottom: "var(--s-2)" }}>
            Índice de completitud · {summary.count} de 5 piezas
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--s-2)",
            }}
          >
            {summary.present.map((label) => (
              <span
                key={label}
                style={{
                  font: "600 11px/1 var(--f-sans)",
                  color: "var(--success)",
                  background: "var(--success-bg)",
                  borderRadius: "var(--r-sm)",
                  padding: "6px 10px",
                }}
              >
                ✓ {label}
              </span>
            ))}
            {summary.missing.map((label) => (
              <span
                key={label}
                style={{
                  font: "600 11px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  padding: "6px 10px",
                }}
              >
                Ausente · {label}
              </span>
            ))}
          </div>
        </div>

        {/* Datos del envío */}
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: "var(--s-6)",
            }}
          >
            <Field label="Cliente" value={s.clientName ?? "—"} />
            <Field label="Shipping Mark" value={s.markbox ?? "—"} />
            <Field label="Servicio" value={serviceLabel(s.service)} />
            <Field label="Estado actual" value={statusLabel(s.status)} />
            <Field label="Origen" value={s.origin ?? "—"} />
            <Field label="Destino" value={s.destination ?? "—"} />
            <Field label="Creado el" value={fmtUtc(s.createdAt)} />
            <Field label="Entregado el" value={fmtUtc(s.deliveredAt)} />
          </div>
          {s.podSignedBy && (
            <Field label="Recibido por (envío)" value={s.podSignedBy} />
          )}
        </div>

        {/* 1 · Aceptación de términos (hash verificado, heredado de 0067) */}
        <section>
          <SectionHead n={1} title="Aceptación de términos" count={file.acceptances.items.length} />
          {file.acceptances.items.length === 0 ? (
            <EmptySection text="Sin aceptaciones de T&C registradas para esta operación." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              {file.acceptances.items.map((ev, i) => {
                const a = ev.acceptance;
                const vigente = i === 0; // la query las trae desc por accepted_at
                return (
                  <div key={a.id} style={CARD}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <code style={{ font: "700 12px/1 var(--f-mono)", color: "var(--wine-text)" }}>
                        {a.acceptance_code}
                      </code>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {vigente && (
                          <span
                            style={{
                              font: "700 9px/1 var(--f-sans)",
                              color: "var(--ink-inv)",
                              background: "var(--wine)",
                              borderRadius: "var(--r-sm)",
                              padding: "4px 7px",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            Vigente
                          </span>
                        )}
                        <span
                          style={{
                            font: "700 9px/1 var(--f-sans)",
                            color: ev.hash_verified ? "var(--success)" : "var(--danger)",
                            background: ev.hash_verified ? "var(--success-bg)" : "var(--danger-bg)",
                            borderRadius: "var(--r-sm)",
                            padding: "4px 7px",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {ev.hash_verified ? "✓ Integridad verificada" : "✗ No verifica"}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        columnGap: "var(--s-5)",
                      }}
                    >
                      <Field label="Documentos aceptados" value={a.docs.length > 0 ? a.docs.map((d) => `${d.key} ${d.version}`).join(" · ") : "—"} />
                      <Field label="Aceptado el" value={fmtUtc(a.accepted_at)} />
                      <Field label="Medida (CBM / kg / USD)" value={`${a.cbm ?? 0} / ${a.weight_kg ?? 0} / ${a.total_usd ?? 0}`} />
                      <Field label="Dirección IP" value={a.ip ?? "—"} />
                      <Field label="Declaración de comerciante" value={a.merchant_declaration ? "Sí" : "No"} />
                      <Field label="Factura asociada (metadato)" value={a.invoice_id ?? "—"} />
                    </div>
                    <Field label="User agent" value={a.user_agent ?? "—"} />
                    <Field label="Huella de integridad (SHA-256)" value={a.hash ?? "—"} />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 2 · Packing y compras (prealertas + documentos) */}
        <section>
          <SectionHead n={2} title="Packing y compras" count={file.packing.items.length} />
          {file.packing.items.length === 0 ? (
            <EmptySection text="Sin compras (prealertas) ni documentos de packing registrados." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              {file.packing.items.map((p) => (
                <div key={p.id} style={CARD}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: "var(--s-1)",
                    }}
                  >
                    <code style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}>
                      {p.code}
                    </code>
                    <span style={SUBLABEL}>
                      {p.boxes != null ? `${p.boxes} cajas` : "—"}
                      {p.trackingCn ? ` · ${p.trackingCn}` : ""}
                    </span>
                  </div>
                  <div style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink)" }}>
                    {p.description || "—"}
                  </div>
                  {p.documents.length === 0 ? (
                    <div style={{ ...SUBLABEL, marginTop: "var(--s-2)" }}>Sin documentos subidos.</div>
                  ) : (
                    <PhotoGrid
                      photos={p.documents.map((d) => ({
                        path: d.path,
                        url: d.url,
                        label: `${d.docType || "doc"} · ${d.fileName || ""}`.trim(),
                      }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3 · Fotos de origen (almacén CN) */}
        <section>
          <SectionHead n={3} title="Fotos de origen (almacén CN)" count={file.originPhotos.items.length} />
          {file.originPhotos.items.length === 0 ? (
            <EmptySection text="Sin recepciones de almacén CN registradas para esta operación." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              {file.originPhotos.items.map((r) => (
                <div key={r.receiptId} style={CARD}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <code style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}>
                      {r.receiptCode}
                    </code>
                    <span style={SUBLABEL}>
                      {r.supplierName ? `${r.supplierName} · ` : ""}
                      {r.boxes != null ? `${r.boxes} cajas · ` : ""}
                      {fmtDay(r.receivedAt)}
                    </span>
                  </div>
                  {r.photos.length === 0 ? (
                    <div style={{ ...SUBLABEL, marginTop: "var(--s-2)" }}>Sin fotos en esta recepción.</div>
                  ) : (
                    <PhotoGrid photos={r.photos} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4 · Cronología de eventos */}
        <section>
          <SectionHead n={4} title="Cronología de eventos" count={file.timeline.items.length} />
          {file.timeline.items.length === 0 ? (
            <EmptySection text="Sin eventos en la cronología de esta operación." />
          ) : (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "190px 150px 1fr",
                  gap: "var(--s-3)",
                  padding: "9px 14px",
                  background: "var(--bg-elevated)",
                  font: "700 9px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                <span>Fecha / hora</span>
                <span>Estado</span>
                <span>Nota</span>
              </div>
              {file.timeline.items.map((e, i) => (
                <div
                  key={e.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "190px 150px 1fr",
                    gap: "var(--s-3)",
                    padding: "10px 14px",
                    alignItems: "start",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  }}
                >
                  <span style={{ font: "600 11px/1.3 var(--f-mono)", color: "var(--ink-soft)" }}>
                    {fmtUtc(e.occurredAt)}
                  </span>
                  <span style={{ font: "600 11.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                    {statusLabel(e.status)}
                  </span>
                  <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                    {e.note || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5 · Prueba de entrega (POD) */}
        <section>
          <SectionHead n={5} title="Prueba de entrega (POD)" count={file.pod.items.length} />
          {file.pod.items.length === 0 ? (
            <EmptySection text="Sin prueba de entrega (POD) registrada para esta operación." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              {file.pod.items.map((p) => (
                <div key={p.id} data-pod-card style={CARD}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: "var(--s-1)",
                    }}
                  >
                    <code style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}>
                      {p.orderCode ?? "POD"}
                    </code>
                    <span style={SUBLABEL}>{fmtUtc(p.createdAt)}</span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      columnGap: "var(--s-5)",
                    }}
                  >
                    <Field label="Recibido por" value={p.receivedBy || "—"} />
                    <Field label="Cédula del receptor" value={p.receivedDoc ?? "—"} />
                  </div>
                  {p.notes && <Field label="Notas" value={p.notes} />}
                  <PhotoGrid photos={p.photos} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pie probatorio + metadata de generación */}
        <div
          style={{
            paddingTop: "var(--s-3)",
            borderTop: "1px solid var(--border)",
            font: "500 10.5px/1.6 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Expediente de defensa consolidado a partir de los registros del sistema
          (aceptación de términos, compras, almacén origen, cronología y prueba de
          entrega) de la operación {s.code}. Cada pieza se muestra tal como está
          registrada; las ausentes se indican en el índice de completitud. La
          integridad de cada aceptación se recomputa server-side (SHA-256) al
          generar el expediente.
          <br />
          Expediente generado el {fmtUtc(file.generatedAt)} por {generatedBy}.
        </div>
      </div>

      {/* Print: ocultar el shell del Studio y dejar SOLO el expediente (patrón
          Reportes / evidencia 0067). Tokens re-anclados al valor light canónico
          de tokens.css (no son hex inventados) para que dark mode no sangre. */}
      <style>{`
        @media print {
          [data-print-hide] { display: none !important; }
          body * { visibility: hidden !important; }
          #legal-expediente, #legal-expediente * { visibility: visible !important; }
          #legal-expediente {
            --ink: #0F1E3D;
            --ink-soft: #6B6B6B;
            --ink-inv: #FBFAF7;
            --wine: #7F0F1A;
            --border: #E8E6E2;
            --bg-surface: #FFFFFF;
            --bg-elevated: #F2F0EC;
            --success: #1F8A5B;
            --danger: #A8323E;
            --success-bg: rgba(31,138,91,0.10);
            --danger-bg: rgba(168,50,62,0.10);
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            border-radius: 0;
            padding: 0;
          }
          /* Documento legal multipágina: no partir secciones, fotos ni cards
             de POD entre páginas (una firma/foto probatoria cortada resta
             validez al expediente). */
          #legal-expediente section,
          #legal-expediente figure,
          #legal-expediente [data-pod-card] {
            break-inside: avoid;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
