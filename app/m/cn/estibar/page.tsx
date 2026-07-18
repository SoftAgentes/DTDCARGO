/**
 * /m/cn/estibar — contenedores abiertos para estibar (SDD-0152).
 *
 * Server component: lista las consolidaciones en `consolidando` del tenant del
 * operario, con cuántas cajas ya se estibaron. Es la entrada a
 * /m/cn/estibar/[consolidationId].
 *
 * El operario NO es `auth.users` → createAdminClient (service_role) con filtro
 * de tenant EXPLÍCITO (regla de app/m/CLAUDE.md: no depender de RLS acá).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import { CONTAINER_TYPES, isContainerTypeCode } from "@/lib/studio/naviera/types";
import { AbrirContenedorButton } from "./_components/AbrirContenedorButton";

/** Etiqueta legible del tipo de contenedor (20' GP…), o el código crudo / "—". */
function containerTypeLabel(code: string | null): string {
  if (!code) return "—";
  return isContainerTypeCode(code) ? CONTAINER_TYPES[code].label : code;
}

export const metadata = { title: "Estibar" };
export const dynamic = "force-dynamic";

export default async function EstibarIndexPage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/cn/login");
  if (operario.region !== "cn") redirect("/m/cn");

  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("consolidations")
    .select("id, ref, container_type, container_no, status")
    .eq("tenant_id", operario.tenant_id)
    .eq("status", "consolidando")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const consolidations =
    (rows as {
      id: string;
      ref: string;
      container_type: string | null;
      container_no: string | null;
    }[] | null) ?? [];

  // Solicitudes propias esperando autorización de la oficina (SDD-0157).
  const { data: requestRows } = await admin
    .from("consolidations")
    .select("id, container_type, requested_at")
    .eq("tenant_id", operario.tenant_id)
    .eq("status", "solicitada")
    .is("deleted_at", null)
    .order("requested_at", { ascending: false })
    .limit(20);

  const requests =
    (requestRows as {
      id: string;
      container_type: string | null;
      requested_at: string | null;
    }[] | null) ?? [];

  // Cuántas cajas ya están estibadas en cada uno
  const counts = new Map<string, number>();
  if (consolidations.length > 0) {
    const { data: pos } = await admin
      .from("consolidation_box_positions")
      .select("consolidation_id")
      .in(
        "consolidation_id",
        consolidations.map((c) => c.id),
      )
      .is("unstuffed_at", null)
      .limit(5000);

    for (const p of (pos as { consolidation_id: string }[] | null) ?? []) {
      counts.set(p.consolidation_id, (counts.get(p.consolidation_id) ?? 0) + 1);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-sidebar)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 12px)",
          padding: "12px 14px",
          borderBottom: "1px solid var(--border-inv)",
        }}
      >
        <Link
          href="/m/cn"
          style={{
            font: "600 10px/1.4 var(--f-sans)",
            color: "var(--ink-side-soft)",
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          ← Mi día
        </Link>
        <h1 style={{ margin: 0, font: "800 16px/1.3 var(--f-sans)", color: "var(--ink-side-strong)" }}>
          Estibar contenedor
        </h1>
        <p style={{ margin: 0, font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-side-soft)" }}>
          Escanea cada caja al subirla y marca dónde la pusiste.
        </p>
      </header>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Abrir contenedor (SDD-0157): siempre visible, arriba de todo. */}
        <AbrirContenedorButton variant="inline" />

        {/* Solicitudes esperando autorización de la oficina. */}
        {requests.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <span
              style={{
                font: "700 10px/1.4 var(--f-sans)",
                color: "var(--ink-side-soft)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Esperando autorización
            </span>
            {requests.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  minHeight: 56,
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-inv)",
                  border: "1px dashed var(--border-inv)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "700 13px/1.3 var(--f-sans)",
                      color: "var(--ink-side-strong)",
                    }}
                  >
                    Contenedor {containerTypeLabel(r.container_type)}
                  </div>
                  <div
                    style={{
                      font: "500 11px/1.3 var(--f-sans)",
                      color: "var(--ink-side-soft)",
                    }}
                  >
                    Pediste abrirlo · la oficina lo tiene que autorizar
                  </div>
                </div>
                <span
                  style={{
                    font: "700 10px/1 var(--f-sans)",
                    color: "var(--ink-side-soft)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    flexShrink: 0,
                  }}
                >
                  Pendiente
                </span>
              </div>
            ))}
          </div>
        )}

        {consolidations.length === 0 ? (
          <div style={{ paddingTop: 24 }}>
            <EmptyState
              eyebrow="Sin contenedores"
              title="No hay nada abierto para estibar"
              description="Abre un contenedor acá arriba (la oficina lo autoriza) o espera a que la oficina abra uno en consolidación."
              action={<AbrirContenedorButton variant="block" />}
            />
          </div>
        ) : (
          consolidations.map((c) => {
            const n = counts.get(c.id) ?? 0;
            return (
              <Link
                key={c.id}
                href={`/m/cn/estibar/${c.id}`}
                style={{
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  minHeight: 60,
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-inv)",
                  border: "1px solid var(--border-inv)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "700 14px/1.3 var(--f-mono)",
                      color: "var(--ink-side-strong)",
                    }}
                  >
                    {c.ref}
                  </div>
                  <div
                    style={{
                      font: "500 11px/1.3 var(--f-sans)",
                      color: "var(--ink-side-soft)",
                    }}
                  >
                    {c.container_type ?? "—"}
                    {c.container_no ? ` · ${c.container_no}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span
                    style={{
                      font: "700 12px/1 var(--f-mono)",
                      color: "var(--ink-side)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {n} {n === 1 ? "caja" : "cajas"}
                  </span>
                  <span style={{ color: "var(--ink-side-soft)" }}>{Icon.chevR(16)}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
