"use client";

/**
 * Drawer "Convertir a cliente" (SDD-0058 · Slice B).
 *
 * El asesor elige (opcional) el contacto de Kommo que corresponde al lead — el
 * espejo NO guarda el link lead↔contacto, así que el match lo hace la persona.
 * El nombre/email/teléfono del cliente se toman del contacto elegido (Kommo no
 * tiene dirección → se completa después en Clientes). También permite convertir
 * SIN contacto (solo el lead, comportamiento de Slice A).
 *
 * La búsqueda corre server-side (searchKommoContactsAction · RLS por tenant),
 * debounced. El convert real lo hace `convertLeadToClientAction` con el prefill.
 */

import { useEffect, useRef, useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import type { KommoContactPick } from "@/lib/studio/kommo-convert";
import { convertLeadToClientAction, searchKommoContactsAction } from "../actions";

export function ConvertLeadDrawer({
  lead,
  onClose,
  onConverted,
}: {
  lead: { id: number; name: string };
  onClose: () => void;
  onConverted: (leadId: number, markbox: string, created: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<KommoContactPick[]>([]);
  const [searching, setSearching] = useState(true);
  const [selected, setSelected] = useState<KommoContactPick | null>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Búsqueda debounced (300ms). Carga inicial (q="") = contactos recientes,
  // inmediata. El reqId descarta respuestas viejas que llegan fuera de orden.
  useEffect(() => {
    const id = ++reqId.current;
    setSearching(true);
    const t = setTimeout(
      async () => {
        try {
          const rows = await searchKommoContactsAction(q);
          if (reqId.current === id) setResults(rows);
        } catch {
          if (reqId.current === id) setResults([]);
        } finally {
          if (reqId.current === id) setSearching(false);
        }
      },
      q ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [q]);

  const doConvert = async (withContact: boolean) => {
    setError(null);
    setConverting(true);
    try {
      const prefill =
        withContact && selected
          ? {
              name: selected.name,
              email: selected.email ?? undefined,
              phone: selected.phone ?? undefined,
            }
          : undefined;
      const res = await convertLeadToClientAction(lead.id, prefill);
      if (res?.error) {
        setError(res.error);
        return { error: res.error };
      }
      if (res?.markbox) {
        // El padre actualiza el map + dispara el toast + cierra el drawer.
        onConverted(lead.id, res.markbox, res.created ?? false);
      }
    } finally {
      setConverting(false);
    }
  };

  return (
    <DrawerShell
      title="Convertir a cliente"
      subtitle={`Lead: ${lead.name}`}
      onClose={onClose}
      pending={converting}
      width={560}
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
        <div>
          <label className="studio-label" htmlFor="ck-contact-q">
            Vincular contacto de Kommo (opcional)
          </label>
          <input
            id="ck-contact-q"
            type="search"
            className="studio-input"
            placeholder="Buscar contacto por nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <p
            style={{
              font: "500 11.5px/1.45 var(--f-sans)",
              color: "var(--ink-mute)",
              margin: "6px 0 0",
            }}
          >
            El nombre, email y teléfono del cliente se toman del contacto que elijas
            (Kommo no trae dirección → la completás después en Clientes).
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {searching ? (
            <Muted>{q ? "Buscando…" : "Cargando contactos…"}</Muted>
          ) : results.length === 0 ? (
            <Muted>{q ? "Ningún contacto coincide." : "Sin contactos en el espejo."}</Muted>
          ) : (
            results.map((c) => {
              const on = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="kommo-contact-pick"
                  onClick={() => setSelected(on ? null : c)}
                  aria-pressed={on}
                  style={{
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    border: `1px solid ${on ? "var(--wine)" : "var(--border)"}`,
                    background: on ? "var(--wine-tint)" : "var(--bg-surface)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        font: "700 13px/1.2 var(--f-sans)",
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        font: "500 11.5px/1.3 var(--f-mono)",
                        color: "var(--ink-soft)",
                        marginTop: 2,
                      }}
                    >
                      {c.phone || "sin teléfono"}
                      {c.email ? ` · ${c.email}` : ""}
                    </div>
                  </div>
                  {on && (
                    <Badge tone="wine" size="sm">
                      Elegido
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>

        {error && (
          <p style={{ font: "600 12.5px/1.4 var(--f-sans)", color: "var(--danger)", margin: 0 }}>
            {error}
          </p>
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
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          onClick={onClose}
          disabled={converting}
        >
          Cancelar
        </button>
        {/* Un solo botón contextual: el modo lo decide la selección de la lista
            (elegir contacto es opcional, no una bifurcación de acción). */}
        <ActionButton
          variant="primary"
          idleLabel={
            selected
              ? `Convertir con ${truncate(selected.name, 18)}`
              : "Convertir sin contacto"
          }
          successLabel={null}
          disabled={converting}
          onAction={() => doConvert(!!selected)}
        />
      </footer>
    </DrawerShell>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        font: "500 12.5px/1.4 var(--f-sans)",
        color: "var(--ink-mute)",
        margin: "4px 0",
      }}
    >
      {children}
    </p>
  );
}
