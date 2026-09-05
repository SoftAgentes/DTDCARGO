"use client";

/**
 * RecibirClient — recepción por escaneo del operario CN (SDD-0154).
 *
 * Flujo: escanear DTD-B → "es de <cliente>, compra <code>, N cajas · ¿recibir?"
 * → rectificar la cantidad si hace falta → recibir → resumen. Reusa QrScanner
 * (mismo que estiba) y ActionButton. Piel oscura (bg-sidebar) como /m/cn/estibar.
 */

import { RECEPTION_INSTRUCTIONS } from "@/lib/studio/prealertas/reception-instructions";
import { defaultAddon } from "@/lib/studio/prealertas/addons";
import { useState } from "react";
import Link from "next/link";
import { QrScanner } from "@/app/m/_components/QrScanner";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import { parseScannedLabel } from "@/lib/studio/etiquetas-qr";
import { setOperarioLangClient, type Lang } from "@/lib/lang";
import {
  lookupForReceptionAction,
  receivePrealertaAction,
  type ReceptionLookup,
  type ReceiveState,
} from "../actions";

const t = (lang: Lang, es: string, cn: string) => (lang === "cn" ? cn : es);

type View = "scan" | "confirm" | "done";

export function RecibirClient({ initialLang, initialLookup }: { initialLang: Lang; initialLookup?: ReceptionLookup }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [view, setView] = useState<View>(initialLookup ? "confirm" : "scan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<ReceptionLookup | null>(initialLookup ?? null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>(initialLookup?.pendingCodes ?? []);
  const [result, setResult] = useState<ReceiveState | null>(null);

  const setLang = (next: Lang) => {
    setLangState(next);
    setOperarioLangClient(next);
  };

  const reset = () => {
    setView("scan");
    setLookup(null);
    setSelectedCodes([]);
    setResult(null);
    setError(null);
  };

  async function onDetected(raw: string) {
    const parsed = parseScannedLabel(raw);
    if (parsed.kind === "verify_url") {
      setError(
        t(
          lang,
          `Esa es la etiqueta del proveedor (${parsed.markbox}) · identifica al cliente, no a la caja. Escanea la etiqueta DTD-B.`,
          `那是供应商标签 (${parsed.markbox}) · 只认客户,不认箱子。请扫描 DTD-B 标签。`,
        ),
      );
      return;
    }
    if (parsed.kind !== "box_code") {
      setError(
        t(
          lang,
          "No reconozco ese código · escanea la etiqueta DTD-B.",
          "无法识别该编号 · 请扫描 DTD-B 标签。",
        ),
      );
      return;
    }

    setBusy(true);
    setError(null);
    let res;
    try {
      res = await lookupForReceptionAction(parsed.code);
    } catch {
      setError(t(lang, "No se pudo consultar la caja. Revisa la conexión y vuelve a escanear.", "无法查询箱子，请检查网络后重试。"));
      return;
    } finally { setBusy(false); }

    if (!res.found) {
      setError(res.error);
      return;
    }
    setLookup(res);
    setSelectedCodes(res.pendingCodes);
    setView("confirm");
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
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
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
            ← {t(lang, "Mi día", "今日工作")}
          </Link>
          <h1
            style={{
              margin: 0,
              font: "800 16px/1.3 var(--f-sans)",
              color: "var(--ink-side-strong)",
            }}
          >
            {t(lang, "Recibir escaneando", "扫码接收")}
          </h1>
          <p
            style={{
              margin: 0,
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-side-soft)",
            }}
          >
            {t(
              lang,
              "Escanea una etiqueta y recibe la compra.",
              "扫描标签即可接收该采购。",
            )}
          </p>
        </div>
        <LangToggle lang={lang} setLang={setLang} />
      </header>

      {/* Banner de error (fuera de flujo) */}
      {error && (
        <div
          style={{
            margin: "12px 14px 0",
            padding: "10px 12px",
            borderRadius: "var(--r-md)",
            background: "var(--danger-bg-strong)",
            border: "1px solid var(--danger-border)",
            color: "var(--ink-side-strong)",
            font: "600 12px/1.4 var(--f-sans)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {view === "scan" && (
          <QrScanner
            placeholder="DTD-B-000123"
            manualLabel={t(lang, "Escribir el código de la caja", "手动输入箱号")}
            hint={
              busy
                ? t(lang, "Buscando…", "查找中…")
                : t(lang, "Escanea el QR de la etiqueta.", "扫描标签上的二维码。")
            }
            onDetected={onDetected}
            onClose={() => {
              /* pantalla dedicada: no hay a dónde cerrar, se queda escaneando */
            }}
          />
        )}

        {view === "confirm" && lookup && (
          <ConfirmCard
            lang={lang}
            lookup={lookup}
            selectedCodes={selectedCodes}
            setSelectedCodes={setSelectedCodes}
            onCancel={reset}
            onReceive={async () => {
              const res = await receivePrealertaAction(lookup.boxCode, selectedCodes);
              if (!res.ok) return { error: res.error ?? "Error" };
              setResult(res);
              setView("done");
              return undefined;
            }}
          />
        )}

        {view === "done" && result && (
          <DoneCard lang={lang} result={result} onAgain={reset} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function ConfirmCard({
  lang,
  lookup,
  selectedCodes,
  setSelectedCodes,
  onCancel,
  onReceive,
}: {
  lang: Lang;
  lookup: ReceptionLookup;
  selectedCodes: string[];
  setSelectedCodes: (v: string[]) => void;
  onCancel: () => void;
  onReceive: () => Promise<{ error: string } | undefined>;
}) {
  const [mode, setMode] = useState<"lot" | "partial">("lot");
  if (lookup.alreadyReceived) {
    return (
      <div style={cardStyle}>
        <Eyebrow>{t(lang, "Ya recibida", "已接收")}</Eyebrow>
        <div style={{ font: "700 15px/1.3 var(--f-sans)", color: "var(--ink-side-strong)" }}>
          {lookup.clientMarkbox ?? "—"}
        </div>
        <Mono>{lookup.boxCode}</Mono>
        <p style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-side-soft)", margin: "8px 0 0" }}>
          {t(
            lang,
            "Esta caja ya estaba recibida. No hay nada que hacer.",
            "该箱子已接收,无需操作。",
          )}
        </p>
        <button type="button" onClick={onCancel} style={ghostBtn}>
          {t(lang, "Escanear otra", "扫描下一个")}
        </button>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <Eyebrow>{t(lang, "¿Recibir esta compra?", "接收此采购?")}</Eyebrow>

      {/* PRIVACIDAD (hallazgo H-7): el Shipping Mark es la identidad de la carga
          para el equipo CN. El nombre del importador no llega a este dispositivo. */}
      <div style={{ font: "800 18px/1.2 var(--f-sans)", color: "var(--ink-side-strong)" }}>
        {lookup.clientMarkbox ?? t(lang, "Sin Shipping Mark", "无唛头")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        <Row label={t(lang, "Compra", "采购")} value={lookup.prealertaCode} mono />
        {lookup.supplierName && (
          <Row label={t(lang, "Proveedor", "供应商")} value={lookup.supplierName} />
        )}
        <Row
          label={t(lang, "Anunciadas", "已通知")}
          value={`${lookup.expected} ${t(lang, "cajas", "箱")}`}
        />
      </div>

      <fieldset style={{ border: "1px solid var(--border-inv)", borderRadius: "var(--r-md)", padding: 12, marginTop: 14, color: "var(--ink-side-strong)" }}>
        <legend>{t(lang, "¿Cómo quieres recibir?", "如何接收？")}</legend>
        <label style={{ display: "block", padding: 8 }}><input type="radio" name="reception-mode" checked={mode === "lot"} onChange={() => { setMode("lot"); setSelectedCodes(lookup.pendingCodes); }} /> {t(lang, "Lote completo", "接收整批")} · {lookup.expected}</label>
        <label style={{ display: "block", padding: 8 }}><input type="radio" name="reception-mode" checked={mode === "partial"} onChange={() => { setMode("partial"); setSelectedCodes([lookup.boxCode]); }} /> {t(lang, "Solo esta caja / recepción parcial", "仅此箱 / 部分接收")}</label>
        {mode === "partial" && <div style={{ maxHeight: 220, overflow: "auto" }}>
          {lookup.pendingCodes.map(code => <label key={code} style={{ display: "block", padding: 8 }}><input type="checkbox" checked={selectedCodes.includes(code)} disabled={code === lookup.boxCode} onChange={e => setSelectedCodes(e.target.checked ? [...selectedCodes, code] : selectedCodes.filter(c => c !== code))} /> {code}</label>)}
        </div>}
      </fieldset>
      <p style={{ color: "var(--ink-side-soft)" }}>{t(lang, "Confirma únicamente las cajas que tienes presentes. Recibir cajas no confirma el conteo de artículos.", "只确认已到货的箱子。收箱不代表已核对箱内商品数量。")}</p>
      {lookup.services.length > 0 && <section style={{ color: "var(--ink-side-strong)", border: "1px solid var(--warning-border)", padding: 12 }}>
        <strong>{t(lang, "Servicios pendientes de esta compra", "该订单待办服务")}</strong>
        <ul>{lookup.services.map(service => <li key={service.code}>{defaultAddon(service.code)?.label ?? service.code}<p>{t(lang, RECEPTION_INSTRUCTIONS[service.code]?.es ?? "Consulta el alcance con operaciones.", RECEPTION_INSTRUCTIONS[service.code]?.zh ?? "请向仓库负责人确认服务内容。")}</p></li>)}</ul>
        <p>{t(lang, "Estas tareas siguen pendientes después de recibir las cajas.", "收箱后仍须完成这些服务。")}</p>
      </section>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} style={{ ...ghostBtn, flex: 1, marginTop: 0 }}>
          {t(lang, "Cancelar", "取消")}
        </button>
        <div style={{ flex: 2 }}>
          <ActionButton
            variant="primary"
            size="default"
            idleLabel={t(lang, `Confirmar recepción de ${selectedCodes.length} ${selectedCodes.length === 1 ? "caja" : "cajas"}`, `确认接收 ${selectedCodes.length} 箱`)}
            loadingLabel={t(lang, "Recibiendo…", "接收中…")}
            successLabel={t(lang, "Recibida ✓", "已接收 ✓")}
            idleIcon={Icon.check(16)}
            successIcon={Icon.check(16)}
            onAction={onReceive}
          />
        </div>
      </div>
    </div>
  );
}

function DoneCard({
  lang,
  result,
  onAgain,
}: {
  lang: Lang;
  result: ReceiveState;
  onAgain: () => void;
}) {
  const remaining = result.remaining ?? 0;
  return (
    <div style={cardStyle}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--success-bg, rgba(58,122,64,0.14))",
          color: "var(--success)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto",
        }}
      >
        {Icon.check(24)}
      </div>
      <div
        style={{
          textAlign: "center",
          font: "800 17px/1.2 var(--f-sans)",
          color: "var(--ink-side-strong)",
          marginTop: 10,
        }}
      >
        {t(lang, "Recepción registrada", "接收已登记")}
      </div>
      <Mono center>{result.receiptCode}</Mono>
      <Link href="/m/cn/servicios" style={{ ...ghostBtn, display: "block" }}>{t(lang, "Ver tareas de revisión y servicios", "查看验货及服务任务")}</Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        <Row label={t(lang, "Cliente", "客户")} value={result.clientMarkbox ?? "—"} />
        <Row label={t(lang, "Compra", "采购")} value={result.prealertaCode ?? "—"} mono />
        <Row
          label={t(lang, "Recibidas", "已接收")}
          value={`${result.received ?? 0} ${t(lang, "cajas", "箱")}`}
        />
      </div>

      {remaining > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: "var(--r-md)",
            background: "var(--warning-bg-strong, rgba(184,137,58,0.16))",
            border: "1px solid var(--warning-border, rgba(184,137,58,0.4))",
            color: "var(--ink-side-strong)",
            font: "600 12px/1.4 var(--f-sans)",
          }}
        >
          {t(
            lang,
            `Faltan ${remaining} cajas de esta compra · llegan en otro envío y se reciben igual, escaneando.`,
            `此采购还差 ${remaining} 箱 · 将在另一批到货,同样扫码接收。`,
          )}
        </div>
      )}

      <button type="button" onClick={onAgain} style={{ ...primaryGhost, marginTop: 16 }}>
        {t(lang, "Recibir otra", "接收下一个")}
      </button>
      <Link href="/m/cn" style={{ ...ghostBtn, textAlign: "center", textDecoration: "none", display: "block" }}>
        {t(lang, "Volver a Mi día", "返回今日工作")}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Átomos de estilo (piel oscura del sidebar)
// ─────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--surface-inv)",
  border: "1px solid var(--border-inv)",
  borderRadius: "var(--r-lg, 14px)",
  padding: 16,
};

const ghostBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 10,
  minHeight: 48,
  borderRadius: "var(--r-md)",
  background: "transparent",
  border: "1px solid var(--border-inv)",
  color: "var(--ink-side)",
  font: "700 13px/1 var(--f-sans)",
  cursor: "pointer",
};

const primaryGhost: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: "var(--r-md)",
  background: "var(--wine)",
  border: 0,
  color: "#FFFFFF",
  font: "800 14px/1 var(--f-sans)",
  cursor: "pointer",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        font: "700 10px/1 var(--f-sans)",
        color: "var(--wine-text)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Mono({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      style={{
        font: "700 12px/1.3 var(--f-mono)",
        color: "var(--wine-text)",
        marginTop: 3,
        textAlign: center ? "center" : "left",
      }}
    >
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 8, alignItems: "baseline" }}>
      <span
        style={{
          font: "700 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-side-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: `${mono ? "700" : "600"} 13px/1.3 ${mono ? "var(--f-mono)" : "var(--f-sans)"}`,
          color: "var(--ink-side-strong)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, background: "var(--surface-inv)", borderRadius: "var(--r-md)", flexShrink: 0 }}>
      {([{ v: "es", l: "ES" }, { v: "cn", l: "中文" }] as { v: Lang; l: string }[]).map((o) => {
        const active = lang === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setLang(o.v)}
            style={{
              padding: "5px 10px",
              borderRadius: "var(--r-sm)",
              background: active ? "var(--wine)" : "transparent",
              color: active ? "#FFFFFF" : "var(--ink-side-soft)",
              border: 0,
              font: `700 11px/1 ${o.v === "cn" ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"}`,
              cursor: "pointer",
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}
