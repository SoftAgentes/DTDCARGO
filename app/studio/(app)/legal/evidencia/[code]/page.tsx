/**
 * Expediente imprimible de una aceptación legal (SDD-0067 · decisión #5).
 *
 * Server component, ADMIN-ONLY (patrón exacto de /studio/direccion y
 * /studio/legal: `user_tenants.role === 'admin'`, no-admin → redirect al
 * dashboard). Print-friendly: "PDF" = imprimir del navegador — el `@media
 * print` (patrón Reportes/Etiquetas) oculta el shell del Studio y deja SOLO el
 * expediente, con los tokens re-anclados a su valor light canónico (no son hex
 * inventados: son los valores de :root de tokens.css) para que dark mode no
 * sangre texto gris al papel.
 *
 * Contenido: encabezado DTD Cargo + todos los campos de evidencia (v2: incluye
 * user agent + declaración de comerciante + factura asociada) + verificación
 * de integridad (`hash_verified`, recomputado server-side con el MISMO
 * recompute del gate) + lista de docs con versión + metadata de generación.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { getAcceptanceEvidence } from "@/lib/studio/legal/queries";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Expediente de aceptación · DTD Studio" };
export const dynamic = "force-dynamic";

/** ISO → "dd/mm/aaaa hh:mm:ss (UTC)" — la evidencia se muestra en UTC. */
function fmtUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} (UTC)`;
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
  // "anywhere" corta solo cuando no queda otra (hash/UA/IP largos);
  // break-all partía también nombres humanos a mitad de palabra en papel.
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

export default async function EvidencePrintPage({
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

  // Admin-only (la capa legal es compliance del dueño) — mismo patrón que
  // /studio/direccion y /studio/legal.
  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  const evidence = await getAcceptanceEvidence(supabase, {
    tenantId: link.tenant_id,
    code,
  });

  if (!evidence) {
    return (
      <EmptyState
        eyebrow="Expediente"
        title="No existe esa aceptación."
        description={`No encontramos el acuse "${code}" en la bitácora legal de este tenant.`}
      />
    );
  }

  const a = evidence.acceptance;
  const generatedAt = new Date().toISOString();
  const generatedBy = userResp.user.email ?? userResp.user.id;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Acciones de pantalla — NO van al papel (data-print-hide). */}
      <div
        data-print-hide
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <a
          className="studio-btn studio-btn-ghost studio-btn-sm"
          href="/studio/legal"
        >
          ← Volver a Legal
        </a>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            className="studio-btn studio-btn-ghost studio-btn-sm"
            href={`/api/studio/legal/evidence/${encodeURIComponent(a.acceptance_code)}`}
            download
          >
            Descargar JSON
          </a>
          <PrintButton />
        </div>
      </div>

      {/* El expediente — lo ÚNICO visible al imprimir. */}
      <div
        id="legal-expediente"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 28,
        }}
      >
        {/* Encabezado DTD Cargo */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            paddingBottom: 16,
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
                marginTop: 4,
              }}
            >
              Expediente de aceptación legal
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={FIELD_LABEL}>Acuse</div>
            <div
              style={{
                font: "800 18px/1.2 var(--f-mono)",
                color: "var(--wine)",
                marginTop: 3,
              }}
            >
              {a.acceptance_code}
            </div>
          </div>
        </div>

        {/* Verificación de integridad */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "12px 14px",
            background: evidence.hash_verified
              ? "var(--success-bg)"
              : "var(--danger-bg)",
            borderRadius: "var(--r-md)",
            margin: "16px 0",
          }}
        >
          <span
            style={{
              font: "800 12px/1.4 var(--f-sans)",
              color: evidence.hash_verified ? "var(--success)" : "var(--danger)",
              flexShrink: 0,
            }}
          >
            {evidence.hash_verified ? "✓ INTEGRIDAD VERIFICADA" : "✗ NO VERIFICA"}
          </span>
          <span style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink)" }}>
            {evidence.hash_verified
              ? "El hash SHA-256 fue recomputado server-side desde los campos de este registro al generar el expediente y coincide con el sellado (evidencia íntegra, sin alteraciones)."
              : "El hash recomputado desde los campos del registro NO coincide con el sellado: la evidencia fue alterada o está corrupta. NO usar como prueba sin revisión."}
          </span>
        </div>

        {/* Campos de evidencia */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            columnGap: 24,
          }}
        >
          <Field label="Cliente" value={evidence.client?.name ?? "—"} />
          <Field label="Shipping Mark" value={a.client_markbox ?? "—"} />
          <Field label="Orden / estimado" value={a.quote_code ?? "—"} />
          <Field label="Factura asociada (metadato)" value={a.invoice_id ?? "—"} />
          <Field label="Volumen (CBM)" value={a.cbm ?? "—"} />
          <Field label="Peso (kg)" value={a.weight_kg ?? "—"} />
          <Field label="Total aceptado (USD)" value={a.total_usd ?? "—"} />
          <Field label="Aceptado el" value={fmtUtc(a.accepted_at)} />
          <Field label="Dirección IP" value={a.ip ?? "—"} />
          <Field
            label="Declaración de comerciante"
            value={
              a.merchant_declaration
                ? "Sí — declaró actuar como comerciante, empresa o emprendedor con fines de lucro"
                : "No"
            }
          />
        </div>
        <Field label="User agent" value={a.user_agent ?? "—"} />

        {/* Documentos aceptados */}
        <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
          <div style={FIELD_LABEL}>Documentos aceptados (versión sellada)</div>
          {a.docs.length === 0 ? (
            <div style={FIELD_VALUE}>—</div>
          ) : (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {a.docs.map((d, i) => (
                <li
                  key={i}
                  style={{ font: "600 12.5px/1.7 var(--f-mono)", color: "var(--ink)" }}
                >
                  {d.key} · {d.version}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field label="Huella de integridad (SHA-256)" value={a.hash ?? "—"} />

        {/* Pie probatorio + metadata de generación */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            font: "500 10.5px/1.6 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Evidencia v2 (SDD-0067): el hash cubre Shipping Mark, orden, documentos
          con versión, medida (CBM/kg/USD), IP, user agent, declaración de
          comerciante y fecha/hora del sello — todos server-sellados. La factura
          asociada es metadato forense fuera del hash. Registro append-only
          (inmutable a nivel de base de datos), conforme a la Ley sobre Mensajes
          de Datos y Firmas Electrónicas.
          <br />
          Expediente generado el {fmtUtc(generatedAt)} por {generatedBy}.
        </div>
      </div>

      {/* Print: ocultar el shell del Studio y dejar SOLO el expediente (patrón
          Reportes). Tokens re-anclados al valor light canónico de tokens.css. */}
      <style>{`
        @media print {
          [data-print-hide] { display: none !important; }
          body * { visibility: hidden !important; }
          #legal-expediente, #legal-expediente * { visibility: visible !important; }
          #legal-expediente {
            --ink: #0F1E3D;
            --ink-soft: #6B6B6B;
            --wine: #7F0F1A;
            --border: #E8E6E2;
            --bg-surface: #FFFFFF;
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
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
