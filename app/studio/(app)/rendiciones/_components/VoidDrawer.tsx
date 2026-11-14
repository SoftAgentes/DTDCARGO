"use client";

/**
 * VoidDrawer (SDD-0069 · decisión #6) — anular una rendición (admin + motivo).
 *
 * Anular revierte los recibos a `aplicado` (vuelven a estar disponibles) y deja
 * la rendición en el historial. Es el ÚNICO cambio permitido post-emisión, por
 * eso exige un motivo. <ActionButton danger> (acción crítica con side-effects).
 *
 * Solo tokens var(--*); sentence case; tuteo.
 */

import { useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { fmtAmount } from "@/lib/studio/renditions/printable";
import type { Rendition } from "@/lib/studio/renditions/types";
import { voidRenditionAction } from "../actions";

export function VoidDrawer({
  rendition,
  onClose,
  onVoided,
}: {
  rendition: Rendition;
  onClose: () => void;
  onVoided: (renditionCode: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canSubmit = reason.trim().length > 0;

  return (
    <DrawerShell
      title="Anular rendición"
      subtitle={`${rendition.rendition_code} · ${rendition.period_from} → ${rendition.period_to}`}
      onClose={onClose}
      pending={false}
      width={520}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
            background: "var(--bg-base)",
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Neto a favor de la Operadora:{" "}
          <strong style={{ color: "var(--ink)", fontFamily: "var(--f-mono)" }}>
            USD {fmtAmount(rendition.net_to_operadora_usd)}
          </strong>{" "}
          · {rendition.receipt_count} recibos.
        </div>

        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Al anular, los recibos vuelven a estado aplicado y quedan disponibles
          para una nueva rendición. La rendición anulada permanece en el
          historial con su motivo.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="studio-label" htmlFor="void-reason">
            Motivo de la anulación{" "}
            <span style={{ color: "var(--danger)", fontWeight: 600 }}>
              · obligatorio
            </span>
          </label>
          <textarea
            id="void-reason"
            className="studio-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ej.: período mal cortado, recibo incluido por error…"
            style={{ resize: "vertical", minHeight: 72 }}
            aria-required={true}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "void-reason-error" : undefined}
          />
        </div>

        {error && (
          <Aviso id="void-reason-error" tono="error" compacto>
            {error}
          </Aviso>
        )}
      </div>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          onClick={onClose}
        >
          Cancelar
        </button>
        <ActionButton
          variant="danger"
          idleLabel="Anular rendición"
          loadingLabel="Anulando…"
          successLabel="Rendición anulada"
          disabled={!canSubmit}
          onAction={async () => {
            setError(null);
            const r = await voidRenditionAction(rendition.id, reason.trim());
            if (r.error) throw new Error(r.error);
            onVoided(r.renditionCode ?? rendition.rendition_code);
          }}
          onError={setError}
        />
      </footer>
    </DrawerShell>
  );
}
