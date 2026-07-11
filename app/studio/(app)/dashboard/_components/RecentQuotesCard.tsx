/**
 * RecentQuotesCard · Dashboard (SDD-0014)
 *
 * Server component que renderiza la card "Estimados recientes" del
 * dashboard. Server porque no necesita interacción client (los <Link>
 * de Next se hidratan solos).
 */

import Link from "next/link";
import { statusBadgeTone, statusLabel } from "@/lib/studio/quote-types";
import type { RecentQuoteRow } from "@/lib/studio/dashboard-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}

export function RecentQuotesCard({ quotes }: { quotes: RecentQuoteRow[] }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span className="studio-eyebrow">Estimados recientes</span>
        <Link
          href="/studio/cotizador"
          style={{
            font: "600 11.5px/1 var(--f-sans)",
            color: "var(--wine-text)",
            textDecoration: "none",
          }}
        >
          Ver todas →
        </Link>
      </header>

      {quotes.length === 0 ? (
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            padding: "var(--s-6) var(--s-5)",
            textAlign: "center",
          }}
        >
          Aún no hay estimados.{" "}
          <Link
            href="/studio/cotizador"
            style={{
              color: "var(--wine-text)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Crear la primera →
          </Link>
        </p>
      ) : (
        <div>
          {quotes.map((q, i) => (
            <Link
              key={q.id}
              href={`/studio/cotizador/${q.quote_code}`}
              className="studio-tracking-row"
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr auto auto",
                gap: 12,
                padding: "var(--s-3) var(--s-5)",
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
                  letterSpacing: "0.02em",
                }}
              >
                {q.quote_code}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    font: "600 12.5px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {q.client_name}
                </div>
                <div
                  style={{
                    font: "500 10.5px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 3,
                  }}
                >
                  {q.client_markbox} · {formatDate(q.created_at)}
                </div>
              </div>
              <Badge tone={statusBadgeTone(q.status)} size="sm" dot>
                {statusLabel(q.status)}
              </Badge>
              <span
                style={{
                  font: "800 12.5px/1 var(--f-mono)",
                  color: "var(--wine-text)",
                  textAlign: "right",
                  minWidth: 70,
                }}
              >
                ${Number(q.total_usd).toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
