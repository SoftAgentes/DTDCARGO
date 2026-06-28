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

import { startTransition, useActionState, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { BigButton } from "@/app/m/_components/BigButton";
import { MobileHeader } from "@/app/m/_components/MobileHeader";
import { type Lang, operarioLangToLocale } from "@/lib/lang";
import { t as tDict, type I18nKey } from "@/lib/i18n";
import { createReceiptFromOperarioAction } from "../actions";
import { uploadReceiptPhotoAction } from "../photo-actions";
import {
  blobToDataUrl,
  enqueuePhoto,
  makePhotoLocalId,
} from "@/app/m/_lib/photo-queue";
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

export type PickerCity = {
  id: string;
  city: string;
  state_name: string;
};

// ─────────────────────────────────────────────────────────────────────────
// State + reducer
// ─────────────────────────────────────────────────────────────────────────

type View = "step1" | "step2" | "step3" | "step4" | "uploading" | "done";

type Photo = {
  id: number;
  /** Object URL del File para preview local */
  previewUrl: string;
  /** Blob real que se sube a Storage post-submit */
  file: File;
};

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
  /** Ciudad VE de entrega final (Opción A · capturada por operario CN). */
  destinationCity: string;
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
  destinationCity: "",
  incident: false,
  incidentNote: "",
};

type Action =
  | { type: "addPhoto"; file: File }
  | { type: "removePhoto"; id: number }
  | { type: "setOrphan"; value: boolean }
  | { type: "set"; key: keyof Reception; value: string }
  | { type: "setBool"; key: keyof Reception; value: boolean }
  | { type: "reset" };

function reducer(state: Reception, action: Action): Reception {
  switch (action.type) {
    case "addPhoto": {
      const previewUrl = URL.createObjectURL(action.file);
      return {
        ...state,
        photos: [
          ...state.photos,
          { id: Date.now() + Math.floor(Math.random() * 1000), previewUrl, file: action.file },
        ],
      };
    }
    case "removePhoto": {
      const target = state.photos.find((p) => p.id === action.id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return { ...state, photos: state.photos.filter((p) => p.id !== action.id) };
    }
    case "setOrphan":
      return { ...state, orphan: action.value, client: "" };
    case "set":
      return { ...state, [action.key]: action.value };
    case "setBool":
      return { ...state, [action.key]: action.value };
    case "reset": {
      // Liberar todos los object URLs antes de reset
      state.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return EMPTY;
    }
  }
}

/**
 * Wrapper i18n del wizard · mapea Lang (cookie es|cn) → Locale del dict
 * unificado. Firma `t(lang, key, params?)` para conservar el call-site
 * similar al helper inline anterior. SDD-0038.
 */
const t = (
  lang: Lang,
  key: I18nKey,
  params?: Record<string, string | number>,
) => tDict(operarioLangToLocale(lang), key, params);
const initialState: CreateReceiptState = {};

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────

export function NuevaRecepcionClient({
  initialLang,
  clients,
  cities,
  defaultWarehouseId,
}: {
  initialLang: Lang;
  clients: PickerClient[];
  cities: PickerCity[];
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

  // Estado de upload de fotos post-submit
  const [photoUploadCount, setPhotoUploadCount] = useState(0);
  const [photoUploadTotal, setPhotoUploadTotal] = useState(0);
  const [photoUploadErrors, setPhotoUploadErrors] = useState<string[]>([]);
  // Fotos que fallaron por red y quedaron encoladas para retry offline.
  const [photosQueued, setPhotosQueued] = useState(0);
  const photosRef = useRef<Photo[]>([]);
  // Keep latest snapshot para useEffect
  photosRef.current = reception.photos;

  // Cuando server crea receipt → arrancar upload de fotos en paralelo
  // y luego pasar a Done.
  useEffect(() => {
    if (!state.ok || !state.receiptCode) return;
    const photos = photosRef.current;
    if (photos.length === 0 || !state.receiptId) {
      // Sin fotos o sin receipt_id → directo a done (sin uploads).
      // Si no hay receipt_id es bug del server action, lo registramos.
      if (photos.length > 0 && !state.receiptId) {
        setPhotoUploadErrors(["Server no devolvió receipt_id; fotos no subieron."]);
      }
      setView("done");
      return;
    }
    let cancelled = false;
    const receiptId = state.receiptId;
    const receiptCode = state.receiptCode;
    setPhotoUploadTotal(photos.length);
    setPhotoUploadCount(0);
    setPhotoUploadErrors([]);
    setPhotosQueued(0);
    setView("uploading");

    (async () => {
      const errors: string[] = [];
      let queued = 0;

      // Encola una foto para que PhotoRetryRunner la suba sola al volver la
      // señal. Devuelve true si quedó encolada.
      const queuePhoto = async (i: number, p: Photo): Promise<boolean> => {
        try {
          const dataUrl = await blobToDataUrl(p.file);
          enqueuePhoto({
            localId: makePhotoLocalId(receiptId, i),
            receiptId,
            receiptCode,
            position: i,
            photoDataUrl: dataUrl,
            contentType: p.file.type,
            queuedAt: Date.now(),
          });
          return true;
        } catch {
          errors.push(`Foto ${i + 1}: no se pudo guardar para reintento`);
          return false;
        }
      };

      for (let i = 0; i < photos.length; i++) {
        if (cancelled) return;
        const p = photos[i];
        const fd = new FormData();
        fd.set("receipt_id", receiptId);
        fd.set("position", String(i));
        fd.set("photo", p.file);
        try {
          const res = await uploadReceiptPhotoAction(fd);
          if (!res.ok) {
            // retryable = transitorio (sesión/Storage/RPC) → encolar.
            // !retryable = validación dura (mime/size) → error visible.
            if (res.retryable) {
              if (await queuePhoto(i, p)) queued += 1;
            } else {
              errors.push(`Foto ${i + 1}: ${res.error}`);
            }
          }
        } catch {
          // Excepción = red caída (el server action no respondió) → encolar.
          if (await queuePhoto(i, p)) queued += 1;
        }
        if (!cancelled) setPhotoUploadCount(i + 1);
      }
      if (!cancelled) {
        setPhotoUploadErrors(errors);
        setPhotosQueued(queued);
        setView("done");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.ok, state.receiptCode, state.receiptId]);

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
      destination_city: reception.destinationCity.trim() || null,
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
          cities={cities}
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
      {view === "uploading" && (
        <UploadingPhotos
          lang={lang}
          count={photoUploadCount}
          total={photoUploadTotal}
        />
      )}
      {view === "done" && (
        <Done
          lang={lang}
          code={state.receiptCode ?? "—"}
          photosUploaded={Math.max(
            0,
            photoUploadTotal - photoUploadErrors.length - photosQueued,
          )}
          photosTotal={photoUploadTotal}
          photoErrors={photoUploadErrors}
          photosQueued={photosQueued}
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
        label={t(lang, "pwa.receipt.nav_back")}
        onClick={onBack}
        variant="secondary"
        disabled={isPending}
      />
      <BigButton
        label={
          isPending
            ? t(lang, "pwa.receipt.saving")
            : submitLabel ?? t(lang, "pwa.receipt.next_arrow")
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
        title={t(lang, "pwa.receipt.step1_title")}
        subtitle={t(lang, "pwa.receipt.step1_subtitle")}
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
          <PhotoAddTile
            lang={lang}
            onPicked={(file) => dispatch({ type: "addPhoto", file })}
          />
        </div>

        {photos.length > 0 && !enough && (
          <Hint
            tone="warning"
            text={t(lang, "pwa.receipt.photos_missing", { n: 3 - photos.length })}
          />
        )}
        {enough && (
          <Hint
            tone="success"
            text={t(lang, "pwa.receipt.photos_enough")}
          />
        )}

        <p
          style={{
            marginTop: "var(--s-3)",
            font: "500 11.5px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
          }}
        >
          {t(lang, "pwa.receipt.photo_hint")}
        </p>
      </div>

      <BottomActions lang={lang} onBack={onBack} onNext={onNext} nextDisabled={!enough} />
    </div>
  );
}

/**
 * PhotoAddTile — usa `<label for=input file capture=environment>` para
 * abrir la cámara nativa del cel (Android Chrome / iOS Safari). Cada
 * tap crea un input nuevo (key dinámica) para evitar el bug de iOS
 * que cachea el último File seleccionado.
 */
function PhotoAddTile({
  lang,
  onPicked,
}: {
  lang: Lang;
  onPicked: (file: File) => void;
}) {
  const inputId = `photo-input-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <label
      htmlFor={inputId}
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
      {t(lang, "pwa.receipt.take_photo")}
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPicked(file);
          // Reset para permitir mismo archivo dos veces en sucesión
          e.currentTarget.value = "";
        }}
      />
    </label>
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.previewUrl}
        alt={t(lang, "pwa.receipt.photo_n", { n: index + 1 })}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
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
        {t(lang, "pwa.receipt.photo_n", { n: index + 1 })}
      </span>
      {/* Hitbox 44x44 (Apple HIG / WCAG 2.5.8) con visual 28x28 centrado */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t(lang, "pwa.receipt.remove_photo")}
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

// PhotoPlaceholder ya no se usa (fotos reales con <img src=previewUrl/>).
// Removido en SDD-0028 Fase 3.

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
        title={t(lang, "pwa.receipt.step2_title")}
        subtitle={t(lang, "pwa.receipt.step2_subtitle")}
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
              label={t(lang, "pwa.receipt.visible_marks")}
              value={marks}
              onChange={(v) => dispatch({ type: "set", key: "marks", value: v })}
              placeholder={t(lang, "pwa.receipt.marks_ph")}
            />
            <MobileInput
              label={t(lang, "pwa.receipt.brought_by")}
              value={reception.broughtBy}
              onChange={(v) => dispatch({ type: "set", key: "broughtBy", value: v })}
              placeholder={t(lang, "pwa.receipt.brought_by_ph")}
            />
          </div>
        ) : (
          <div>
            <MobileInput
              label={t(lang, "pwa.receipt.search_client")}
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
                  {t(lang, "pwa.receipt.no_matches")}
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
        {t(lang, "pwa.receipt.orphan_toggle")}
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
  cities,
  dispatch,
  onBack,
  onNext,
}: {
  lang: Lang;
  reception: Reception;
  cities: PickerCity[];
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
        title={t(lang, "pwa.receipt.step3_title")}
        subtitle={t(lang, "pwa.receipt.step3_subtitle")}
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
          label={t(lang, "pwa.receipt.supplier")}
          value={reception.supplier}
          onChange={(v) => set("supplier", v)}
          placeholder={t(lang, "pwa.receipt.supplier_ph")}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-2)" }}>
          <NumLabel label={t(lang, "pwa.receipt.boxes")}>
            <NumericInput
              type="count"
              unit="cj"
              value={reception.boxes === "" ? null : Number(reception.boxes)}
              onChange={(v) => set("boxes", v != null ? String(v) : "")}
              placeholder="0"
              min={1}
            />
          </NumLabel>
          <NumLabel label="CBM">
            <NumericInput
              type="volume"
              value={reception.cbm === "" ? null : Number(reception.cbm)}
              onChange={(v) => set("cbm", v != null ? String(v) : "")}
              placeholder="0.00"
              min={0}
            />
          </NumLabel>
        </div>

        <NumLabel label={t(lang, "pwa.receipt.total_weight")}>
          <NumericInput
            type="weight"
            value={reception.weight === "" ? null : Number(reception.weight)}
            onChange={(v) => set("weight", v != null ? String(v) : "")}
            placeholder="0"
            min={0}
          />
        </NumLabel>

        <MobileInput
          label={t(lang, "pwa.receipt.hs_code")}
          value={reception.hs}
          onChange={(v) => set("hs", v)}
          placeholder="0000.00"
          mono
        />

        {/* Ciudad destino · Opción A SDD-0029 · alimenta scoring de Despacho */}
        <MobileCitySelect
          lang={lang}
          cities={cities}
          value={reception.destinationCity}
          onChange={(v) => set("destinationCity", v)}
        />
      </div>

      <BottomActions lang={lang} onBack={onBack} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

function MobileCitySelect({
  lang,
  cities,
  value,
  onChange,
}: {
  lang: Lang;
  cities: PickerCity[];
  value: string;
  onChange: (v: string) => void;
}) {
  const hasCatalog = cities.length > 0;
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
        {t(lang, "pwa.receipt.dest_city")}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 48,
          padding: "0 14px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        {hasCatalog ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: "transparent",
              font: "500 16px/1 var(--f-sans)",
              color: value ? "var(--ink)" : "var(--ink-mute)",
              appearance: "none",
              WebkitAppearance: "none",
            }}
          >
            <option value="">{t(lang, "pwa.receipt.choose")}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.city}>
                {c.city} · {c.state_name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t(lang, "pwa.receipt.city_ph")}
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: "transparent",
              font: "500 16px/1 var(--f-sans)",
              color: "var(--ink)",
              minWidth: 0,
            }}
          />
        )}
      </div>
      <span
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          marginTop: 2,
        }}
      >
        {hasCatalog
          ? t(lang, "pwa.receipt.cities_loaded", { n: cities.length })
          : t(lang, "pwa.receipt.cities_empty")}
      </span>
    </label>
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
        title={t(lang, "pwa.receipt.step4_title")}
        subtitle={t(lang, "pwa.receipt.step4_subtitle")}
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
            {t(lang, "pwa.receipt.summary")}
          </div>
          <SummaryRow label={t(lang, "pwa.receipt.photos_label")} value={`${reception.photos.length}`} />
          <SummaryRow
            label={t(lang, "pwa.receipt.client")}
            value={
              reception.orphan
                ? t(lang, "pwa.receipt.orphan_summary", { marks: reception.marks })
                : clientObj?.name ?? reception.client
            }
            highlight={reception.orphan ? "warning" : undefined}
          />
          {!reception.orphan && reception.client && (
            <SummaryRow label="Shipping Mark" value={reception.client} mono />
          )}
          <SummaryRow label={t(lang, "pwa.receipt.supplier_label")} value={reception.supplier || "—"} />
          <SummaryRow label={t(lang, "pwa.receipt.boxes_short")} value={reception.boxes} mono />
          <SummaryRow label="CBM" value={`${reception.cbm} m³`} mono />
          {reception.weight && (
            <SummaryRow label={t(lang, "pwa.receipt.weight_label")} value={`${reception.weight} kg`} mono />
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
            {t(lang, "pwa.receipt.report_incident")}
          </span>
        </button>

        {reception.incident && (
          <MobileInput
            label={t(lang, "pwa.receipt.incident_desc")}
            value={reception.incidentNote}
            onChange={(v) => dispatch({ type: "set", key: "incidentNote", value: v })}
            placeholder={t(lang, "pwa.receipt.incident_ph")}
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
        submitLabel={t(lang, "pwa.receipt.submit_register")}
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

// ─────────────────────────────────────────────────────────────────────────
// UPLOADING PHOTOS
// ─────────────────────────────────────────────────────────────────────────

function UploadingPhotos({
  lang,
  count,
  total,
}: {
  lang: Lang;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 var(--s-5)",
        gap: "var(--s-4)",
      }}
    >
      {/* Spinner ring + count */}
      <div
        style={{
          position: "relative",
          width: 96,
          height: 96,
          borderRadius: "50%",
          background: "var(--bg-elevated)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid var(--wine-tint, rgba(127,15,26,0.15))",
            borderTopColor: "var(--wine)",
            animation: "spin 1s linear infinite",
          }}
        />
        <span style={{ font: "900 22px/1 var(--f-display)", color: "var(--wine)" }}>
          {count}/{total}
        </span>
      </div>
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            font: "900 22px/1.1 var(--f-display)",
            color: "var(--ink)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {t(lang, "pwa.receipt.uploading_photos")}
        </h2>
        <p
          style={{
            font: "500 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "var(--s-2) 0 0",
          }}
        >
          {t(lang, "pwa.receipt.dont_close")} · {pct}%
        </p>
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DONE
// ─────────────────────────────────────────────────────────────────────────

function Done({
  lang,
  code,
  photosUploaded,
  photosTotal,
  photoErrors,
  photosQueued,
  onNew,
  onHome,
}: {
  lang: Lang;
  code: string;
  photosUploaded: number;
  photosTotal: number;
  photoErrors: string[];
  photosQueued: number;
  onNew: () => void;
  onHome: () => void;
}) {
  const hasErrors = photoErrors.length > 0;
  const allOk = !hasErrors && photosQueued === 0;
  const toast = useToast();

  // Toast post-success (trazabilidad visual · sobrevive interrupciones)
  useEffect(() => {
    if (code === "—") return;
    if (allOk) {
      toast.success(
        t(lang, "pwa.receipt.saved_toast", { code }),
      );
    } else if (!hasErrors && photosQueued > 0) {
      // Recepción OK, solo quedaron fotos encoladas por red → se subirán solas.
      toast.warning(
        t(lang, "pwa.receipt.photos_queued", { n: photosQueued }),
      );
    } else {
      toast.warning(
        t(lang, "pwa.receipt.saved_with_errors", {
          code,
          n: photoErrors.length,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
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
            {t(lang, "pwa.receipt.saved_title")}
          </h1>
          <p
            style={{
              font: "500 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {t(lang, "pwa.receipt.appears_in_studio")}
          </p>
          {photosTotal > 0 && (
            <p
              style={{
                font: "600 12px/1.4 var(--f-sans)",
                color: allOk ? "var(--success)" : "var(--warning)",
                margin: "var(--s-2) 0 0",
              }}
            >
              {allOk
                ? t(lang, "pwa.receipt.photos_uploaded", { n: photosUploaded })
                : !hasErrors && photosQueued > 0
                  ? t(lang, "pwa.receipt.photos_queued", { n: photosQueued })
                  : t(lang, "pwa.receipt.photos_progress", {
                      up: photosUploaded,
                      total: photosTotal,
                      err: photoErrors.length,
                    })}
            </p>
          )}
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
          label={t(lang, "pwa.receipt.new_another")}
          onClick={onNew}
          icon={Icon.camera(20)}
        />
        <BigButton
          label={t(lang, "pwa.receipt.back_home")}
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

/**
 * NumLabel · wrapper que reusa el label uppercase del MobileInput para
 * envolver un <NumericInput> del Studio. Mantiene consistencia visual
 * con el resto del wizard mientras gana las expresiones aritméticas.
 */
function NumLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
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
      {children}
    </label>
  );
}

function BackBtn({ onClick, lang }: { onClick: () => void; lang?: Lang }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(lang ?? "es", "pwa.receipt.back_generic")}
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
