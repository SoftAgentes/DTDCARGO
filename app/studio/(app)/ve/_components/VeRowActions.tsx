"use client";

/**
 * VeRowActions — menú "···" en cada row del listado VE.
 *
 * Las acciones se muestran condicionalmente según el status actual del
 * shipment (ver availableActions en warehouse-ve-types.ts).
 *
 * Inputs adicionales (pod_signed_by, reason de incidencia) se piden con
 * un modal inline en lugar de window.prompt — refactor 2026-05-26 que
 * cierra deuda técnica `studio-tech-debt-post-sprint3` item 3 (los
 * prompts se rompían en demos con cliente).
 *
 * Cuando llegue refactor completo de TMS, "Asignar reparto" delega al
 * módulo TMS con form completo (ya hecho).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import {
  VE_ACTION_LABELS,
  availableActions,
  type VeAction,
} from "@/lib/studio/warehouse-ve-types";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";
import {
  markCustomsReleasedAction,
  markDeliveredAction,
  reportIncidentAction,
  loadVeNormalContextAction,
  transitionNormalVeShipmentAction,
  completeNormalVeDeliveryAction,
} from "../actions";
import type { NormalShipmentRead, NormalShipmentContext } from "@/lib/studio/client-consolidation/types";

interface Props {
  shipmentId: string;
  status: ShipmentStatus;
  /** Deprecated post-SDD-0019: el flow asignar reparto va a TMS. Se mantiene
   *  como prop opcional para no romper callers existentes. */
  currentDeliveryAddress?: string | null;
}

/** Estado del modal inline · null = cerrado. */
type PromptState =
  | null
  | {
      kind: "delivered";
      title: string;
      label: string;
      placeholder: string;
      required: boolean;
      multiline: boolean;
    }
  | {
      kind: "incident";
      title: string;
      label: string;
      placeholder: string;
      required: boolean;
      multiline: boolean;
    };

export function VeRowActions(props: Props) {
  const [normal, setNormal] = useState<NormalShipmentRead | null>(null);
  useEffect(() => {
    let current = true;
    setNormal(null);
    void loadVeNormalContextAction(props.shipmentId).then((result) => { if (current) setNormal(result); }, () => {
      if (current) setNormal({ available: false, error: "No se pudo comprobar el ámbito del envío. Actualiza antes de operar." });
    });
    return () => { current = false; };
  }, [props.shipmentId, props.status]);
  if (!normal || !normal.available || normal.context.shipmentId !== props.shipmentId || !normal.context.complete
    || normal.context.cohort && normal.context.group?.status !== props.status) {
    return <span role="status">{normal && !normal.available ? normal.error : "Comprobando el envío…"} <a href={`/studio/tracking/${props.shipmentId}`}>Ver detalle</a></span>;
  }
  if (!normal.context.cohort) return <LegacyVeRowActions {...props} />;
  return <NormalVeRowActions key={`${props.shipmentId}:${normal.context.group?.status}:${normal.context.manifest?.revision}`} context={normal.context} />;
}

/** Legacy presentation is reachable only after an explicit, complete classification. */
function LegacyVeRowActions({
  shipmentId,
  status,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [deliveryDecision, setDeliveryDecision] = useState<{
    receivedBy: string;
    requestRef: string;
  } | null>(null);
  const [deliveryError, setDeliveryError] = useState<string>();
  const wrapRef = useRef<HTMLDivElement>(null);

  const actions = availableActions(status);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const handle = (action: VeAction) => {
    setError(null);
    setOpen(false);

    if (action === "view_detail") {
      router.push(`/studio/tracking/${shipmentId}`);
      return;
    }

    if (action === "mark_customs_released") {
      startTransition(async () => {
        const result = await markCustomsReleasedAction(shipmentId);
        if (result?.error) setError(result.error);
        else if (result?.ok) router.refresh();
      });
      return;
    }

    if (action === "assign_delivery") {
      router.push(`/studio/tms?view=route&shipment=${shipmentId}`);
      return;
    }

    if (action === "mark_delivered") {
      setPrompt({
        kind: "delivered",
        title: "Identificar receptor",
        label: "¿Quién recibió la entrega?",
        placeholder: "Nombre del receptor",
        required: true,
        multiline: false,
      });
      return;
    }

    if (action === "report_incident") {
      setPrompt({
        kind: "incident",
        title: "Reportar incidencia",
        label: "Describe qué pasó",
        placeholder: "Ej: caja dañada al recibir, falta una unidad…",
        required: true,
        multiline: true,
      });
      return;
    }
  };

  /** Confirm del modal · llama la action correspondiente. */
  const onPromptConfirm = (value: string) => {
    if (!prompt) return;
    const trimmed = value.trim();
    if (prompt.required && !trimmed) {
      setError("Este campo es obligatorio.");
      return;
    }
    if (prompt.kind === "delivered") {
      setPrompt(null);
      setDeliveryError(undefined);
      setDeliveryDecision({
        receivedBy: trimmed,
        requestRef: `warehouse-ve-delivery:${shipmentId}:${crypto.randomUUID()}`,
      });
      return;
    }
    startTransition(async () => {
      const result = await reportIncidentAction(shipmentId, { reason: trimmed });
      setPrompt(null);
      if (result?.error) setError(result.error);
      else if (result?.ok) router.refresh();
    });
  };

  const confirmDelivery = (reason: string) => {
    if (!deliveryDecision || pending) return;
    startTransition(async () => {
      setDeliveryError(undefined);
      try {
        const result = await markDeliveredAction({
          shipmentId,
          from: status,
          receivedBy: deliveryDecision.receivedBy,
          reason,
          requestRef: deliveryDecision.requestRef,
        });
        if (result.error) {
          setDeliveryError(result.error);
          return;
        }
        setDeliveryDecision(null);
        router.refresh();
      } catch {
        setDeliveryError(
          "No se pudo confirmar la entrega. Conservamos la referencia para reintentar.",
        );
      }
    });
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={pending}
        aria-label="Acciones del shipment VE"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-soft)",
          cursor: pending ? "wait" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!pending) {
            e.currentTarget.style.background = "var(--bg-elevated)";
            e.currentTarget.style.color = "var(--ink)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ink-soft)";
        }}
      >
        {Icon.more(14)}
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 240,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            padding: "var(--s-1)",
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            style={{
              padding: "6px 10px 4px",
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Acciones operativas
          </div>
          {actions.map((action) => {
            const isDetail = action === "view_detail";
            const isIncident = action === "report_incident";
            return (
              <button
                key={action}
                role="menuitem"
                type="button"
                onClick={() => handle(action)}
                disabled={pending}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  border: 0,
                  background: "transparent",
                  color: isIncident ? "var(--danger)" : "var(--ink)",
                  font: "500 12.5px/1.2 var(--f-sans)",
                  cursor: pending ? "wait" : "pointer",
                  borderRadius: "var(--r-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-2)",
                }}
                onMouseEnter={(e) => {
                  if (!pending) {
                    if (isIncident) {
                      e.currentTarget.style.background = "var(--danger-bg)";
                    } else if (isDetail) {
                      e.currentTarget.style.background = "var(--bg-elevated)";
                    } else {
                      e.currentTarget.style.background = "var(--wine-tint)";
                      e.currentTarget.style.color = "var(--wine)";
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  if (!pending) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = isIncident
                      ? "var(--danger)"
                      : "var(--ink)";
                  }
                }}
              >
                <span style={{ flex: 1 }}>{VE_ACTION_LABELS[action]}</span>
                {isDetail && (
                  <span style={{ color: "var(--ink-mute)" }}>
                    {Icon.arrowR(11)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            padding: "6px 10px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--danger)",
            whiteSpace: "nowrap",
            zIndex: 31,
            maxWidth: 320,
          }}
        >
          {error}
        </div>
      )}

      {prompt && (
        <PromptModal
          title={prompt.title}
          label={prompt.label}
          placeholder={prompt.placeholder}
          required={prompt.required}
          multiline={prompt.multiline}
          pending={pending}
          onCancel={() => setPrompt(null)}
          onConfirm={onPromptConfirm}
        />
      )}
      <ConfirmDialog
        open={deliveryDecision !== null}
        danger
        reason
        reasonRequired
        holdToConfirm
        initialFocus="safe"
        title="Confirmar entrega manual"
        message={
          deliveryDecision
            ? `Receptor: ${deliveryDecision.receivedBy}. Esta decisión cerrará el embarque como entregado y quedará en auditoría. Es una constancia manual y no sustituye el POD sellado con foto y firma de la PWA de Despacho.`
            : ""
        }
        confirmLabel="Confirmar entrega"
        holdLabel="Mantén para confirmar"
        reasonLabel="Evidencia o motivo de la confirmación"
        reasonPlaceholder="Ej. Receptor identificado y entrega verificada por Operaciones"
        pending={pending}
        error={deliveryError}
        onCancel={() => {
          if (pending) return;
          setDeliveryDecision(null);
          setDeliveryError(undefined);
        }}
        onConfirm={confirmDelivery}
      />
    </div>
  );
}

function NormalVeRowActions({ context }: { context: NormalShipmentContext }) {
  const router = useRouter(); const group = context.group; const manifest = context.manifest;
  const [operation, setOperation] = useState<"release_ve" | "manual_delivery" | null>(null);
  const [reference, setReference] = useState(""); const [receivedBy, setReceivedBy] = useState("");
  const [attest, setAttest] = useState(false); const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>(); const [pending, startTransition] = useTransition();
  const busy = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (!group || !manifest || !context.complete || !manifest.sealed || !manifest.sealId) {
    return <span>Falta el manifiesto completo y sellado. <a href={`/studio/tracking/${context.shipmentId}`}>Ver detalle</a></span>;
  }
  const open = (next: "release_ve" | "manual_delivery") => {
    if (busy.current) return;
    setOperation(next); setReference(crypto.randomUUID()); setReceivedBy(""); setAttest(false); setError(undefined);
    setConfirming(next === "release_ve");
  };
  const confirm = (reason: string) => {
    if (!operation || busy.current || (operation === "manual_delivery" && (!attest || receivedBy.trim().length < 2))) return;
    busy.current = true;
    const input = { shipmentId: group.shipmentId, expectedStatus: group.status, expectedGroupRevision: group.revision,
      expectedContainerRevision: manifest.revision, reference, reason };
    startTransition(async () => {
      try {
        const result = operation === "release_ve"
          ? await transitionNormalVeShipmentAction({ ...input, operation: "release_ve" })
          : await completeNormalVeDeliveryAction({ ...input, sealId: manifest.sealId, receiptIds: group.receiptIds,
            receivedBy, attestComplete: attest });
        if (!mounted.current) return;
        if (result.error || !result.ok) { setError(result.error ?? "No se pudo comprobar la operación. Conserva la referencia."); return; }
        setConfirming(false); setOperation(null); router.refresh();
      } catch { if (mounted.current) setError("No se pudo comprobar la operación. Conservamos la referencia para consultar o reintentar."); }
      finally { busy.current = false; }
    });
  };
  return <div>
    <a href={`/studio/tracking/${group.shipmentId}`}>Ver envío {group.code}</a>
    {group.status === "in_customs" && <button type="button" disabled={pending} onClick={() => open("release_ve")}>Confirmar liberación de aduana</button>}
    {group.status === "arrived_destination" && <a href={`/studio/tms?view=route&shipment=${group.shipmentId}`}>Asignar reparto en TMS</a>}
    {["out_for_delivery", "last_mile"].includes(group.status) && <button type="button" disabled={pending} onClick={() => open("manual_delivery")}>Confirmar entrega manual del grupo</button>}
    {operation === "manual_delivery" && !confirming && <section aria-label="Revisar entrega del grupo completo">
      <p>{group.code} · {group.receiptIds.length} recepciones · {group.measures.boxes} cajas · {group.measures.cbm} m³ · {group.measures.weightKg} kg.</p>
      <p>Sello vigente · revisión del grupo {group.revision} · revisión del contenedor {manifest.revision}.</p>
      <ul>{group.receiptIds.map((id) => <li key={id}>Recepción {id}</li>)}</ul>
      <label>Receptor <input value={receivedBy} maxLength={200} onChange={(event) => setReceivedBy(event.target.value)} /></label>
      <label><input type="checkbox" checked={attest} onChange={(event) => setAttest(event.target.checked)} />Atesto la entrega de todas las recepciones y cajas de este grupo sellado.</label>
      <p>Constancia manual; no sustituye la foto y firma del POD de Despacho.</p>
      <button type="button" onClick={() => setOperation(null)}>Cancelar</button>
      <button type="button" disabled={!attest || receivedBy.trim().length < 2} onClick={() => setConfirming(true)}>Revisar confirmación</button>
    </section>}
    <ConfirmDialog open={confirming} danger={operation === "manual_delivery"} reason reasonRequired
      holdToConfirm={operation === "manual_delivery"} initialFocus="safe" pending={pending} error={error}
      title={operation === "manual_delivery" ? "Confirmar entrega manual del grupo completo" : "Confirmar liberación de aduana"}
      message={operation === "manual_delivery"
        ? `${group.code}: ${group.receiptIds.length} recepciones, ${group.measures.boxes} cajas. Receptor: ${receivedBy}. Atestas todo el grupo sellado. Se cerrará como entregado con auditoría; esta constancia manual no es un POD.`
        : `${group.code}: confirmas su liberación operativa de aduana, listo para retiro. Este hito no acredita ingreso físico en almacén y no emite una factura.`}
      confirmLabel={operation === "manual_delivery" ? "Confirmar entrega completa" : "Confirmar liberación"}
      reasonLabel="Evidencia o motivo" onCancel={() => { if (!busy.current) { setConfirming(false); setOperation(null); setError(undefined); } }} onConfirm={confirm} />
  </div>;
}

// ─────────────────────────────────────────────────────────────
// PromptModal · reemplazo de window.prompt() con UI nativa del Studio
// ─────────────────────────────────────────────────────────────

function PromptModal({
  title,
  label,
  placeholder,
  required,
  multiline,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  label: string;
  placeholder: string;
  required: boolean;
  multiline: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogA11y(panelRef, {
    onClose: onCancel,
    pending,
    initialFocusRef: inputRef,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--s-4)",
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          color: "var(--ink)",
          width: "100%",
          maxWidth: 440,
          borderRadius: "var(--r-lg, 12px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          padding: "var(--s-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
          outline: "none",
        }}
      >
        <h2
          id="prompt-modal-title"
          style={{
            margin: 0,
            fontFamily: "var(--font-archivo-black, 'Archivo Black')",
            fontSize: 18,
            color: "var(--ink)",
          }}
        >
          {title}
        </h2>

        <form
          onSubmit={submit}
          style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-soft)",
              }}
            >
              {label}
              {required && (
                <span style={{ color: "var(--danger)", marginLeft: "var(--s-1)" }}>*</span>
              )}
            </span>
            {multiline ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                required={required}
                disabled={pending}
                rows={4}
                style={{
                  padding: "var(--s-3)",
                  border: "1px solid var(--border, #E8E6E2)",
                  borderRadius: 6,
                  background: "var(--bg-base)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  minHeight: 80,
                }}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                required={required}
                disabled={pending}
                style={{
                  height: 38,
                  padding: "0 12px",
                  border: "1px solid var(--border, #E8E6E2)",
                  borderRadius: 6,
                  background: "var(--bg-base)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            )}
          </label>

          <div
            style={{
              display: "flex",
              gap: "var(--s-2)",
              justifyContent: "flex-end",
              marginTop: "var(--s-1)",
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="studio-btn studio-btn-primary studio-btn-sm"
            >
              {pending ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
