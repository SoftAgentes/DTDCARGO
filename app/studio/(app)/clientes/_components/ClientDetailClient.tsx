"use client";

/**
 * Wrapper client del detalle cliente — maneja el state del drawer de edición.
 * El contenido del detalle (datos + histórico) se pasa como children desde
 * el page server.
 */

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
      {/* Inyectamos el botón de editar al header del detalle via slot. */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
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
