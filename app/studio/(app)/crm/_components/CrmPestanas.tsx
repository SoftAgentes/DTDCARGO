"use client";

/**
 * Cabecera y barra de pestañas del CRM (SDD-0655), compartidas por Embudos
 * (`/studio/crm`) y la Bandeja (`/studio/bandeja`). Las dos rutas pintan la
 * misma cabecera y la misma barra; cambia la pestaña activa y la bajada.
 *
 * La barra usa la clase única del Studio (`.studio-tabs`, SDD-0603 tramo 5d):
 * la activa va con relleno de tinta. Cada pestaña navega a su ruta; mientras
 * navega, la barra baja la opacidad (misma espera que tenía `KommoClient`).
 */
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import type { CrmPestana, CrmPestanaKey } from "./kommo-tabs.shared";

export function CrmCabecera({ bajada, extra }: { bajada: ReactNode; extra?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 24,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <div>
        <span className="studio-eyebrow">Comercial</span>
        <h1 className="studio-display" style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}>
          CRM.
        </h1>
        <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "64ch" }}>
          {bajada}
        </p>
      </div>
      {extra}
    </div>
  );
}

export function CrmPestanas({
  pestanas,
  activa,
  compacta = false,
}: {
  pestanas: ReadonlyArray<CrmPestana>;
  activa: CrmPestanaKey;
  /** SDD-0680: dentro de la fila de la Bandeja, sin margen debajo. */
  compacta?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const ir = (p: CrmPestana) => {
    if (p.key === activa) return;
    startTransition(() => router.push(p.href));
  };

  return (
    <div style={{ marginBottom: compacta ? 0 : 20, opacity: isPending ? 0.7 : 1 }}>
      <div role="tablist" aria-label="Tablero CRM" className="studio-tabs">
        {pestanas.map((p) => {
          const isActive = p.key === activa;
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-activa={isActive ? "true" : undefined}
              data-tab={p.key}
              onClick={() => ir(p)}
              className="studio-tab"
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
