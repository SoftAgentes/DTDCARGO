"use client";

/**
 * PackingListDrawer — el equipo LEE el packing list + factura que el proveedor
 * envió desde /p/{token} (SDD-0096 · PORT-2). Solo lectura: cabecera (folio,
 * versión, moneda, fecha), contacto del proveedor (snapshot), nota, la tabla de
 * mercancía y los totales autoritativos. Sin acciones que muten.
 */

import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Badge } from "@/app/studio/_components/ui/Badge";
import type {
  PackingListRow,
  PackingListSubmission,
} from "@/lib/studio/prealertas/packlist-form";

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  RMB: "¥",
  EUR: "€",
};

function n(v: number, frac = 2): string {
  return v.toLocaleString("es-VE", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const label: React.CSSProperties = {
  font: "700 10px/1 var(--f-sans)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  marginBottom: 5,
  display: "block",
};

const ROW_GRID = "minmax(140px,1.6fr) 52px 56px 74px 84px 66px 70px";

export function PackingListDrawer({
  submission,
  prealertaCode,
  onClose,
}: {
  submission: PackingListSubmission;
  prealertaCode: string | null;
  onClose: () => void;
}) {
  const sym = CURRENCY_SYMBOL[submission.currency] ?? "";
  const money = (v: number) => `${sym}${n(v)}`;

  return (
    <DrawerShell
      title={submission.folio ?? "Packing list"}
      subtitle={`Enviado por el proveedor · cliente ${submission.client_markbox}`}
      onClose={onClose}
      pending={false}
      width={720}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
        {/* Cabecera */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <span style={label}>Compra</span>
            <code
              style={{ font: "700 12px/1.3 var(--f-mono)", color: "var(--wine)" }}
            >
              {prealertaCode ?? "—"}
            </code>
          </div>
          <div>
            <span style={label}>Versión</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink)" }}>
                v{submission.version_no}
              </span>
              {submission.is_current ? (
                <Badge tone="success" size="sm">
                  Vigente
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  Histórica
                </Badge>
              )}
            </div>
          </div>
          <div>
            <span style={label}>Fecha del documento</span>
            <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {fmtDate(submission.doc_date)}
            </span>
          </div>
          <div>
            <span style={label}>Moneda</span>
            <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {submission.currency}
            </span>
          </div>
        </div>

        {/* Contacto del proveedor (snapshot) */}
        <div
          style={{
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-sm)",
            padding: "12px 14px",
            marginBottom: 20,
          }}
        >
          <span style={label}>Proveedor</span>
          <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {submission.supplier_company || "Sin empresa declarada"}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 16px",
              marginTop: 6,
              font: "500 11.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            {submission.supplier_contact && <span>{submission.supplier_contact}</span>}
            {submission.supplier_email && <span>{submission.supplier_email}</span>}
            {submission.supplier_wechat && (
              <span>WeChat {submission.supplier_wechat}</span>
            )}
            {submission.supplier_phone && <span>Tel {submission.supplier_phone}</span>}
          </div>
        </div>

        {submission.supplier_note && (
          <div style={{ marginBottom: 20 }}>
            <span style={label}>Nota del proveedor</span>
            <p
              style={{
                font: "500 12.5px/1.5 var(--f-sans)",
                color: "var(--ink)",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {submission.supplier_note}
            </p>
          </div>
        )}

        {/* Tabla de mercancía */}
        <span style={label}>Mercancía ({submission.rows.length})</span>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            overflow: "hidden",
            marginTop: 6,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: ROW_GRID,
              gap: 8,
              padding: "9px 14px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 9.5px/1.2 var(--f-sans)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Artículo</span>
            <span style={{ textAlign: "right" }}>Cajas</span>
            <span style={{ textAlign: "right" }}>Uds</span>
            <span style={{ textAlign: "right" }}>Precio</span>
            <span style={{ textAlign: "right" }}>Monto</span>
            <span style={{ textAlign: "right" }}>Kg</span>
            <span style={{ textAlign: "right" }}>CBM</span>
          </div>
          {submission.rows.length === 0 ? (
            <div
              style={{
                padding: "16px 14px",
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              El proveedor no cargó filas de mercancía en este envío.
            </div>
          ) : (
            submission.rows.map((r, i) => <PackingRow key={i} r={r} i={i} sym={sym} />)
          )}

          {/* Totales */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: ROW_GRID,
              gap: 8,
              padding: "11px 14px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                font: "800 10px/1 var(--f-mono)",
                color: "var(--ink-soft)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Totales
            </span>
            <TotalCell v={n(submission.totals.ctns, 0)} />
            <TotalCell v={n(submission.totals.qty, 0)} />
            <span />
            <TotalCell v={money(submission.totals.amount)} strong />
            <TotalCell v={n(submission.totals.weight)} />
            <TotalCell v={n(submission.totals.cbm, 3)} />
          </div>
        </div>

        <p
          style={{
            font: "500 11px/1.5 var(--f-mono)",
            color: "var(--ink-mute)",
            margin: "14px 0 0",
          }}
        >
          Recibido {fmtDate(submission.created_at)} · totales calculados por el
          sistema desde las filas.
        </p>
      </div>
    </DrawerShell>
  );
}

function PackingRow({ r, i, sym }: { r: PackingListRow; i: number; sym: string }) {
  const title = r.es || r.zh || r.code || r.brand || "—";
  const subtitle = [r.brand, r.code, r.zh && r.es ? r.zh : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: ROW_GRID,
        gap: 8,
        padding: "10px 14px",
        borderTop: i > 0 ? "1px solid var(--border)" : 0,
        alignItems: "center",
      }}
    >
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            font: "600 12px/1.3 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              font: "500 10px/1.3 var(--f-mono)",
              color: "var(--ink-soft)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <Num v={r.ctns} frac={0} />
      <Num v={r.qty} frac={0} />
      <Num v={r.unit} prefix={sym} />
      <Num v={r.amount} prefix={sym} strong />
      <Num v={r.weight} />
      <Num v={r.cbm} frac={3} />
    </div>
  );
}

function Num({
  v,
  frac = 2,
  prefix = "",
  strong = false,
}: {
  v: number;
  frac?: number;
  prefix?: string;
  strong?: boolean;
}) {
  return (
    <span
      style={{
        font: `${strong ? 700 : 500} 11.5px/1 var(--f-mono)`,
        color: strong ? "var(--ink)" : "var(--ink-soft)",
        textAlign: "right",
      }}
    >
      {prefix}
      {v.toLocaleString("es-VE", {
        minimumFractionDigits: frac,
        maximumFractionDigits: frac,
      })}
    </span>
  );
}

function TotalCell({ v, strong = false }: { v: string; strong?: boolean }) {
  return (
    <span
      style={{
        font: `${strong ? 800 : 700} 11.5px/1 var(--f-mono)`,
        color: strong ? "var(--wine)" : "var(--ink)",
        textAlign: "right",
      }}
    >
      {v}
    </span>
  );
}
