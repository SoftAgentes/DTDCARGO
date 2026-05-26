"use client";

/**
 * Wrapper client del detalle cliente — maneja el state del drawer de edición.
 * El contenido del detalle (datos + histórico) se pasa como children desde
 * el page server.
 *
 * SDD-0032 agrega 2 cross-links: Etiquetas (wireado a /studio/etiquetas?id=)
 * y Estado de cuenta (placeholder disabled · SDD futuro).
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Client } from "@/lib/studio/client-types";
import { ClientDrawer } from "./ClientDrawer";

export function ClientDetailClient({
  client,
  children,
}: {
  client: Client;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      {/* Cross-links + botón editar */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          disabled
          title="Pantalla portada en un SDD futuro · por ahora deshabilitado"
        >
          Estado de cuenta
        </button>
        <Link
          href={`/studio/etiquetas?id=${encodeURIComponent(client.markbox)}`}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          target="_blank"
          rel="noreferrer"
        >
          Etiquetas
        </Link>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={() => setEditing(true)}
        >
          Editar cliente
        </button>
      </div>

      {children}

      {editing && (
        <ClientDrawer
          mode="edit"
          client={client}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
