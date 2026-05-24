/**
 * CustomsTaxTab — resumen YTD de impuestos pagados, con bars proportional.
 */

import type { TaxBreakdown } from "@/lib/studio/customs-queries";

export function CustomsTaxTab({ breakdown }: { breakdown: TaxBreakdown }) {
  const items: { label: string; value: number; color: string }[] = [
    { label: "Aranceles de importación", value: breakdown.duty, color: "var(--wine)" },
    { label: "IGTF 3%", value: breakdown.igtf, color: "var(--warning)" },
    { label: "IVA 16%", value: breakdown.iva, color: "var(--info)" },
    { label: "Honorarios agente aduanal", value: breakdown.agentFee, color: "var(--success)" },
  ];

  const total = breakdown.total;

  if (total === 0) {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-10) var(--s-8)",
          textAlign: "center",
          color: "var(--ink-soft)",
        }}
      >
        <div
          style={{
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: "var(--s-3)",
          }}
        >
          Sin pagos registrados YTD
        </div>
        <div
          className="studio-display"
          style={{ fontSize: 20, color: "var(--ink)" }}
        >
          Aún no hay impuestos pagados este año.
        </div>
        <p
          style={{
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            maxWidth: "52ch",
            margin: "var(--s-3) auto 0",
          }}
        >
          Cuando creés trámites con costos cargados, el resumen se calcula
          automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "20px 22px",
      }}
    >
      <div className="studio-eyebrow" style={{ marginBottom: 18 }}>
        Resumen YTD {new Date().getFullYear()}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((item) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  gap: 12,
                }}
              >
                <span
                  style={{
                    font: "600 13px/1 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  {item.label}
                </span>
                <code
                  style={{
                    font: "800 14px/1 var(--f-mono)",
                    color: item.color,
                  }}
                >
                  ${item.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </code>
              </div>
              <div
                style={{
                  height: 8,
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-pill)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: item.color,
                    borderRadius: "var(--r-pill)",
                    transition: "width var(--dur) var(--ease)",
                  }}
                />
              </div>
              <div
                style={{
                  font: "500 10.5px/1.3 var(--f-mono)",
                  color: "var(--ink-mute)",
                  marginTop: 3,
                  textAlign: "right",
                }}
              >
                {pct.toFixed(1)}% del total
              </div>
            </div>
          );
        })}

        <div
          style={{
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 4,
          }}
        >
          <span
            className="studio-display"
            style={{
              fontSize: 14,
              color: "var(--ink)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Total pagado SENIAT
          </span>
          <code
            style={{
              font: "900 22px/1 var(--f-mono)",
              color: "var(--wine)",
              letterSpacing: "-0.01em",
            }}
          >
            ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </code>
        </div>
      </div>
    </div>
  );
}
