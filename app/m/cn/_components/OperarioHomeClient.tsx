"use client";

/**
 * OperarioHomeClient — UI del home del operario CN (SDD-0027).
 *
 * Server pasa identidad del operario + KPIs del día + lista de
 * últimas recepciones del hub. UI es pura (no fetcha).
 */

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { BigButton } from "@/app/m/_components/BigButton";
import { KpiCard } from "@/app/m/_components/KpiCard";
import { MobileHeader } from "@/app/m/_components/MobileHeader";
import { setOperarioLangClient, type Lang } from "@/lib/lang";
import { signOutOperarioAction } from "../actions";

const t = (lang: Lang, es: string, cn: string) => (lang === "cn" ? cn : es);

export type OperarioHomeProps = {
  displayName: string;
  displayNameCn: string | null;
  initials: string;             // 'WH'
  firstName: string;            // 'Wang' — para "Hola, Wang"
  firstNameCn: string;          // '王华' — para "你好,王华"
  warehouseCode: string;        // 'YIW-A1'
  warehouseNameCn: string;      // '义乌港二期'
};

export type TodayKpis = {
  date: string;                 // "25 may 2026 · 09:42" — formato server
  receipts: number;             // count del día del operario
  boxes: number;                // sum cajas del día del operario
  cbm: number;                  // sum CBM del día del operario
  pending: number;              // count pendientes del warehouse
};

export type RecentReceipt = {
  code: string;                 // "WR-2026-0009"
  client: string;               // "Tenant Industrial"
  clientMarkbox: string | null; // "DTD-1005" o null si huérfana
  supplier: string | null;
  boxes: number;
  cbm: number;
  createdAt: string;            // ISO timestamp del row
  status: string;               // pendiente_consolidacion | consolidado | incidencia
  mine: boolean;                // creada por este operario
};

// ─────────────────────────────────────────────────────────────────────────
// Time relative helpers
// ─────────────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string, lang: Lang): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));

  if (diffMin < 1) return t(lang, "ahora", "刚刚");
  if (diffMin < 60) {
    return t(lang, `hace ${diffMin} min`, `${diffMin}分钟前`);
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return t(lang, `hace ${diffH} h`, `${diffH}小时前`);
  }
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) {
    return t(lang, `hace ${diffD} d`, `${diffD}天前`);
  }
  return t(lang, `+${diffD} d`, `+${diffD}天`);
}

// ─────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────

export function OperarioHomeClient({
  initialLang,
  operario,
  today,
  recents,
}: {
  initialLang: Lang;
  operario: OperarioHomeProps;
  today: TodayKpis;
  recents: RecentReceipt[];
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailReceipt, setDetailReceipt] = useState<RecentReceipt | null>(null);

  // Persistir cambio de lang en cookie (compartida con server + otras pantallas).
  const setLang = (next: Lang) => {
    setLangState(next);
    setOperarioLangClient(next);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-base)" }}>
      <MobileHeader
        title={t(lang, "Mi día", "今日工作")}
        subtitle={`${operario.warehouseCode} · ${operario.warehouseNameCn}`}
        right={
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t(lang, "Abrir menú", "打开菜单")}
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--r-md)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {Icon.menu(20)}
          </button>
        }
      />

      <div style={{ padding: "var(--s-4) var(--s-4) 120px" }}>
        {/* Greeting */}
        <section style={{ marginBottom: "var(--s-5)" }}>
          <div
            style={{
              font: "700 11px/1 var(--f-sans)",
              color: "var(--wine)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: "var(--s-1)",
            }}
          >
            {today.date}
          </div>
          <h1
            style={{
              font: "900 24px/1.1 var(--f-display)",
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {t(
              lang,
              `Hola, ${operario.firstName}`,
              `你好,${operario.firstNameCn || operario.firstName}`,
            )}
          </h1>
          <p
            style={{
              font: "500 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "var(--s-1) 0 0",
            }}
          >
            {today.receipts === 0
              ? t(
                  lang,
                  "Aún no registraste recepciones hoy",
                  "今日还未记录接收",
                )
              : t(
                  lang,
                  `Hoy llevás ${today.receipts} ${today.receipts === 1 ? "recepción" : "recepciones"} · ${today.boxes} ${today.boxes === 1 ? "caja" : "cajas"} · ${today.cbm} CBM`,
                  `今日已收 ${today.receipts} 件 · ${today.boxes} 箱 · ${today.cbm} CBM`,
                )}
          </p>
        </section>

        {/* KPIs */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--s-2)",
            marginBottom: "var(--s-5)",
          }}
        >
          <KpiCard label={t(lang, "Recepciones", "接收")} value={today.receipts} tone="wine" />
          <KpiCard label="CBM" value={today.cbm} tone="info" />
          <KpiCard label={t(lang, "Pendientes", "待处理")} value={today.pending} tone="warning" />
        </section>

        {/* Acciones rápidas */}
        <section style={{ marginBottom: "var(--s-5)" }}>
          <div
            className="studio-eyebrow"
            style={{ color: "var(--wine)", marginBottom: "var(--s-2)" }}
          >
            {t(lang, "Acciones rápidas", "快捷操作")}
          </div>
          <button
            type="button"
            onClick={() => {}}
            style={{
              width: "100%",
              padding: "var(--s-3)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderLeft: "4px solid var(--wine)",
              borderRadius: "var(--r-md)",
              display: "flex",
              alignItems: "center",
              gap: "var(--s-3)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--r-md)",
                background: "var(--wine-tint, rgba(127, 15, 26, 0.08))",
                color: "var(--wine)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {Icon.box(20)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  font: "800 13px/1.2 var(--f-display)",
                  color: "var(--ink)",
                }}
              >
                {t(lang, "Imprimir códigos QR", "打印QR码")}
              </span>
              <span
                style={{
                  display: "block",
                  font: "500 11px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                }}
              >
                {t(
                  lang,
                  "Etiquetas DTD para pegar en cada caja",
                  "用于贴在每个箱子上的DTD标签",
                )}
              </span>
            </span>
            <span style={{ color: "var(--wine)" }}>{Icon.chevR(14)}</span>
          </button>
        </section>

        {/* Últimas recepciones */}
        <section>
          <div
            className="studio-eyebrow"
            style={{ color: "var(--wine)", marginBottom: "var(--s-2)" }}
          >
            {t(lang, "Últimas recepciones", "最近接收")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            {recents.length === 0 ? (
              <EmptyRecents lang={lang} />
            ) : (
              recents.map((r) => (
                <ReceiptRow
                  key={r.code}
                  r={r}
                  lang={lang}
                  onClick={() => setDetailReceipt(r)}
                />
              ))
            )}
          </div>
        </section>
      </div>

      {/* FAB */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding:
            "var(--s-3) var(--s-4) calc(env(safe-area-inset-bottom) + var(--s-4))",
          background:
            "linear-gradient(0deg, var(--bg-base) 60%, transparent 100%)",
          zIndex: 5,
        }}
      >
        <Link href="/m/cn/nueva" style={{ textDecoration: "none" }}>
          <BigButton
            label={t(lang, "+ Nueva recepción", "+ 新接收")}
            icon={Icon.camera(20)}
          />
        </Link>
      </div>

      {/* Menu modal */}
      {menuOpen && (
        <MenuModal
          operario={operario}
          lang={lang}
          setLang={setLang}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* Detail modal de receipt */}
      {detailReceipt && (
        <ReceiptDetailModal
          r={detailReceipt}
          lang={lang}
          onClose={() => setDetailReceipt(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-componentes (locales al client)
// ─────────────────────────────────────────────────────────────────────────

function ReceiptRow({
  r,
  lang,
  onClick,
}: {
  r: RecentReceipt;
  lang: Lang;
  onClick: () => void;
}) {
  const isIncident = r.status === "incidencia";
  const isOrphan = r.clientMarkbox === null;
  const cbmFmt = r.cbm.toFixed(2);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: "var(--s-3)",
        padding: "var(--s-3)",
        background: "var(--bg-surface)",
        border: `1px solid ${isIncident ? "var(--danger)" : "var(--border)"}`,
        borderRadius: "var(--r-md)",
        alignItems: "center",
        textAlign: "left",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--r-sm)",
          background: isIncident
            ? "var(--danger-bg, rgba(168, 50, 62, 0.08))"
            : "var(--wine-tint, rgba(127, 15, 26, 0.08))",
          color: isIncident ? "var(--danger)" : "var(--wine)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {Icon.box(18)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <code style={{ font: "800 11.5px/1 var(--f-mono)", color: "var(--ink)" }}>
            {r.code}
          </code>
          {r.mine && (
            <span
              style={{
                font: "700 9px/1 var(--f-sans)",
                color: "var(--wine)",
                background: "var(--wine-tint, rgba(127, 15, 26, 0.08))",
                padding: "2px 5px",
                borderRadius: "var(--r-xs)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {t(lang, "tuya", "我的")}
            </span>
          )}
          {isOrphan && (
            <span
              style={{
                font: "700 9px/1 var(--f-sans)",
                color: "var(--warning)",
                background: "var(--warning-bg, rgba(184, 137, 58, 0.1))",
                padding: "2px 5px",
                borderRadius: "var(--r-xs)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {t(lang, "huérfana", "孤箱")}
            </span>
          )}
        </div>
        <div
          style={{
            font: "600 13px/1.2 var(--f-sans)",
            color: "var(--ink)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {r.client}
        </div>
        <div
          style={{
            font: "500 11px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span>
            {r.boxes}
            {t(lang, " cj", "箱")}
          </span>
          <Dot />
          <span>{cbmFmt} CBM</span>
          <Dot />
          <span>{formatRelativeTime(r.createdAt, lang)}</span>
        </div>
      </div>
      <span style={{ color: "var(--ink-mute)" }}>{Icon.chevR(14)}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Receipt detail modal (bottom sheet)
// ─────────────────────────────────────────────────────────────────────────

function ReceiptDetailModal({
  r,
  lang,
  onClose,
}: {
  r: RecentReceipt;
  lang: Lang;
  onClose: () => void;
}) {
  const statusLabel: Record<string, { es: string; cn: string; tone: string }> = {
    pendiente_consolidacion: {
      es: "Pendiente consolidar",
      cn: "待整合",
      tone: "var(--ink-soft)",
    },
    consolidado: { es: "Consolidado", cn: "已整合", tone: "var(--success)" },
    incidencia: { es: "Incidencia", cn: "异常", tone: "var(--danger)" },
  };
  const st = statusLabel[r.status] ?? {
    es: r.status,
    cn: r.status,
    tone: "var(--ink-soft)",
  };
  const isOrphan = r.clientMarkbox === null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-detail-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.4)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "var(--bg-surface)",
          borderRadius: "20px 20px 0 0",
          padding: "var(--s-5)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + var(--s-5))",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div
          aria-hidden
          style={{
            width: 40,
            height: 4,
            background: "var(--border)",
            borderRadius: 999,
            margin: "0 auto var(--s-4)",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            marginBottom: "var(--s-4)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <code
              id="receipt-detail-title"
              style={{
                font: "800 14px/1 var(--f-mono)",
                color: "var(--ink)",
                letterSpacing: "0.02em",
              }}
            >
              {r.code}
            </code>
            <div
              style={{
                font: "700 13px/1.3 var(--f-sans)",
                color: "var(--ink)",
                marginTop: 6,
              }}
            >
              {r.client}
            </div>
            {!isOrphan && r.clientMarkbox && (
              <code
                style={{
                  font: "600 11px/1 var(--f-mono)",
                  color: "var(--wine)",
                  marginTop: 4,
                  display: "inline-block",
                }}
              >
                {r.clientMarkbox}
              </code>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, "Cerrar", "关闭")}
            style={{
              width: 44,
              height: 44,
              padding: 12,
              borderRadius: "var(--r-md)",
              background: "transparent",
              border: 0,
              color: "var(--ink-soft)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(20)}
          </button>
        </div>

        {/* Summary */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "var(--s-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-2)",
          }}
        >
          <DetailRow label={t(lang, "Estado", "状态")} value={lang === "cn" ? st.cn : st.es} tone={st.tone} />
          <DetailRow
            label={t(lang, "Supplier", "供应商")}
            value={r.supplier ?? "—"}
          />
          <DetailRow label={t(lang, "Cajas", "箱")} value={String(r.boxes)} mono />
          <DetailRow label="CBM" value={`${r.cbm.toFixed(2)} m³`} mono />
          <DetailRow
            label={t(lang, "Recibido", "接收时间")}
            value={formatRelativeTime(r.createdAt, lang)}
          />
          {r.mine && (
            <DetailRow
              label={t(lang, "Registrado por", "登记人")}
              value={t(lang, "Tú", "我")}
              tone="var(--wine)"
            />
          )}
        </div>

        <p
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
            margin: "var(--s-3) 0 0",
            textAlign: "center",
          }}
        >
          {t(
            lang,
            "Vista resumida. Para editar abrí el Studio web.",
            "摘要视图。如需编辑请打开 Studio 网页。",
          )}
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: "var(--s-2)",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          font: "700 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-mute)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: `${mono ? "700" : "600"} 13px/1.3 ${
            mono ? "var(--f-mono)" : "var(--f-sans)"
          }`,
          color: tone ?? "var(--ink)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyRecents({ lang }: { lang: Lang }) {
  return (
    <div
      style={{
        padding: "var(--s-5) var(--s-4)",
        background: "var(--bg-surface)",
        border: "1px dashed var(--border)",
        borderRadius: "var(--r-md)",
        textAlign: "center",
        font: "500 12.5px/1.5 var(--f-sans)",
        color: "var(--ink-mute)",
      }}
    >
      {t(
        lang,
        "Aún no hay recepciones en este hub. Tocá + Nueva recepción para empezar.",
        "本仓库暂无接收记录。点击 + 新接收 开始。",
      )}
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 2,
        height: 2,
        borderRadius: "50%",
        background: "var(--ink-mute)",
      }}
    />
  );
}

function MenuModal({
  operario,
  lang,
  setLang,
  onClose,
}: {
  operario: OperarioHomeProps;
  lang: Lang;
  setLang: (l: Lang) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.4)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "var(--bg-surface)",
          borderRadius: "20px 20px 0 0",
          padding: "var(--s-5)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + var(--s-5))",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 4,
            background: "var(--border)",
            borderRadius: 999,
            margin: "0 auto var(--s-4)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3)",
            padding: "var(--s-3) 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--wine-tint, rgba(127, 15, 26, 0.08))",
              color: "var(--wine)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              font: "800 14px/1 var(--f-display)",
            }}
          >
            {operario.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: "800 14px/1.2 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              {operario.displayName}
              {operario.displayNameCn ? ` · ${operario.displayNameCn}` : ""}
            </div>
            <div
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 2,
              }}
            >
              {t(lang, "Almacén CN · ", "中国仓库 · ")}
              {operario.warehouseCode}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--s-3) 0",
          }}
        >
          <span style={{ font: "600 14px/1 var(--f-sans)", color: "var(--ink)" }}>
            {t(lang, "Idioma", "语言")}
          </span>
          <div
            style={{
              display: "inline-flex",
              padding: 3,
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
            }}
          >
            {(
              [
                { v: "es", l: "ES" },
                { v: "cn", l: "中文" },
              ] as { v: Lang; l: string }[]
            ).map((o) => {
              const active = lang === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setLang(o.v)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--r-sm)",
                    background: active ? "var(--wine)" : "transparent",
                    color: active ? "#FFFFFF" : "var(--ink-soft)",
                    border: 0,
                    font: `700 12px/1 ${
                      o.v === "cn" ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"
                    }`,
                    cursor: "pointer",
                  }}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cerrar sesión via server action */}
        <form action={signOutOperarioAction} style={{ marginTop: "var(--s-3)" }}>
          <BigButton
            type="submit"
            label={t(lang, "Cerrar sesión", "退出登录")}
            variant="secondary"
            style={{
              background: "var(--danger-bg, rgba(168, 50, 62, 0.08))",
              color: "var(--danger)",
              borderColor: "transparent",
            }}
          />
        </form>
      </div>
    </div>
  );
}
