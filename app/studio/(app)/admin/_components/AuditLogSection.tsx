/**
 * Viewer gobernado de auditoría (SDD-0166 Corte C).
 *
 * Server component: filtros y paginación viven en URL. Sus props no contienen
 * payload, before/after ni reason.
 */

import Link from "next/link";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  AUDIT_ACTOR_TYPES,
  AUDIT_RESULTS,
  AUDIT_SENSITIVITIES,
  AUDIT_SOURCES,
  auditActorLabel,
  auditActorTone,
  auditEntityLabel,
  auditEventLabel,
  auditResultLabel,
  auditResultTone,
  auditSensitivityLabel,
  type AuditListFilters,
  type AuditListResult,
} from "@/lib/studio/audit-types";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleString("es-VE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })} UTC`;
}

function filterParams(filters: AuditListFilters): URLSearchParams {
  const params = new URLSearchParams({ section: "audit" });
  if (filters.entityType) params.set("auditEntity", filters.entityType);
  if (filters.actorType) params.set("auditActor", filters.actorType);
  if (filters.eventType) params.set("auditEvent", filters.eventType);
  if (filters.source) params.set("auditSource", filters.source);
  if (filters.result) params.set("auditResult", filters.result);
  if (filters.sensitivity) {
    params.set("auditSensitivity", filters.sensitivity);
  }
  if (filters.from) params.set("auditFrom", filters.from);
  if (filters.to) params.set("auditTo", filters.to);
  if (filters.correlationId) {
    params.set("auditCorrelation", filters.correlationId);
  }
  return params;
}

const ERROR_COPY = {
  forbidden: {
    title: "Acceso denegado",
    description: "Tu sesión no tiene la capability audit_view.",
  },
  invalid_filter: {
    title: "Filtros inválidos",
    description: "Revisa los filtros y vuelve a consultar.",
  },
  query_failed: {
    title: "No se pudo consultar la auditoría",
    description: "La consulta falló cerrada. Intenta de nuevo.",
  },
} as const;

export function AuditLogSection({
  result,
  filters,
  governedViewerEnabled,
}: {
  result: AuditListResult;
  filters: AuditListFilters;
  governedViewerEnabled: boolean;
}) {
  if (!result.ok) {
    const copy = ERROR_COPY[result.code];
    return (
      <div
        role="alert"
        style={{
          padding: "var(--s-6)",
          border: "1px solid var(--danger)",
          borderRadius: "var(--r-lg)",
          background: "var(--danger-bg)",
        }}
      >
        <strong style={{ color: "var(--ink)", font: "700 14px/1.4 var(--f-sans)" }}>
          {copy.title}
        </strong>
        <p
          style={{
            color: "var(--ink-soft)",
            font: "400 14px/1.5 var(--f-sans)",
            margin: "var(--s-2) 0 0",
          }}
        >
          {copy.description}
        </p>
      </div>
    );
  }

  const isFiltered = Object.values(filters).some(Boolean);
  const nextParams = filterParams(filters);
  if (result.nextCursor) {
    nextParams.set("auditCursor", result.nextCursor);
  }

  return (
    <section
      aria-labelledby="audit-viewer-title"
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            id="audit-viewer-title"
            style={{
              margin: 0,
              color: "var(--ink)",
              font: "700 16px/1.3 var(--f-display)",
            }}
          >
            Eventos auditables
          </h3>
          <p
            style={{
              margin: "var(--s-1) 0 0",
              color: "var(--ink-soft)",
              font: "400 13px/1.5 var(--f-sans)",
            }}
          >
            Consulta server-side · datos sensibles redacted · hora UTC
          </p>
        </div>
        {!governedViewerEnabled && (
          <Badge tone="warning" size="sm">
            Vista compatible gobernada
          </Badge>
        )}
      </div>

      <form
        action="/studio/admin"
        method="get"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--s-3)",
          padding: "var(--s-4)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          background: "var(--bg-elevated)",
        }}
      >
        <input type="hidden" name="section" value="audit" />
        <FilterField label="Entidad" name="auditEntity" value={filters.entityType} />
        <FilterField label="Evento" name="auditEvent" value={filters.eventType} />
        <SelectField
          label="Actor"
          name="auditActor"
          value={filters.actorType}
          options={AUDIT_ACTOR_TYPES.map((value) => ({
            value,
            label: auditActorLabel(value),
          }))}
        />
        {!governedViewerEnabled ? null : (
          <>
            <SelectField
              label="Fuente"
              name="auditSource"
              value={filters.source}
              options={AUDIT_SOURCES.map((value) => ({
                value,
                label: value === "legacy_unknown" ? "Legacy" : value,
              }))}
            />
            <SelectField
              label="Resultado"
              name="auditResult"
              value={filters.result}
              options={AUDIT_RESULTS.map((value) => ({
                value,
                label: auditResultLabel(value),
              }))}
            />
            <SelectField
              label="Sensibilidad"
              name="auditSensitivity"
              value={filters.sensitivity}
              options={AUDIT_SENSITIVITIES.map((value) => ({
                value,
                label: auditSensitivityLabel(value),
              }))}
            />
            <FilterField
              label="Correlación exacta"
              name="auditCorrelation"
              value={filters.correlationId}
            />
          </>
        )}
        <FilterField
          label="Desde"
          name="auditFrom"
          value={filters.from}
          type="date"
        />
        <FilterField
          label="Hasta"
          name="auditTo"
          value={filters.to}
          type="date"
        />
        <div
          style={{
            display: "flex",
            alignItems: "end",
            gap: "var(--s-2)",
            flexWrap: "wrap",
          }}
        >
          <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm">
            Aplicar filtros
          </button>
          {isFiltered && (
            <Link
              href="/studio/admin?section=audit"
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {result.events.length === 0 ? (
        <EmptyState
          eyebrow="Auditoría"
          title={isFiltered ? "Sin resultados" : "Sin eventos"}
          description={
            isFiltered
              ? "Ningún evento coincide con los filtros permitidos."
              : "Todavía no hay eventos registrados para este tenant."
          }
        />
      ) : (
        <div
          role="region"
          aria-label="Eventos de auditoría"
          tabIndex={0}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                <Th>Cuándo</Th>
                <Th>Entidad y evento</Th>
                <Th>Actor</Th>
                <Th>Resultado</Th>
                {governedViewerEnabled && <Th>Contexto redacted</Th>}
              </tr>
            </thead>
            <tbody>
              {result.events.map((event) => (
                <tr key={event.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>
                    <time
                      dateTime={event.occurredAt}
                      style={{
                        font: "600 12px/1.4 var(--f-mono)",
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatWhen(event.occurredAt)}
                    </time>
                  </Td>
                  <Td>
                    <div
                      style={{
                        font: "700 13px/1.4 var(--f-sans)",
                        color: "var(--ink)",
                      }}
                    >
                      {auditEntityLabel(event.entityType)}
                    </div>
                    <div
                      style={{
                        font: "500 12px/1.4 var(--f-sans)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {auditEventLabel(event.eventType)}
                    </div>
                    <code
                      style={{
                        font: "500 11px/1.4 var(--f-mono)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {event.entityId}
                    </code>
                  </Td>
                  <Td>
                    <Badge tone={auditActorTone(event.actorType)} size="sm">
                      {auditActorLabel(event.actorType)}
                    </Badge>
                    <div
                      style={{
                        marginTop: "var(--s-1)",
                        color: "var(--ink-soft)",
                        font: "500 12px/1.4 var(--f-sans)",
                      }}
                    >
                      {event.actorResolved
                        ? event.actorLabel ?? auditActorLabel(event.actorType)
                        : "No resuelto"}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={auditResultTone(event.result)} size="sm">
                      {auditResultLabel(event.result)}
                    </Badge>
                    <div
                      style={{
                        marginTop: "var(--s-1)",
                        color: "var(--ink-soft)",
                        font: "500 12px/1.4 var(--f-sans)",
                      }}
                    >
                      {event.source} · {auditSensitivityLabel(event.sensitivity)}
                    </div>
                  </Td>
                  {governedViewerEnabled && (
                    <Td>
                      <div
                        style={{
                          color: "var(--ink-soft)",
                          font: "500 12px/1.4 var(--f-sans)",
                        }}
                      >
                        Payload no expuesto
                      </div>
                      <code
                        style={{
                          color: "var(--ink-soft)",
                          font: "500 11px/1.4 var(--f-mono)",
                        }}
                      >
                        {event.correlationId ?? "Sin correlación"}
                      </code>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--ink-soft)", font: "500 12px/1.4 var(--f-sans)" }}>
          {result.events.length} evento{result.events.length === 1 ? "" : "s"} en esta página
        </span>
        {result.hasMore && result.nextCursor ? (
          <Link
            href={`/studio/admin?${nextParams.toString()}`}
            className="studio-btn studio-btn-ghost studio-btn-sm"
          >
            Siguiente página
          </Link>
        ) : (
          <span style={{ color: "var(--ink-soft)", font: "500 12px/1.4 var(--f-sans)" }}>
            Fin de resultados
          </span>
        )}
      </div>
    </section>
  );
}

function FilterField({
  label,
  name,
  value,
  type = "text",
}: {
  label: string;
  name: string;
  value?: string;
  type?: "text" | "date";
}) {
  return (
    <label className="studio-label">
      {label}
      <input
        className="studio-input"
        type={type}
        name={name}
        defaultValue={value}
        autoComplete="off"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="studio-label">
      {label}
      <select className="studio-input" name={name} defaultValue={value ?? ""}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      style={{
        padding: "var(--s-3) var(--s-4)",
        textAlign: "left",
        font: "700 11px/1.2 var(--f-sans)",
        color: "var(--ink-soft)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "var(--s-3) var(--s-4)",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
