"use client";

/**
 * <FrictionReportsPanel> · "Reportar fricción" (SDD-0119 Slice 1).
 *
 * Reemplaza el placeholder "Próximamente" de la card de Automatización del
 * dashboard de Marketing. Form inline (título + descripción) para reportar
 * algo que quita tiempo o no gusta hacer → entra a la mini-bandeja de abajo.
 * Un admin puede marcarlo como resuelto (backstop RBAC en la action + RLS
 * admin-only en DB).
 *
 * Solo tokens var(--*). Server actions en
 * app/studio/(app)/marketing/actions.ts.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createFrictionReportAction,
  resolveFrictionReportAction,
} from "../actions";
import {
  FRICTION_DESCRIPTION_MAX,
  FRICTION_STATUS_LABELS,
  FRICTION_TITLE_MAX,
  frictionStatusTone,
  type FrictionReport,
  type FrictionReportActionState,
} from "@/lib/studio/marketing/friction-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";

const initial: FrictionReportActionState = {};

function formatDate(iso: string): string {
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

export function FrictionReportsPanel({
  reports,
  currentUserId,
  isAdmin,
}: {
  reports: FrictionReport[];
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    createFrictionReportAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section>
      <h2 className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
        Automatización
      </h2>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "20px 22px",
          background: "var(--bg-surface)",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 14,
          }}
        >
          <span style={{ color: "var(--wine-text)", flexShrink: 0 }}>
            {Icon.spark(22)}
          </span>
          <div>
            <p
              style={{
                font: "600 14px/1.4 var(--f-sans)",
                color: "var(--ink)",
                margin: "0 0 var(--s-1)",
              }}
            >
              ¿Algo te quita tiempo?
            </p>
            <p
              style={{
                font: "400 13px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
                maxWidth: "64ch",
              }}
            >
              Reporta lo que sea repetitivo o que no te gusta hacer (edición,
              montaje). Entra a la cola de automatización con IA del ERP.
            </p>
          </div>
        </div>

        <form
          ref={formRef}
          action={formAction}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div>
            <label className="studio-label" htmlFor="friction_title">
              Título
            </label>
            <input
              id="friction_title"
              name="title"
              type="text"
              className="studio-input"
              placeholder="Ej. Editar los videos de TikTok me toma horas"
              maxLength={FRICTION_TITLE_MAX}
              required
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="friction_description">
              Descripción
            </label>
            <textarea
              id="friction_description"
              name="description"
              className="studio-input"
              rows={3}
              placeholder="Cuéntanos qué pasos te quitan tiempo o no te gusta hacer."
              maxLength={FRICTION_DESCRIPTION_MAX}
              required
            />
          </div>

          {state.fieldErrors &&
            Object.values(state.fieldErrors).map((msg) => (
              <p
                key={msg}
                style={{
                  color: "var(--danger)",
                  font: "500 11px/1.3 var(--f-sans)",
                  margin: 0,
                }}
              >
                {msg}
              </p>
            ))}
          {state.error && (
            <p
              style={{
                color: "var(--danger)",
                font: "500 12px/1.4 var(--f-sans)",
                margin: 0,
              }}
            >
              {state.error}
            </p>
          )}
          {state.ok && (
            <p
              style={{
                color: "var(--success)",
                font: "500 12px/1.4 var(--f-sans)",
                margin: 0,
              }}
            >
              Reporte enviado. Gracias — entra a la cola de automatización.
            </p>
          )}

          <div>
            <button
              type="submit"
              className="studio-btn studio-btn-primary studio-btn-sm"
              disabled={isPending}
              style={{ opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? "Enviando…" : "Reportar fricción"}
            </button>
          </div>
        </form>
      </div>

      {reports.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 14,
            padding: "18px",
            textAlign: "center",
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Sin reportes todavía. El primero que envíes aparece acá.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {reports.map((r) => {
            const status = resolvedIds.includes(r.id) ? "resolved" : r.status;
            const mine =
              currentUserId != null && r.reporter_user_id === currentUserId;
            return (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "12px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      font: "600 13px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    {r.title}
                  </span>
                  <Badge tone={frictionStatusTone(status)} size="sm">
                    {FRICTION_STATUS_LABELS[status]}
                  </Badge>
                  {isAdmin && status !== "resolved" && (
                    <ActionButton
                      variant="ghost"
                      size="xs"
                      idleLabel="Marcar resuelto"
                      loadingLabel="Guardando…"
                      successLabel="Resuelto"
                      idleIcon={Icon.check(13)}
                      successIcon={Icon.check(13)}
                      onAction={() => resolveFrictionReportAction(r.id)}
                      onSuccess={() =>
                        setResolvedIds((ids) => [...ids, r.id])
                      }
                      onError={setResolveError}
                    />
                  )}
                </div>
                <p
                  style={{
                    font: "400 12.5px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: 0,
                  }}
                >
                  {r.description}
                </p>
                <span
                  style={{
                    font: "500 11px/1.3 var(--f-sans)",
                    color: "var(--ink-mute)",
                  }}
                >
                  {mine ? "Tú" : "Equipo"} · {formatDate(r.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {resolveError && (
        <p
          style={{
            color: "var(--danger)",
            font: "500 12px/1.4 var(--f-sans)",
            margin: "8px 0 0",
          }}
        >
          {resolveError}
        </p>
      )}
    </section>
  );
}
