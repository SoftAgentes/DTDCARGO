"use client";

/**
 * ActasList · memoria institucional (SDD-0146 · Fase 2).
 *
 * Lista las actas CONFIRMADAS del tenant (Rumbo nunca construyó este histórico).
 * Click en una acta → detalle read-only (resumen/puntos/decisiones/pendientes/
 * próxima). La RLS ya filtró: los borradores no aparecen; las confidenciales
 * sólo las ve dirección + su creador.
 */

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  DrawerShell,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { BitacoraMeetingListItem } from "@/lib/studio/bitacora/bitacora-meeting-queries";
import { MEETING_TIPO_META } from "@/lib/studio/bitacora/bitacora-types";

interface Props {
  meetings: BitacoraMeetingListItem[];
  canEdit: boolean;
}

function clienteLabel(m: BitacoraMeetingListItem): string | null {
  if (m.clientName) {
    return m.clientMarkbox ? `${m.clientName} · ${m.clientMarkbox}` : m.clientName;
  }
  return m.contacto_libre;
}

export function ActasList({ meetings, canEdit }: Props) {
  const [selected, setSelected] = useState<BitacoraMeetingListItem | null>(null);

  if (meetings.length === 0) {
    return (
      <EmptyState
        eyebrow="Actas"
        title="Sin actas confirmadas todavía"
        description={
          <>
            Cada conversación que confirmes queda acá como memoria del equipo:
            resumen, decisiones y pendientes, siempre a mano.
          </>
        }
        action={
          canEdit ? (
            <Link href="/studio/bitacora/nueva" className="studio-btn studio-btn-primary">
              {Icon.spark(14)} Nueva conversación
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {meetings.map((m) => {
          const meta = MEETING_TIPO_META[m.tipo];
          const cli = clienteLabel(m);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              style={{
                textAlign: "left",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "14px 16px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    font: "700 13.5px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  {m.titulo}
                </span>
                <Badge tone={meta.tone} size="sm">
                  {meta.label}
                </Badge>
                <span
                  style={{
                    font: "600 11px/1 var(--f-mono)",
                    color: "var(--ink-mute)",
                  }}
                >
                  {m.fecha}
                </span>
              </div>
              {m.resumen && (
                <p
                  style={{
                    font: "500 12px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: 0,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {m.resumen}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  font: "500 11px/1.3 var(--f-sans)",
                  color: "var(--ink-mute)",
                }}
              >
                {cli && <span>{cli}</span>}
                <span>
                  {m.taskCount} tarea{m.taskCount === 1 ? "" : "s"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <ActaDetailDrawer meeting={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function ActaDetailDrawer({
  meeting,
  onClose,
}: {
  meeting: BitacoraMeetingListItem;
  onClose: () => void;
}) {
  const meta = MEETING_TIPO_META[meeting.tipo];
  const acta = meeting.acta;
  const cli = clienteLabel(meeting);

  return (
    <DrawerShell
      title={meeting.titulo}
      subtitle={`${meta.label} · ${meeting.fecha}`}
      onClose={onClose}
      pending={false}
      width={620}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {cli && (
          <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            <span style={{ color: "var(--ink-mute)" }}>Cliente: </span>
            {cli}
          </div>
        )}

        {meeting.resumen && (
          <div>
            <div className="studio-label" style={{ marginBottom: 6 }}>
              Resumen
            </div>
            <p style={{ font: "500 13px/1.6 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
              {meeting.resumen}
            </p>
          </div>
        )}

        <DetailList label="Puntos clave" items={acta?.puntos ?? []} />
        <DetailList label="Decisiones" items={acta?.decisiones ?? []} />
        <DetailList label="Quedó en el aire" items={acta?.pendientes ?? []} />

        {acta && acta.hablaron.length > 0 && (
          <div style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
            <span style={{ color: "var(--ink-mute)" }}>Hablaron: </span>
            {acta.hablaron.join(", ")}
          </div>
        )}

        {acta?.proxima_reunion && (acta.proxima_reunion.fecha || acta.proxima_reunion.foco) && (
          <div style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
            <span style={{ color: "var(--ink-mute)" }}>Próxima reunión: </span>
            {acta.proxima_reunion.fecha ?? "por definir"}
            {acta.proxima_reunion.foco ? ` · ${acta.proxima_reunion.foco}` : ""}
          </div>
        )}

        <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
          {meeting.taskCount} tarea{meeting.taskCount === 1 ? "" : "s"} nacieron de esta acta.
        </div>
      </div>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <a
          className="studio-btn studio-btn-ghost"
          href={`/api/studio/bitacora/export?tipo=acta&id=${encodeURIComponent(meeting.id)}`}
        >
          {Icon.download(14)} Descargar acta
        </a>
        <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose}>
          Cerrar
        </button>
      </footer>
    </DrawerShell>
  );
}

function DetailList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="studio-label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((it, i) => (
          <li key={i} style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
