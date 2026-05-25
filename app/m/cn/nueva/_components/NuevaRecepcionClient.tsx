"use client";

/**
 * NuevaRecepcionClient — wizard "Nueva recepción CN" (SDD-0027).
 *
 * 5 views encadenadas con state preservado por useReducer:
 *   step1 (fotos) → step2 (identificar) → step3 (datos) → step4 (confirmar) → done
 *
 * Recibe `clients` y `defaultWarehouseId` del server component padre
 * (que valida la sesión del operario y querya los clientes del tenant).
 *
 * Submit final llama `createReceiptFromOperarioAction` via useActionState.
 * El RPC backend crea receipt + items + event atomicamente y retorna el
 * código asignado para mostrar en el Done screen.
 *
 * Iconografía: Icon set Studio. Cero emojis decorativos.
 */

import { startTransition, useActionState, useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { BigButton } from "@/app/m/_components/BigButton";
import { MobileHeader } from "@/app/m/_components/MobileHeader";
import type { Lang } from "@/lib/lang";
import { createReceiptFromOperarioAction } from "../actions";
import type {
  CreateReceiptInput,
  CreateReceiptState,
} from "@/lib/studio/operario-types";

// ─────────────────────────────────────────────────────────────────────────
// Tipos del cliente picker (server pasa via prop)
// ─────────────────────────────────────────────────────────────────────────

export type PickerClient = {
  markbox: string;
  name: string;
};

// ─────────────────────────────────────────────────────────────────────────
// State + reducer
// ─────────────────────────────────────────────────────────────────────────

type View = "step1" | "step2" | "step3" | "step4" | "done";

type Photo = { id: number; preview: "box-front" | "label" | "inside" | "damage" };

type Reception = {
  photos: Photo[];
  orphan: boolean;
  client: string;
  marks: string;
  broughtBy: string;
  supplier: string;
  boxes: string;
  cbm: string;
  weight: string;
  hs: string;
  incident: boolean;
  incidentNote: string;
};

const EMPTY: Reception = {
  photos: [],
  orphan: false,
  client: "",
  marks: "",
  broughtBy: "",
  supplier: "",
  boxes: "",
  cbm: "",
  weight: "",
  hs: "",
  incident: false,
  incidentNote: "",
};

type Action =
  | { type: "addPhoto" }
  | { type: "removePhoto"; id: number }
  | { type: "setOrphan"; value: boolean }
  | { type: "set"; key: keyof Reception; value: string }
  | { type: "setBool"; key: keyof Reception; value: boolean }
  | { type: "reset" };

function reducer(state: Reception, action: Action): Reception {
  switch (action.type) {
    case "addPhoto": {
      const previews: Photo["preview"][] = ["box-front", "label", "inside", "damage"];
      return {
        ...state,
        photos: [
          ...state.photos,
          { id: Date.now(), preview: previews[state.photos.length % 4] },
        ],
      };
    }
    case "removePhoto":
      return { ...state, photos: state.photos.filter((p) => p.id !== action.id) };
    case "setOrphan":
      return { ...state, orphan: action.value, client: "" };
    case "set":
      return { ...state, [action.key]: action.value };
    case "setBool":
      return { ...state, [action.key]: action.value };
    case "reset":
      return EMPTY;
  }
}

const t = (lang: Lang, es: string, cn: string) => (lang === "cn" ? cn : es);
const initialState: CreateReceiptState = {};

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────

export function NuevaRecepcionClient({
  initialLang,
  clients,
  defaultWarehouseId,
}: {
  initialLang: Lang;
  clients: PickerClient[];
  defaultWarehouseId: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("step1");
  // Lang viene del server via cookie compartida con /m/cn (no re-toggleable
  // dentro del wizard — el operario lo cambia desde el home y vuelve).
  const [lang] = useState<Lang>(initialLang);
  const [reception, dispatch] = useReducer(reducer, EMPTY);
  const [state, formAction, isPending] = useActionState(
    createReceiptFromOperarioAction,
    initialState,
  );

  // Cuando server retorna ok + receiptCode → pasamos a Done
  useEffect(() => {
    if (state.ok && state.receiptCode) setView("done");
  }, [state.ok, state.receiptCode]);

  const submit = () => {
    const clientObj = reception.client
      ? clients.find((c) => c.markbox === reception.client)
      : null;

    const payload: CreateReceiptInput = {
      warehouse_id: defaultWarehouseId,
      is_orphan: reception.orphan,
      client_markbox: reception.orphan ? null : reception.client || null,
      client_name: reception.orphan ? null : clientObj?.name ?? null,
      orphan_marks: reception.orphan ? reception.marks || null : null,
      orphan_brought_by: reception.orphan ? reception.broughtBy || null : null,
      supplier_name: reception.supplier || null,
      supplier_name_translated: null,
      boxes: Number(reception.boxes),
      total_cbm: reception.cbm ? Number(reception.cbm) : null,
      total_weight_kg: reception.weight ? Number(reception.weight) : null,
      received_at: new Date().toISOString().slice(0, 10),
      notes: null,
      items: reception.hs
        ? [
            {
              description: clientObj?.name ?? reception.supplier ?? "Caja",
              hs_code: reception.hs,
              quantity: null,
              unit_value_usd: null,
            },
          ]
        : [],
      incident: reception.incident,
      incident_note: reception.incident ? reception.incidentNote || null : null,
    };

    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    // React 19 exige startTransition al invocar useActionState fuera de <form>
    startTransition(() => formAction(fd));
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-base)" }}>
      {view === "step1" && (
        <Step1Photos
          lang={lang}
          reception={reception}
          dispatch={dispatch}
          onBack={() => router.push("/m/cn")}
          onNext={() => setView("step2")}
        />
      )}
      {view === "step2" && (
        <Step2Identify
          lang={lang}
          clients={clients}
          reception={reception}
          dispatch={dispatch}
          onBack={() => setView("step1")}
          onNext={() => setView("step3")}
        />
      )}
      {view === "step3" && (
        <Step3Data
          lang={lang}
          reception={reception}
          dispatch={dispatch}
          onBack={() => setView("step2")}
          onNext={() => setView("step4")}
        />
      )}
      {view === "step4" && (
        <Step4Confirm
          lang={lang}
          clients={clients}
          reception={reception}
          dispatch={dispatch}
          onBack={() => setView("step3")}
          onSubmit={submit}
          isPending={isPending}
          serverError={state.error}
        />
      )}
      {view === "done" && (
        <Done
          lang={lang}
          code={state.receiptCode ?? "—"}
          onNew={() => {
            dispatch({ type: "reset" });
            setView("step1");
          }}
          onHome={() => router.push("/m/cn")}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STEPS · UI auxiliares
// ═════════════════════════════════════════════════════════════════════════

function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
        padding: "0 var(--s-4) var(--s-4)",
      }}
    >
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          aria-current={n === current ? "step" : undefined}
          style={{
            height: 4,
            borderRadius: 999,
            background: n <= current ? "var(--wine)" : "var(--bg-elevated)",
          }}
        />
      ))}
    </div>
  );
}

function BottomActions({
  lang,
  onBack,
  onNext,
  onSubmit,
  nextDisabled,
  submitLabel,
  isPending,
}: {
  lang: Lang;
  onBack: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  nextDisabled?: boolean;
  submitLabel?: string;
  isPending?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding:
          "var(--s-3) var(--s-4) calc(env(safe-area-inset-bottom) + var(--s-3))",
        background: "var(--bg-base)",
        borderTop: "1px solid var(--border)",
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: "var(--s-2)",
        zIndex: 5,
      }}
    >
      <BigButton
        label={t(lang, "Atrás", "上一步")}
        onClick={onBack}
        variant="secondary"
        disabled={isPending}
      />
      <BigButton
        label={
          isPending
            ? t(lang, "Guardando…", "保存中…")
            : submitLabel ?? t(lang, "Siguiente →", "下一步 →")
        }
        onClick={onSubmit ?? onNext}
        disabled={nextDisabled || isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 1 · Fotos
// ─────────────────────────────────────────────────────────────────────────

function Step1Photos({
  lang,
  reception,
  dispatch,
  onBack,
  onNext,
}: {
  lang: Lang;
  reception: Reception;
  dispatch: React.Dispatch<Action>;
  onBack: () => void;
  onNext: () => void;
}) {
  const { photos } = reception;
  const enough = photos.length >= 3;

  return (
    <div>
      <MobileHeader
        title={t(lang, "1 de 4 · Fotos", "1/4 · 拍照")}
        subtitle={t(lang, "Tomá 3 fotos mínimo", "至少拍3张照片")}
        back={<BackBtn onClick={onBack} lang={lang} />}
      />
      <Steps current={1} />

      <div style={{ padding: "0 var(--s-4) 120px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "var(--s-2)",
          }}
        >
          {photos.map((p, i) => (
            <PhotoSlot
              key={p.id}
              photo={p}
              index={i}
              lang={lang}
              onRemove={() => dispatch({ type: "removePhoto", id: p.id })}
            />
          ))}
          <PhotoAddTile onClick={() => dispatch({ type: "addPhoto" })} lang={lang} />
        </div>

        {photos.length > 0 && !enough && (
          <Hint
            tone="warning"
            text={t(
              lang,
              `Faltan ${3 - photos.length} fotos · mínimo 3 para registrar`,
              `还需${3 - photos.length}张照片 · 至少3张`,
            )}
          />
        )}
        {enough && (
          <Hint
            tone="success"
            text={t(lang, "Fotos suficientes · podés seguir", "照片足够 · 可以继续")}
          />
        )}

        <p
          style={{
            marginTop: "var(--s-3)",
            font: "500 11.5px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
          }}
        >
          {t(
            lang,
            "Tomá: 1) frente con etiqueta · 2) supplier label · 3) contenido · 4) daños si hay",
            "拍摄: 1) 正面带标签 · 2) 供应商标签 · 3) 内容 · 4) 损坏(如有)",
          )}
        </p>
      </div>

      <BottomActions lang={lang} onBack={onBack} onNext={onNext} nextDisabled={!enough} />
    </div>
  );
}

function PhotoAddTile({ onClick, lang }: { onClick: () => void; lang: Lang }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        aspectRatio: "4 / 3",
        background: "var(--wine)",
        color: "#FFFFFF",
        border: 0,
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        font: "800 14px/1 var(--f-sans)",
        cursor: "pointer",
      }}
    >
      {Icon.camera(32)}
      {t(lang, "Tomar foto", "拍照")}
    </button>
  );
}

function PhotoSlot({
  photo,
  index,
  lang,
  onRemove,
}: {
  photo: Photo;
  index: number;
  lang: Lang;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "4 / 3",
        // Diferenciado del slot "+ Tomar foto": fondo wine-tint claro +
        // check verde top-left para confirmar visualmente que la foto
        // está capturada (no es slot vacío).
        background: "var(--wine-tint, rgba(127, 15, 26, 0.08))",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--wine-soft, #C2747F)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--wine)",
      }}
    >
      <PhotoPlaceholder kind={photo.preview} />
      {/* Badge "Foto N" top-left para confirmar captura */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          padding: "2px 6px",
          borderRadius: "var(--r-xs)",
          background: "var(--success)",
          color: "#FFFFFF",
          font: "700 9.5px/1 var(--f-sans)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {t(lang, `Foto ${index + 1}`, `照片 ${index + 1}`)}
      </span>
      {/* Hitbox 44x44 (Apple HIG / WCAG 2.5.8) con visual 28x28 centrado */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t(lang, "Quitar foto", "删除照片")}
        style={{
          position: "absolute",
          top: -2,
          right: -2,
          width: 44,
          height: 44,
          padding: 8,
          borderRadius: "50%",
          background: "transparent",
          border: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--danger)",
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Icon.close(12)}
        </span>
      </button>
    </div>
  );
}

function PhotoPlaceholder({ kind }: { kind: Photo["preview"] }) {
  const label = {
    "box-front": "FRENTE",
    label: "ETIQUETA",
    inside: "INTERIOR",
    damage: "DAÑO",
  }[kind];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity: 0.55,
      }}
    >
      {Icon.box(36)}
      <span
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Hint({ tone, text }: { tone: "warning" | "success"; text: string }) {
  const colors = {
    warning: { bg: "var(--warning-bg, rgba(184,137,58,0.08))", fg: "var(--warning)" },
    success: { bg: "var(--success-bg, rgba(31,138,91,0.08))", fg: "var(--success)" },
  }[tone];
  const sign = tone === "warning" ? Icon.box(14) : Icon.check(14);
  return (
    <div
      style={{
        marginTop: "var(--s-3)",
        padding: "10px 12px",
        background: colors.bg,
        borderRadius: "var(--r-md)",
        display: "flex",
        gap: 8,
        font: "500 12px/1.4 var(--f-sans)",
        color: "var(--ink)",
        alignItems: "center",
      }}
    >
      <span style={{ color: colors.fg, display: "inline-flex" }}>{sign}</span>
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 2 · Identify
// ─────────────────────────────────────────────────────────────────────────

function Step2Identify({
  lang,
  clients,
  reception,
  dispatch,
  onBack,
  onNext,
}: {
  lang: Lang;
  clients: PickerClient[];
  reception: Reception;
  dispatch: React.Dispatch<Action>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [search, setSearch] = useState("");
  const { orphan, client, marks } = reception;

  const filtered = clients
    .filter(
      (c) =>
        c.markbox.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 8);

  const canNext = orphan ? marks.length > 0 : client.length > 0;

  return (
    <div>
      <MobileHeader
        title={t(lang, "2 de 4 · Identificar", "2/4 · 识别")}
        subtitle={t(lang, "¿De quién es esta caja?", "这箱子是谁的?")}
        back={<BackBtn onClick={onBack} lang={lang} />}
      />
      <Steps current={2} />

      <div style={{ padding: "0 var(--s-4) 120px" }}>
        <OrphanToggle
          orphan={orphan}
          onChange={(v) => dispatch({ type: "setOrphan", value: v })}
          lang={lang}
        />

        {orphan ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
            <MobileInput
              label={t(lang, "Marcas visibles en la caja", "箱子上可见标记")}
              value={marks}
              onChange={(v) => dispatch({ type: "set", key: "marks", value: v })}
              placeholder={t(
                lang,
                "Ej: ACINDAR-VLN-04 · etiqueta china",
                "例: ACINDAR-VLN-04 · 中文标签",
              )}
            />
            <MobileInput
              label={t(lang, "¿Quién la trajo?", "谁送的?")}
              value={reception.broughtBy}
              onChange={(v) => dispatch({ type: "set", key: "broughtBy", value: v })}
              placeholder={t(lang, "Chofer o courier", "司机或快递")}
            />
          </div>
        ) : (
          <div>
            <MobileInput
              label={t(lang, "Buscar cliente · MARKBOX", "查找客户 · MARKBOX")}
              value={search}
              onChange={setSearch}
              placeholder="DTD-XXXX"
              mono
            />
            <div
              style={{
                marginTop: "var(--s-3)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {filtered.map((c) => {
                const selected = client === c.markbox;
                return (
                  <button
                    key={c.markbox}
                    type="button"
                    onClick={() =>
                      dispatch({ type: "set", key: "client", value: c.markbox })
                    }
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr 24px",
                      gap: "var(--s-3)",
                      padding: "var(--s-3)",
                      background: selected
                        ? "var(--wine-tint, rgba(127,15,26,0.08))"
                        : "var(--bg-surface)",
                      border: `1px solid ${selected ? "var(--wine)" : "var(--border)"}`,
                      borderRadius: "var(--r-md)",
                      alignItems: "center",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <code
                      style={{
                        font: "800 12px/1 var(--f-mono)",
                        color: selected ? "var(--wine)" : "var(--ink)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {c.markbox}
                    </code>
                    <span
                      style={{
                        font: "600 13px/1.2 var(--f-sans)",
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </span>
                    {selected && <span style={{ color: "var(--wine)" }}>{Icon.check(14)}</span>}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p
                  style={{
                    font: "500 12px/1.4 var(--f-sans)",
                    color: "var(--ink-mute)",
                    textAlign: "center",
                    padding: "var(--s-4) 0",
                  }}
                >
                  {t(lang, "Sin coincidencias", "无匹配")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomActions lang={lang} onBack={onBack} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

function OrphanToggle({
  orphan,
  onChange,
  lang,
}: {
  orphan: boolean;
  onChange: (v: boolean) => void;
  lang: Lang;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!orphan)}
      style={{
        width: "100%",
        padding: "var(--s-3) var(--s-3)",
        marginBottom: "var(--s-4)",
        background: orphan
          ? "var(--warning-bg, rgba(184,137,58,0.08))"
          : "var(--bg-elevated)",
        border: `1px solid ${orphan ? "var(--warning)" : "var(--border)"}`,
        borderRadius: "var(--r-md)",
        display: "flex",
        alignItems: "center",
        gap: "var(--s-2)",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          border: `2px solid ${orphan ? "var(--warning)" : "var(--ink-mute)"}`,
          background: orphan ? "var(--warning)" : "transparent",
          color: "#FFFFFF",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {orphan && Icon.check(12)}
      </span>
      <span style={{ flex: 1, font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
        {t(lang, "Caja sin código · huérfana", "无编码 · 孤箱")}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 3 · Data
// ─────────────────────────────────────────────────────────────────────────

function Step3Data({
  lang,
  reception,
  dispatch,
  onBack,
  onNext,
}: {
  lang: Lang;
  reception: Reception;
  dispatch: React.Dispatch<Action>;
  onBack: () => void;
  onNext: () => void;
}) {
  const canNext = reception.boxes.length > 0 && reception.cbm.length > 0;
  const set = (key: keyof Reception, value: string) =>
    dispatch({ type: "set", key, value });

  return (
    <div>
      <MobileHeader
        title={t(lang, "3 de 4 · Datos", "3/4 · 数据")}
        subtitle={t(lang, "Dimensiones y supplier", "尺寸和供应商")}
        back={<BackBtn onClick={onBack} lang={lang} />}
      />
      <Steps current={3} />

      <div
        style={{
          padding: "0 var(--s-4) 120px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-3)",
        }}
      >
        <MobileInput
          label={t(lang, "Proveedor chino", "中国供应商")}
          value={reception.supplier}
          onChange={(v) => set("supplier", v)}
          placeholder={t(lang, "Nombre del supplier", "供应商名称")}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-2)" }}>
          <MobileInput
            label={t(lang, "Cajas", "箱数")}
            value={reception.boxes}
            onChange={(v) => set("boxes", v)}
            placeholder="0"
            mono
            large
            numeric
          />
          <MobileInput
            label="CBM"
            value={reception.cbm}
            onChange={(v) => set("cbm", v)}
            placeholder="0.0"
            mono
            large
            numeric
            suffix="m³"
          />
        </div>

        <MobileInput
          label={t(lang, "Peso total", "总重量")}
          value={reception.weight}
          onChange={(v) => set("weight", v)}
          placeholder="0"
          mono
          numeric
          suffix="kg"
        />

        <MobileInput
          label={t(lang, "HS Code (opcional · del supplier)", "HS编码 (可选)")}
          value={reception.hs}
          onChange={(v) => set("hs", v)}
          placeholder="0000.00"
          mono
        />
      </div>

      <BottomActions lang={lang} onBack={onBack} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

function MobileInput({
  label,
  value,
  onChange,
  placeholder,
  mono,
  large,
  numeric,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  large?: boolean;
  numeric?: boolean;
  suffix?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span
        style={{
          font: "700 10.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: large ? 56 : 48,
          padding: "0 14px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          minWidth: 0,
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={numeric ? "decimal" : "text"}
          style={{
            flex: 1,
            minWidth: 0,
            width: 0,
            height: "100%",
            border: 0,
            outline: "none",
            background: "transparent",
            font: `${mono ? "700" : "600"} ${large ? 24 : 15}px/1 ${
              mono ? "var(--f-mono)" : "var(--f-sans)"
            }`,
            color: "var(--ink)",
          }}
        />
        {suffix && (
          <span style={{ font: "600 13px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 4 · Confirm
// ─────────────────────────────────────────────────────────────────────────

function Step4Confirm({
  lang,
  clients,
  reception,
  dispatch,
  onBack,
  onSubmit,
  isPending,
  serverError,
}: {
  lang: Lang;
  clients: PickerClient[];
  reception: Reception;
  dispatch: React.Dispatch<Action>;
  onBack: () => void;
  onSubmit: () => void;
  isPending: boolean;
  serverError?: string;
}) {
  const clientObj = reception.client
    ? clients.find((c) => c.markbox === reception.client)
    : null;

  return (
    <div>
      <MobileHeader
        title={t(lang, "4 de 4 · Confirmar", "4/4 · 确认")}
        subtitle={t(lang, "Revisá y guardá", "检查并保存")}
        back={<BackBtn onClick={onBack} lang={lang} />}
      />
      <Steps current={4} />

      <div
        style={{
          padding: "0 var(--s-4) 120px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-3)",
        }}
      >
        <div
          style={{
            padding: "var(--s-4)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          <div
            className="studio-eyebrow"
            style={{ color: "var(--wine)", marginBottom: "var(--s-3)" }}
          >
            {t(lang, "Resumen", "总结")}
          </div>
          <SummaryRow label={t(lang, "Fotos", "照片")} value={`${reception.photos.length}`} />
          <SummaryRow
            label={t(lang, "Cliente", "客户")}
            value={
              reception.orphan
                ? t(lang, `Huérfana · ${reception.marks}`, `孤箱 · ${reception.marks}`)
                : clientObj?.name ?? reception.client
            }
            highlight={reception.orphan ? "warning" : undefined}
          />
          {!reception.orphan && reception.client && (
            <SummaryRow label="MARKBOX" value={reception.client} mono />
          )}
          <SummaryRow label={t(lang, "Supplier", "供应商")} value={reception.supplier || "—"} />
          <SummaryRow label={t(lang, "Cajas", "箱")} value={reception.boxes} mono />
          <SummaryRow label="CBM" value={`${reception.cbm} m³`} mono />
          {reception.weight && (
            <SummaryRow label={t(lang, "Peso", "重量")} value={`${reception.weight} kg`} mono />
          )}
          {reception.hs && <SummaryRow label="HS" value={reception.hs} mono />}
        </div>

        <button
          type="button"
          onClick={() =>
            dispatch({ type: "setBool", key: "incident", value: !reception.incident })
          }
          style={{
            padding: "var(--s-3)",
            background: reception.incident
              ? "var(--danger-bg, rgba(168,50,62,0.08))"
              : "var(--bg-surface)",
            border: `1px solid ${reception.incident ? "var(--danger)" : "var(--border)"}`,
            borderRadius: "var(--r-md)",
            display: "flex",
            alignItems: "center",
            gap: "var(--s-2)",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: `2px solid ${reception.incident ? "var(--danger)" : "var(--ink-mute)"}`,
              background: reception.incident ? "var(--danger)" : "transparent",
              color: "#FFFFFF",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {reception.incident && Icon.check(12)}
          </span>
          <span style={{ flex: 1, font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {t(lang, "Reportar incidencia con la caja", "报告箱子问题")}
          </span>
        </button>

        {reception.incident && (
          <MobileInput
            label={t(lang, "Descripción de la incidencia", "问题描述")}
            value={reception.incidentNote}
            onChange={(v) => dispatch({ type: "set", key: "incidentNote", value: v })}
            placeholder={t(
              lang,
              "Ej: caja con daño en esquina superior",
              "例: 箱子上角损坏",
            )}
          />
        )}

        {serverError && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              background: "var(--danger-bg, rgba(168,50,62,0.08))",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-md)",
              font: "600 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
            }}
          >
            {serverError}
          </div>
        )}
      </div>

      <BottomActions
        lang={lang}
        onBack={onBack}
        onSubmit={onSubmit}
        submitLabel={t(lang, "Registrar recepción", "保存接收")}
        isPending={isPending}
      />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "warning";
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: "var(--s-3)",
        padding: "var(--s-2) 0",
        borderTop: "1px solid var(--border)",
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
          font: `${mono ? "700" : "600"} ${mono ? 13 : 14}px/1.3 ${
            mono ? "var(--f-mono)" : "var(--f-sans)"
          }`,
          color: highlight === "warning" ? "var(--warning)" : "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DONE
// ─────────────────────────────────────────────────────────────────────────

function Done({
  lang,
  code,
  onNew,
  onHome,
}: {
  lang: Lang;
  code: string;
  onNew: () => void;
  onHome: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        padding:
          "calc(env(safe-area-inset-top) + var(--s-6)) var(--s-4) calc(env(safe-area-inset-bottom) + var(--s-4))",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "var(--s-3)",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "var(--success-bg, rgba(31,138,91,0.12))",
            color: "var(--success)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {Icon.check(44)}
        </div>
        <div>
          <h1
            style={{
              font: "900 26px/1.1 var(--f-display)",
              color: "var(--ink)",
              margin: "var(--s-3) 0 var(--s-1)",
              letterSpacing: "-0.02em",
            }}
          >
            {t(lang, "Recepción guardada", "接收已保存")}
          </h1>
          <p
            style={{
              font: "500 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {t(
              lang,
              "Aparece en el panel del Studio en segundos",
              "几秒钟后将出现在Studio面板中",
            )}
          </p>
        </div>
        <code
          style={{
            display: "inline-block",
            padding: "var(--s-2) var(--s-3)",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-sm)",
            font: "800 15px/1 var(--f-mono)",
            color: "var(--wine)",
            letterSpacing: "0.04em",
          }}
        >
          {code}
        </code>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        <BigButton
          label={t(lang, "+ Nueva recepción", "+ 新接收")}
          onClick={onNew}
          icon={Icon.camera(20)}
        />
        <BigButton
          label={t(lang, "Volver al home", "返回主页")}
          onClick={onHome}
          variant="secondary"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BackBtn
// ─────────────────────────────────────────────────────────────────────────

function BackBtn({ onClick, lang }: { onClick: () => void; lang?: Lang }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(lang ?? "es", "Volver", "返回")}
      style={{
        width: 44,
        height: 44,
        borderRadius: "var(--r-md)",
        background: "transparent",
        border: 0,
        color: "var(--ink-soft)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {Icon.arrowL(20)}
    </button>
  );
}
