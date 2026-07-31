"use client";

/**
 * "Mis reclamos" del portal (SDD-0101 · Slice B). El cliente reporta un problema
 * (daño/faltante/retraso) y ve el estado de sus reclamos, read-only. El equipo
 * gestiona el ciclo de vida desde el Studio. Reusa los helpers PUROS de
 * claims-types (el portal no está bajo la frontera público↔ERP).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CLAIM_TYPE_OPTIONS,
  CLAIM_FLOW_STEPS,
  claimStatusLabel,
  claimStatusStep,
  claimStatusTone,
  claimTypeLabel,
  isClaimTerminal,
} from "@/lib/studio/reclamos/claims-types";
import type { PortalClaimRow } from "@/lib/portal/portal-claims";
import type { ClaimEvidenceItem } from "@/lib/studio/reclamos/claim-evidence";
import { createPortalClaimAction, type PortalClaimState } from "../actions";

const initial: PortalClaimState = {};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

const INPUT_CLASS =
  "px-3.5 py-3 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink leading-[1.5] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1";

export function PortalClaims({
  claims,
  shipments,
  evidence,
  embedded = false,
}: {
  claims: PortalClaimRow[];
  shipments: { id: string; code: string }[];
  evidence: Record<string, ClaimEvidenceItem[]>;
  /** `true` = columna "Tus casos" de la pantalla Soporte (SDD-0147): sin el h1
   *  propio y con el formulario "Nuevo caso" colapsable. `false` = pantalla suelta. */
  embedded?: boolean;
}) {
  const [state, action, pending] = useActionState(
    createPortalClaimAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [justSent, setJustSent] = useState<string | null>(null);
  // En embedded el form arranca colapsado (se abre con "Nuevo caso"); suelto, visible.
  const [showForm, setShowForm] = useState(!embedded);
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.ok && state.createdCode) setJustSent(state.createdCode);
  }

  useEffect(() => {
    if (state.ok && state.createdCode) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      {embedded ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="eyebrow eyebrow-wine">Tus casos</div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            <span aria-hidden className="text-[16px] leading-none">
              {showForm ? "–" : "+"}
            </span>{" "}
            Nuevo caso
          </button>
        </div>
      ) : (
        <>
          <span className="eyebrow">Postventa</span>
          <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
            Mis reclamos.
          </h1>
          <p className="lead mt-3">
            ¿Algo salió mal con tu carga? Repórtalo acá y hazle seguimiento. Tu
            asesor lo evalúa y te confirma la resolución.
          </p>
        </>
      )}

      {/* Reportar un problema (colapsable en embedded) */}
      {showForm && (
      <div className={`${embedded ? "mt-4" : "mt-8"} bg-white border border-grey-200 rounded-[16px] p-5 sm:p-6`}>
        <div className="text-[16px] font-bold text-ink">Reportar un problema</div>
        <p className="mt-1 text-[13.5px] text-grey-700 leading-[1.5]">
          Cuéntanos qué pasó. El monto y la cobertura los evalúa tu asesor.
        </p>

        <form ref={formRef} action={action} className="mt-4 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
              Tipo de problema
            </span>
            <select name="claim_type" required disabled={pending} className={INPUT_CLASS} defaultValue="">
              <option value="" disabled>
                Elige una opción…
              </option>
              {CLAIM_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.claim_type && (
              <span className="text-[12.5px] text-wine">{state.fieldErrors.claim_type}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
              ¿Qué pasó?
            </span>
            <textarea
              name="description"
              required
              rows={3}
              maxLength={2000}
              disabled={pending}
              placeholder="Ej.: la caja 12 de 30 llegó con producto quebrado; faltan 2 cajas; la entrega llegó 6 días tarde…"
              className={`${INPUT_CLASS} resize-y`}
            />
            {state.fieldErrors?.description && (
              <span className="text-[12.5px] text-wine">{state.fieldErrors.description}</span>
            )}
          </label>

          {shipments.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
                Envío relacionado <span className="text-grey-300 normal-case tracking-normal">(opcional)</span>
              </span>
              <select name="shipment_id" disabled={pending} className={INPUT_CLASS} defaultValue="">
                <option value="">Sin envío específico</option>
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
              Fotos o documentos <span className="text-grey-300 normal-case tracking-normal">(opcional)</span>
            </span>
            <input
              type="file"
              name="evidence"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              disabled={pending}
              className="text-[13px] text-grey-700 file:mr-3 file:rounded-[8px] file:border-0 file:bg-grey-100 file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-ink hover:file:bg-grey-200 disabled:opacity-60"
            />
            <span className="text-[12px] text-grey-500">
              Una foto del daño o el faltante ayuda a resolver más rápido. Hasta 8
              archivos · imágenes o PDF · máx 10 MB c/u.
            </span>
          </label>

          {state.error && (
            <p className="text-[13px] text-wine leading-[1.4]">{state.error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
            >
              {pending ? "Enviando…" : "Enviar reclamo"}
            </button>
          </div>
        </form>

        {justSent && (
          <div
            className="mt-4 rounded-[10px] px-3.5 py-3 text-[13.5px] leading-[1.5]"
            style={{
              background: "color-mix(in srgb, var(--color-status-success) 12%, transparent)",
              color: "var(--color-status-success)",
            }}
            role="status"
          >
            Reclamo {justSent} enviado. Tu asesor lo va a revisar y te confirma la resolución.
            {state.evidenceSkipped && (
              <span className="block mt-1.5 text-[12.5px] text-grey-700">
                Algunos archivos no se adjuntaron (deben ser JPG/PNG/PDF y pesar
                menos de 10 MB). Si quieres, envíaselos a tu asesor por el chat.
              </span>
            )}
          </div>
        )}
      </div>
      )}

      {/* Lista de casos/reclamos */}
      <div className={embedded ? "mt-5" : "mt-10"}>
        {!embedded && (
          <div className="text-[13px] font-semibold tracking-[0.08em] uppercase text-grey-500">
            Tus reclamos
          </div>
        )}
        {claims.length === 0 ? (
          <p className="mt-3 text-[14px] text-grey-700 leading-[1.55] max-w-[52ch]">
            Todavía no has reportado ningún reclamo. Si tu carga llegó con un
            problema, {embedded ? 'usa "Nuevo caso" arriba.' : "usa el formulario de arriba."}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {claims.map((c) => (
              <ClaimCard key={c.id} claim={c} evidence={evidence[c.id] ?? []} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClaimCard({
  claim,
  evidence,
}: {
  claim: PortalClaimRow;
  evidence: ClaimEvidenceItem[];
}) {
  const step = claimStatusStep(claim.status);
  const terminal = isClaimTerminal(claim.status);

  return (
    <div className="bg-white border border-grey-200 rounded-[14px] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className="text-[13.5px] font-bold text-ink"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            >
              {claim.code}
            </span>
            <span className="text-[12.5px] text-grey-700">{claimTypeLabel(claim.type)}</span>
            {claim.shipmentCode && (
              <span
                className="text-[12px] text-grey-500"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {claim.shipmentCode}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.5]">{claim.description}</p>
        </div>
        <span
          className={`badge-status badge-status-${claimStatusTone(claim.status)} whitespace-nowrap`}
        >
          <span className="badge-status-dot" aria-hidden />
          {claimStatusLabel(claim.status)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-grey-500">
        {!terminal && (
          <>
            <span>
              Fase {step} de 3 · {CLAIM_FLOW_STEPS[step - 1]}
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{fmtDate(claim.createdAt)}</span>
      </div>

      {evidence.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {evidence.map((e) => (
            <EvidenceThumb key={e.id} item={e} />
          ))}
        </div>
      )}

      {claim.resolutionNote && (
        <div className="mt-3 rounded-[10px] bg-grey-100 px-3.5 py-2.5 text-[13px] text-grey-700 leading-[1.5]">
          <span className="font-semibold text-ink">Resolución: </span>
          {claim.resolutionNote}
        </div>
      )}
    </div>
  );
}

function EvidenceThumb({ item }: { item: ClaimEvidenceItem }) {
  if (!item.url) {
    return (
      <span className="flex items-center justify-center h-16 w-16 rounded-[8px] border border-grey-200 bg-grey-100 text-[11px] text-grey-500">
        —
      </span>
    );
  }
  if (item.isImage) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.fileName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.fileName}
          loading="lazy"
          className="h-16 w-16 rounded-[8px] object-cover border border-grey-200"
        />
      </a>
    );
  }
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      title={item.fileName}
      className="flex items-center h-16 px-3 rounded-[8px] border border-grey-200 bg-grey-100 text-[12px] font-semibold text-grey-700 max-w-[170px] truncate"
    >
      {item.fileName}
    </a>
  );
}
