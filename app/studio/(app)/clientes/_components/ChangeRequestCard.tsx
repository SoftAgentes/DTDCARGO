"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  buildChangeRequestDiff,
  type ClientChangeRequest,
} from "@/lib/portal/change-request-types";
import {
  approveChangeRequestAction,
  rejectChangeRequestAction,
} from "../change-request-actions";

/**
 * Solicitud de cambio de datos pendiente (SDD-0151). El cliente propuso corregir
 * su identidad desde el portal; el asesor ve el diff antes→propuesto y aprueba
 * (aplica a la ficha) o rechaza (con nota que el cliente verá). Solo se renderiza
 * cuando hay una solicitud PENDING.
 */
export function ChangeRequestCard({
  req,
  markbox,
  isEmpresa,
}: {
  req: ClientChangeRequest;
  markbox: string;
  isEmpresa: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  // Si la aprobación reseteó la verificación (cambió nombre/RIF), el toast lo
  // avisa para que el asesor re-verifique. Ref (no state) → sin re-render.
  const identityResetRef = useRef(false);

  const diff = buildChangeRequestDiff(req, isEmpresa);

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--warning)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span className="studio-eyebrow">Solicitud de cambio de datos</span>
        <Badge tone="warning" size="md">
          Pendiente
        </Badge>
      </div>

      <p
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 14px",
        }}
      >
        El cliente pidió corregir sus datos desde el portal. Revisa el cambio y
        aprueba (se aplica a la ficha) o rechaza.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {diff.map((d) => (
          <div key={d.field}>
            <div
              style={{
                font: "600 10.5px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {d.label}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                font: "500 13px/1.4 var(--f-sans)",
              }}
            >
              <span
                style={{
                  color: "var(--ink-mute)",
                  textDecoration: "line-through",
                }}
              >
                {d.from ?? "—"}
              </span>
              <span aria-hidden style={{ color: "var(--ink-mute)" }}>
                →
              </span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{d.to}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: "0 0 10px",
          }}
        >
          {error}
        </p>
      )}

      {rejecting && (
        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor="reject-note"
            className="studio-label"
            style={{ display: "block", marginBottom: 6 }}
          >
            Motivo (opcional · lo ve el cliente)
          </label>
          <textarea
            id="reject-note"
            className="studio-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ej.: la cédula no coincide con la foto."
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ActionButton
          variant="dark"
          size="sm"
          idleLabel="Aprobar y aplicar"
          loadingLabel="Aplicando…"
          successLabel="Aplicado"
          onAction={async () => {
            setError(null);
            const r = await approveChangeRequestAction(req.id, markbox);
            identityResetRef.current = !!(r && r.ok && r.identityReset);
            return r;
          }}
          onSuccess={() => {
            toast.success(
              identityResetRef.current
                ? `Datos de ${markbox} actualizados · la identidad quedó sin verificar, conviene re-verificar`
                : `Datos de ${markbox} actualizados`,
            );
            router.refresh();
          }}
          onError={setError}
        />
        {rejecting ? (
          <ActionButton
            variant="danger"
            size="sm"
            idleLabel="Confirmar rechazo"
            loadingLabel="Rechazando…"
            successLabel="Rechazada"
            onAction={async () => {
              setError(null);
              return rejectChangeRequestAction(req.id, markbox, note || null);
            }}
            onSuccess={() => {
              toast.success(`Solicitud de ${markbox} rechazada`);
              router.refresh();
            }}
            onError={setError}
          />
        ) : (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => {
              setError(null);
              setRejecting(true);
            }}
          >
            Rechazar
          </button>
        )}
      </div>
    </section>
  );
}
