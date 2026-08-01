/**
 * ContainerTypesCatalog — catálogo de tipos de contenedor (SDD-0184 · Fase 2).
 *
 * Vive dentro de "Master data" porque es exactamente eso: un catálogo editable.
 * Lo único que se edita acá es si el tipo se ofrece al operar. La capacidad NO
 * se toca por pantalla (ver el comentario de `container-types-actions.ts`).
 *
 * Muestra las tres cifras que la gente confunde, cada una con su nombre:
 *   · capacidad ÚTIL   → la que usa el plan de carga
 *   · techo REAL       → lo que de verdad entró en un contenedor propio; avisa
 *   · áreas            → en cuántos pedazos se divide para ubicar la mercancía
 */

"use client";

import { useState } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { toggleContainerTypeActiveAction } from "../container-types-actions";
import { parseZoneLayout, zoneCount } from "@/lib/studio/naviera/zones";
import type { ContainerType } from "@/lib/studio/naviera/types";

type Props = { types: ContainerType[] };

export function ContainerTypesCatalog({ types }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [mostrarApagados, setMostrarApagados] = useState(true);
  const toast = useToast();

  const visibles = mostrarApagados ? types : types.filter((t) => t.active);
  const activos = types.filter((t) => t.active).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            flex: 1,
            minWidth: 240,
            maxWidth: "72ch",
          }}
        >
          Solo los tipos activos se le ofrecen al operario al abrir un contenedor.
          Apagar no borra: las consolidaciones viejas siguen apuntando a su tipo.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            font: "600 11.5px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <input
            type="checkbox"
            checked={mostrarApagados}
            onChange={(e) => setMostrarApagados(e.target.checked)}
          />
          Mostrar apagados
        </label>
      </div>

      {error && <ErrorAlert state={{ error }} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        {visibles.map((t) => (
          <FilaTipo
            key={t.id}
            tipo={t}
            esUltimoActivo={t.active && activos <= 1}
            onError={setError}
            onDone={(activo) =>
              toast.success(
                activo
                  ? `${t.label} queda disponible para el operario`
                  : `${t.label} ya no se ofrece al abrir un contenedor`,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function FilaTipo({
  tipo,
  esUltimoActivo,
  onError,
  onDone,
}: {
  tipo: ContainerType;
  esUltimoActivo: boolean;
  onError: (m: string | null) => void;
  onDone: (activo: boolean) => void;
}) {
  const layout = parseZoneLayout(tipo.zone_layout);
  const areas = zoneCount(layout);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--s-3)",
        padding: "12px 14px",
        background: tipo.active ? "var(--bg-elevated)" : "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        opacity: tipo.active ? 1 : 0.72,
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: 1, minWidth: 180 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {tipo.label}
          </span>
          <code style={{ font: "600 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
            {tipo.code}
          </code>
          <Badge tone={tipo.active ? "success" : "neutral"} size="xs">
            {tipo.active ? "Activo" : "Apagado"}
          </Badge>
        </span>
        <span
          style={{
            display: "block",
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 3,
          }}
        >
          {areas} área{areas === 1 ? "" : "s"} · {layout.nx} a lo largo × {layout.nz} a lo ancho
        </span>
      </span>

      <Cifra etiqueta="Capacidad útil" valor={`${fmt(tipo.cbm_capacity)} CBM`} />
      <Cifra
        etiqueta="Techo real"
        valor={tipo.cbm_alert_ceiling != null ? `${fmt(tipo.cbm_alert_ceiling)} CBM` : "sin medir"}
        atenuado={tipo.cbm_alert_ceiling == null}
      />
      <Cifra etiqueta="Peso máximo" valor={`${(tipo.kg_capacity / 1000).toFixed(1)} t`} />

      <div style={{ flexShrink: 0 }}>
        <ActionButton
          variant={tipo.active ? "ghost" : "dark"}
          size="sm"
          idleLabel={tipo.active ? "Apagar" : "Activar"}
          loadingLabel={tipo.active ? "Apagando…" : "Activando…"}
          successLabel={tipo.active ? "Apagado" : "Activado"}
          idleIcon={tipo.active ? Icon.close(14) : Icon.check(14)}
          successIcon={Icon.check(14)}
          disabled={esUltimoActivo}
          onAction={async () => {
            onError(null);
            const fd = new FormData();
            fd.set("code", tipo.code);
            fd.set("active", tipo.active ? "false" : "true");
            return toggleContainerTypeActiveAction({}, fd);
          }}
          onSuccess={() => onDone(!tipo.active)}
          onError={onError}
        />
      </div>
    </div>
  );
}

function Cifra({
  etiqueta,
  valor,
  atenuado = false,
}: {
  etiqueta: string;
  valor: string;
  atenuado?: boolean;
}) {
  return (
    <span style={{ flexShrink: 0, minWidth: 96 }}>
      <span
        className="studio-eyebrow"
        style={{ display: "block", fontSize: 9, color: "var(--ink-soft)", marginBottom: 2 }}
      >
        {etiqueta}
      </span>
      <span
        style={{
          font: "700 12.5px/1 var(--f-mono)",
          color: atenuado ? "var(--ink-soft)" : "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
    </span>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
