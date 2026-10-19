"use client";

/**
 * Wrapper client del detalle cliente — maneja el state del drawer de edición.
 * El contenido del detalle (datos + histórico) se pasa como children desde
 * el page server.
 *
 * SDD-0032 agrega 2 cross-links: Etiquetas (wireado a /studio/etiquetas?id=)
 * y Estado de cuenta — este último dejó de ser un placeholder en SDD-0281.
 *
 * SDD-0558: «Estado de cuenta» se pinta solo si el rol abre facturación
 * (`canViewStatement`, de `puedeVerEstadoDeCuenta`): la pantalla y el PDF ya
 * exigen el módulo `invoices`, y comercial, operaciones y soporte terminaban
 * rebotados. El saldo lo ven igual, en la cabecera de la ficha.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Client } from "@/lib/studio/client-types";
import { ClientDrawer } from "./ClientDrawer";

export function ClientDetailClient({
  client,
  canViewStatement,
  children,
}: {
  client: Client;
  /** SDD-0558: el rol abre el estado de cuenta (módulo `invoices`). */
  canViewStatement: boolean;
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
        {/* SDD-0281 · deja de ser un placeholder. Lee el MISMO ledger que ve el
            cliente en su portal — si el ERP tuviera su propio cálculo, el asesor
            y el cliente podrían mirar dos saldos distintos de la misma cuenta,
            que es la discusión que un estado de cuenta viene a evitar. */}
        {canViewStatement ? (
          <Link
            href={`/studio/clientes/${encodeURIComponent(client.markbox)}/estado-de-cuenta`}
            className="studio-btn studio-btn-ghost studio-btn-sm"
            title="Movimientos y saldo — lo mismo que ve el cliente en su portal"
          >
            Estado de cuenta
          </Link>
        ) : null}
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
