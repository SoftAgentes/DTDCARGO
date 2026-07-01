"use client";

/**
 * AuditLogSection — sección "Audit log" del admin (SDD-0123).
 *
 * Viewer read-only de `entity_audit_log`: quién (actor) hizo qué (event) sobre
 * qué entidad y cuándo. Filtros client-side por tipo de entidad y actor. Sin
 * migración; sin escritura (el INSERT es solo service_role).
 */

import { useMemo, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  auditActorLabel,
  auditActorTone,
  auditEntityLabel,
  auditEventLabel,
  type AuditEvent,
} from "@/lib/studio/audit-types";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogSection({ events }: { events: AuditEvent[] }) {
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");

  const entityOptions = useMemo(() => {
    const set = new Set(events.map((e) => e.entityType));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (entityFilter === "all" || e.entityType === entityFilter) &&
          (actorFilter === "all" || e.actorType === actorFilter),
      ),
    [events, entityFilter, actorFilter],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="studio-input"
          style={{ maxWidth: 220 }}
          aria-label="Filtrar por entidad"
        >
          <option value="all">Todas las entidades</option>
          {entityOptions.map((et) => (
            <option key={et} value={et}>
              {auditEntityLabel(et)}
            </option>
          ))}
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="studio-input"
          style={{ maxWidth: 180 }}
          aria-label="Filtrar por actor"
        >
          <option value="all">Todos los actores</option>
          <option value="user">Usuario</option>
          <option value="operario">Operario</option>
          <option value="system">Sistema</option>
        </select>
        <span style={{ marginLeft: "auto", font: "600 11.5px/1 var(--f-mono)", color: "var(--ink-mute)" }}>
          {filtered.length} de {events.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          eyebrow="Audit log"
          title="Sin eventos"
          description={
            events.length === 0
              ? "Todavía no hay mutaciones registradas para este tenant."
              : "Ningún evento coincide con los filtros."
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                <Th>Cuándo</Th>
                <Th>Entidad</Th>
                <Th>Evento</Th>
                <Th>Actor</Th>
                <Th>Detalle</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const payloadKeys = Object.keys(e.payload);
                return (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td>
                      <span style={{ font: "600 12px/1.3 var(--f-mono)", color: "var(--ink)" }}>
                        {formatWhen(e.occurredAt)}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                        {auditEntityLabel(e.entityType)}
                      </div>
                      <code style={{ font: "500 10.5px/1.3 var(--f-mono)", color: "var(--ink-mute)" }}>
                        {e.entityId.slice(0, 8)}…
                      </code>
                    </Td>
                    <Td>
                      <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                        {auditEventLabel(e.eventType)}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={auditActorTone(e.actorType)} size="sm">
                        {auditActorLabel(e.actorType)}
                      </Badge>
                    </Td>
                    <Td>
                      {payloadKeys.length === 0 ? (
                        <span style={{ color: "var(--ink-mute)" }}>—</span>
                      ) : (
                        <details>
                          <summary
                            style={{
                              cursor: "pointer",
                              font: "600 11.5px/1.3 var(--f-sans)",
                              color: "var(--wine)",
                            }}
                          >
                            {payloadKeys.length} campo{payloadKeys.length === 1 ? "" : "s"}
                          </summary>
                          <pre
                            style={{
                              margin: "8px 0 0",
                              padding: 10,
                              background: "var(--bg-elevated)",
                              borderRadius: "var(--r-sm)",
                              font: "500 10.5px/1.5 var(--f-mono)",
                              color: "var(--ink-soft)",
                              maxWidth: 360,
                              overflow: "auto",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 14px",
        textAlign: "left",
        font: "700 10px/1 var(--f-sans)",
        color: "var(--ink-soft)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 14px", verticalAlign: "top" }}>{children}</td>;
}
