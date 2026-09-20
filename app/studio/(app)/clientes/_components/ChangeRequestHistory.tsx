import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  buildChangeRequestDiff,
  type ClientChangeRequest,
} from "@/lib/portal/change-request-types";

/**
 * Historial de cambios de identidad ya resueltos (SDD-0151). Read-only, da traza
 * al asesor: distingue lo que PROPUSO el cliente (aprobada/rechazada + motivo) de
 * lo que EDITÓ el equipo directo en la ficha (source='admin'), y muestra QUIÉN lo
 * revisó/editó (`reviewerNames`). Las canceladas por el cliente se borran, así que
 * no aparecen. Solo se renderiza si hay al menos una fila.
 */
export function ChangeRequestHistory({
  items,
  isEmpresa,
  reviewerNames,
}: {
  items: ClientChangeRequest[];
  isEmpresa: boolean;
  reviewerNames: Record<string, string>;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="cr-history-heading"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <span id="cr-history-heading" className="studio-eyebrow">
        Historial de solicitudes
      </span>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 12,
        }}
      >
        {items.map((req, i) => {
          const diff = buildChangeRequestDiff(req, isEmpresa);
          const approved = req.status === "approved";
          const isAdmin = req.source === "admin";
          // SDD-0482: el cliente edita directo desde el Portal → fila aprobada
          // sin revisor. Una solicitud aprobada por el asesor siempre lo trae.
          const isClientDirect =
            req.source === "client" && approved && !req.reviewedBy;
          const who = req.reviewedBy ? reviewerNames[req.reviewedBy] : undefined;
          // Admin/cliente directo = edición (info); si no, su propuesta resuelta.
          const badgeTone =
            isAdmin || isClientDirect ? "info" : approved ? "success" : "danger";
          const badgeLabel = isAdmin
            ? "Editado por el equipo"
            : isClientDirect
              ? "Editado por el cliente"
              : approved
                ? "Aprobada"
                : "Rechazada";
          const when = req.reviewedAt
            ? new Date(req.reviewedAt).toLocaleDateString("es-VE", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "";
          return (
            <div
              key={req.id}
              style={{
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                paddingTop: i > 0 ? 12 : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Badge tone={badgeTone} size="sm">
                  {badgeLabel}
                </Badge>
                {when && (
                  <span
                    style={{
                      font: "500 11.5px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {when}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {diff.map((d) => (
                  <div
                    key={d.field}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      font: "500 12.5px/1.4 var(--f-sans)",
                    }}
                  >
                    <span
                      style={{
                        font: "600 10.5px/1.3 var(--f-sans)",
                        color: "var(--ink-soft)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {d.label}
                    </span>
                    <span className="sr-only">antes:</span>
                    <span
                      style={{
                        color: "var(--ink-soft)",
                        textDecoration: "line-through",
                      }}
                    >
                      {d.from ?? "—"}
                    </span>
                    <span aria-hidden style={{ color: "var(--ink-mute)" }}>
                      →
                    </span>
                    <span className="sr-only">ahora:</span>
                    <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                      {d.to}
                    </span>
                  </div>
                ))}
              </div>

              {!approved && req.reviewNote && (
                <p
                  style={{
                    font: "500 12px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: "var(--s-2) 0 0",
                  }}
                >
                  Motivo: {req.reviewNote}
                </p>
              )}

              {who && (
                <p
                  style={{
                    font: "500 11.5px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: "6px 0 0",
                  }}
                >
                  {isAdmin ? `Por ${who}` : `Revisado por ${who}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
