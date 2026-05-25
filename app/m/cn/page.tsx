"use client";

/**
 * /m/cn — Home del operario CN (sketch v1 · UI sólo, datos mock).
 *
 * Estructura:
 *  - MobileHeader sticky con menu modal
 *  - Greeting (fecha + Hola + resumen del día)
 *  - 3 KPI cards (recepciones / CBM / pendientes)
 *  - Acción rápida: imprimir QR codes
 *  - Lista "Últimas recepciones" con 3 mock cards
 *  - FAB inferior "+ Nueva recepción"
 *
 * V2 (SDD-0027): page pasa a server component, fetchea via
 * `listOperarioReceipts(supabase, operario_id, last_24h)` y delega
 * la UI interactiva a OperarioHomeClient.
 *
 * Iconografía: 100% Icon set del Studio. Cero emojis decorativos.
 */

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { BigButton } from "@/app/m/_components/BigButton";
import { KpiCard } from "@/app/m/_components/KpiCard";
import { MobileHeader } from "@/app/m/_components/MobileHeader";

// ─────────────────────────────────────────────────────────────────────────
// Mock data (V2 viene de Supabase via server queries)
// ─────────────────────────────────────────────────────────────────────────

const OPERARIO = {
  name: "Wang Hua",
  nameCn: "王华",
  warehouse: "YIW-A1",
  warehouseCn: "义乌港二期",
};

const TODAY = {
  date: "25 May 2026 · 09:42",
  receipts: 3,
  cbm: 12.4,
  pending: 4,
};

const RECENT_RECEIPTS = [
  {
    id: "WR-2026-0009",
    client: "Tenant Industrial",
    clientCn: "工业租户",
    boxes: 12,
    cbm: 6.4,
    photos: 3,
    timeAgo: "hace 12 min",
    timeAgoCn: "12分钟前",
  },
  {
    id: "WR-2026-0008",
    client: "Demo Pyme C.A.",
    clientCn: "中小企业",
    boxes: 8,
    cbm: 4.2,
    photos: 2,
    timeAgo: "hace 1 h",
    timeAgoCn: "1小时前",
  },
  {
    id: "WR-2026-0007",
    client: "Carga Ejemplo C.A.",
    clientCn: "示例货运",
    boxes: 14,
    cbm: 5.4,
    photos: 4,
    timeAgo: "hace 2 h",
    timeAgoCn: "2小时前",
  },
];

type Lang = "es" | "cn";

const t = (lang: Lang, es: string, cn: string) => (lang === "cn" ? cn : es);

// ─────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────

export default function OperarioHomePage() {
  const [lang, setLang] = useState<Lang>("es");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-base)" }}>
      <MobileHeader
        title={t(lang, "Mi día", "今日工作")}
        subtitle={`${OPERARIO.warehouse} · ${OPERARIO.warehouseCn}`}
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

      {/* Scrollable body con padding bottom para no chocar con FAB */}
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
            {TODAY.date}
          </div>
          <h1
            style={{
              font: "900 24px/1.1 var(--f-display)",
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {t(lang, "Hola, Wang", "你好,王华")}
          </h1>
          <p
            style={{
              font: "500 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "var(--s-1) 0 0",
            }}
          >
            {t(
              lang,
              `Hoy llevás ${TODAY.receipts} recepciones · 18 cajas · ${TODAY.cbm} CBM`,
              `今日已收 ${TODAY.receipts} 件 · 18 箱 · ${TODAY.cbm} CBM`,
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
          <KpiCard
            label={t(lang, "Recepciones", "接收")}
            value={TODAY.receipts}
            tone="wine"
          />
          <KpiCard label="CBM" value={TODAY.cbm} tone="info" />
          <KpiCard
            label={t(lang, "Pendientes", "待处理")}
            value={TODAY.pending}
            tone="warning"
          />
        </section>

        {/* Acciones rápidas */}
        <section style={{ marginBottom: "var(--s-5)" }}>
          <div
            className="studio-eyebrow"
            style={{
              color: "var(--wine)",
              marginBottom: "var(--s-2)",
            }}
          >
            {t(lang, "Acciones rápidas", "快捷操作")}
          </div>
          <button
            type="button"
            onClick={() => {
              /* TODO SDD-0028: print QR codes */
            }}
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
            style={{
              color: "var(--wine)",
              marginBottom: "var(--s-2)",
            }}
          >
            {t(lang, "Últimas recepciones", "最近接收")}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-2)",
            }}
          >
            {RECENT_RECEIPTS.map((r) => (
              <ReceiptRow key={r.id} r={r} lang={lang} />
            ))}
          </div>
        </section>
      </div>

      {/* FAB · Nueva recepción */}
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
          lang={lang}
          setLang={setLang}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────

function ReceiptRow({
  r,
  lang,
}: {
  r: (typeof RECENT_RECEIPTS)[number];
  lang: Lang;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: "var(--s-3)",
        padding: "var(--s-3)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        alignItems: "center",
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--r-sm)",
          background: "var(--wine-tint, rgba(127, 15, 26, 0.08))",
          color: "var(--wine)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {Icon.box(18)}
      </span>
      <div style={{ minWidth: 0 }}>
        <code
          style={{
            font: "800 11.5px/1 var(--f-mono)",
            color: "var(--ink)",
          }}
        >
          {r.id}
        </code>
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
          {lang === "cn" ? r.clientCn : r.client}
        </div>
        <div
          style={{
            font: "500 11px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>
            {r.boxes}
            {t(lang, " cj", "箱")}
          </span>
          <Dot />
          <span>{r.cbm} CBM</span>
          <Dot />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            {Icon.camera(11)} {r.photos}
          </span>
          <Dot />
          <span>{lang === "cn" ? r.timeAgoCn : r.timeAgo}</span>
        </div>
      </div>
      <span style={{ color: "var(--ink-mute)" }}>{Icon.chevR(14)}</span>
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
  lang,
  setLang,
  onClose,
}: {
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

        {/* User identity */}
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
            WH
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: "800 14px/1.2 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              {OPERARIO.name} · {OPERARIO.nameCn}
            </div>
            <div
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 2,
              }}
            >
              {t(lang, "Almacén CN · ", "中国仓库 · ")}
              {OPERARIO.warehouse}
            </div>
          </div>
        </div>

        {/* Lang switcher row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--s-3) 0",
          }}
        >
          <span
            style={{
              font: "600 14px/1 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
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
            {([
              { v: "es", l: "ES" },
              { v: "cn", l: "中文" },
            ] as { v: Lang; l: string }[]).map((o) => {
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
                    font: `700 12px/1 ${o.v === "cn" ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"}`,
                    cursor: "pointer",
                  }}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cerrar sesión */}
        <Link
          href="/m/cn/login"
          style={{ textDecoration: "none", display: "block", marginTop: "var(--s-3)" }}
        >
          <BigButton
            label={t(lang, "Cerrar sesión", "退出登录")}
            variant="secondary"
            style={{
              background: "var(--danger-bg, rgba(168, 50, 62, 0.08))",
              color: "var(--danger)",
              borderColor: "transparent",
            }}
          />
        </Link>
      </div>
    </div>
  );
}
