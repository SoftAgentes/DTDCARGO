/**
 * MasterDataSection — sección "Master data" del admin (SDD-0125).
 *
 * Hub READ-ONLY de catálogos. La mayoría son enums de código (tiers) o ya se
 * gestionan en su propio módulo (servicios → /studio/servicios; ciudades →
 * /studio/admin/rutas). En vez de inventar un store nuevo, esta sección mapea
 * dónde vive cada catálogo y marca los que aún no existen como editables.
 *
 * Server-safe (sin hooks).
 */

import Link from "next/link";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { CLIENT_TIER_OPTIONS, tierBadgeTone } from "@/lib/studio/client-types";

const MANAGED_ELSEWHERE = [
  {
    title: "Servicios (LCL / FCL / DDP…)",
    sub: "Catálogo de servicios y su matriz de oferta",
    href: "/studio/servicios",
  },
  {
    title: "Ciudades & rutas",
    sub: "Catálogo VE + rutas de despacho",
    href: "/studio/admin/rutas",
  },
];

const NOT_YET = [
  "Segmentos de cliente",
  "Tipos de documento",
  "Estados del workflow",
  "HS codes (OMA)",
  "AES · arancel VE",
];

export function MasterDataSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Tiers de cliente (enum de código) */}
      <Card>
        <CardEyebrow>Tiers de cliente</CardEyebrow>
        <p style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 12px", maxWidth: "72ch" }}>
          Definidos en código. Se asignan por cliente desde el módulo Clientes.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CLIENT_TIER_OPTIONS.map((t) => (
            <div
              key={t.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
              }}
            >
              <Badge tone={tierBadgeTone(t.value)} size="sm">
                {t.label}
              </Badge>
              <code style={{ font: "600 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>{t.value}</code>
            </div>
          ))}
        </div>
      </Card>

      {/* Catálogos gestionados en su módulo */}
      <Card>
        <CardEyebrow>Se gestionan en su módulo</CardEyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {MANAGED_ELSEWHERE.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                padding: "12px 14px",
                textDecoration: "none",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{r.title}</span>
                <span style={{ display: "block", font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>{r.sub}</span>
              </span>
              <span style={{ color: "var(--wine)", flexShrink: 0, font: "600 12px/1 var(--f-sans)" }}>Abrir →</span>
            </Link>
          ))}
        </div>
      </Card>

      {/* Por implementar */}
      <section
        style={{
          background: "var(--bg-surface)",
          border: "2px dashed var(--border-strong)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-5) var(--s-6)",
        }}
      >
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Catálogos editables · por implementar
        </div>
        <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
          {NOT_YET.map((n) => (
            <span
              key={n}
              style={{
                padding: "6px 12px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-pill)",
                font: "600 11.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {n}
            </span>
          ))}
        </div>
        <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "12px 0 0", maxWidth: "62ch" }}>
          Hoy no existen como catálogo editable en DB. Cada uno necesita su propia spec (tabla + RLS + UI) antes de
          exponerse acá.
        </p>
      </section>
    </div>
  );
}

// ── Primitivas locales ────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
      }}
    >
      {children}
    </section>
  );
}

function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: 14 }}>
      {children}
    </div>
  );
}
