"use client";

/**
 * FeatureFlagsClient · grilla de toggles de los flags del tenant.
 *
 * Cada toggle es un form independiente con server action propia
 * (optimistic UI no necesario para volumen actual). Tras éxito,
 * router.refresh() para que el layout traiga los flags nuevos y el
 * sidebar se actualice.
 *
 * La grilla ordena por EFECTO REAL, no alfabético: primero los flags que
 * hacen algo, al final los que sólo guardan un booleano. Un panel que
 * pinta 21 interruptores idénticos cuando 18 no están conectados no es
 * neutral — miente por omisión.
 */

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FEATURE_FLAG_EFFECT,
  FEATURE_FLAG_EFFECT_LABELS,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_LABELS,
  MODULE_FLAG_MAP,
  type FeatureFlagEffect,
  type FeatureFlagKey,
  type FeatureFlags,
} from "@/lib/studio/feature-flags-types";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import {
  toggleFeatureFlagAction,
  type ToggleFlagState,
} from "../actions";

interface Props {
  flags: FeatureFlags;
}

const ORDEN_EFECTO: Record<FeatureFlagEffect, number> = {
  ruta: 0,
  lectura: 1,
  sidebar: 2,
  ninguno: 3,
};

const TONO_EFECTO: Record<FeatureFlagEffect, BadgeTone> = {
  ruta: "success",
  lectura: "success",
  sidebar: "warning",
  ninguno: "neutral",
};

/** Qué le decimos al admin que va a pasar si lo apaga. */
const NOTA_EFECTO: Record<FeatureFlagEffect, string | null> = {
  ruta: null, // el detalle de módulos afectados ya lo dice
  lectura: null,
  sidebar:
    "Esconde el link del sidebar, pero la URL sigue abriendo. No sirve como permiso: para eso están los roles.",
  ninguno:
    "Ningún componente lee este flag todavía. El interruptor se guarda, pero no enciende ni apaga nada.",
};

/**
 * Map inverso: flag key → modules afectados. Usado para mostrar al admin
 * cuáles módulos del sidebar se ocultan al apagar un flag.
 */
const FLAG_TO_MODULES: Partial<Record<FeatureFlagKey, string[]>> = (() => {
  const out: Partial<Record<FeatureFlagKey, string[]>> = {};
  for (const [moduleId, flagKey] of Object.entries(MODULE_FLAG_MAP)) {
    if (!flagKey) continue;
    if (!out[flagKey]) out[flagKey] = [];
    out[flagKey]!.push(moduleId);
  }
  return out;
})();

export function FeatureFlagsClient({ flags }: Props) {
  const ordenadas = [...FEATURE_FLAG_KEYS].sort((a, b) => {
    const d = ORDEN_EFECTO[FEATURE_FLAG_EFFECT[a]] - ORDEN_EFECTO[FEATURE_FLAG_EFFECT[b]];
    return d !== 0 ? d : FEATURE_FLAG_LABELS[a].localeCompare(FEATURE_FLAG_LABELS[b], "es");
  });
  const sinEfecto = ordenadas.filter((k) => FEATURE_FLAG_EFFECT[k] === "ninguno").length;

  return (
    <>
      {sinEfecto > 0 && (
        <p
          style={{
            font: "400 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            background: "var(--neutral-bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "var(--s-3)",
            margin: "0 0 var(--s-4)",
            maxWidth: "76ch",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>
            {sinEfecto} de {ordenadas.length} flags todavía no están conectados.
          </strong>{" "}
          Vienen del catálogo original del Norte y nombran features que aún no
          se construyeron. Se muestran igual —el valor queda guardado para
          cuando se cableen— pero apagarlos hoy no apaga nada. Cada tarjeta
          dice qué hace la suya.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: "var(--s-3)",
        }}
      >
        {ordenadas.map((key) => (
          <FlagCard
            key={key}
            flagKey={key}
            enabled={flags[key]}
            modulesAffected={FLAG_TO_MODULES[key] ?? []}
          />
        ))}
      </div>
    </>
  );
}

function FlagCard({
  flagKey,
  enabled,
  modulesAffected,
}: {
  flagKey: FeatureFlagKey;
  enabled: boolean;
  modulesAffected: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState<ToggleFlagState, FormData>(
    toggleFeatureFlagAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  const label = FEATURE_FLAG_LABELS[flagKey];
  const efecto = FEATURE_FLAG_EFFECT[flagKey];
  const nota = NOTA_EFECTO[efecto];

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "var(--s-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
        opacity: pending ? 0.6 : 1,
        transition: "opacity var(--dur, 180ms)",
      }}
    >
      <input type="hidden" name="key" value={flagKey} />
      {/* Hidden checkbox que enviamos como "on" cuando queremos encender,
          o nada cuando queremos apagar. Como el toggle es discreto,
          usamos un button que cambia el value y submit. */}
      <input
        type="hidden"
        name="enabled"
        value={enabled ? "" : "on"}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--s-3)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "600 13.5px/1.3 var(--font-sans, 'Archivo')",
              color: "var(--ink)",
              marginBottom: 2,
            }}
          >
            {label}
          </div>
          <code
            style={{
              font: "500 10.5px/1 var(--font-mono, 'JetBrains Mono')",
              color: "var(--ink-soft)",
            }}
          >
            {flagKey}
          </code>
          <div style={{ marginTop: 6 }}>
            <Badge tone={TONO_EFECTO[efecto]} size="xs" dot={efecto !== "ninguno"}>
              {FEATURE_FLAG_EFFECT_LABELS[efecto]}
            </Badge>
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-pressed={enabled}
          aria-label={`${enabled ? "Apagar" : "Encender"} ${label}`}
          style={{
            width: 44,
            height: 24,
            flexShrink: 0,
            background: enabled ? "var(--success)" : "var(--neutral-bg)",
            border: enabled ? "1px solid var(--success)" : "1px solid var(--border-strong)",
            borderRadius: 12,
            padding: 0,
            cursor: pending ? "wait" : "pointer",
            position: "relative",
            transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 1,
              left: enabled ? 21 : 1,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--bg-surface)",
              boxShadow: "var(--shadow-xs)",
              transition: "left var(--dur-fast) var(--ease)",
            }}
          />
        </button>
      </div>

      {(modulesAffected.length > 0 || nota) && (
        <div
          style={{
            font: "500 11px/1.45 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            paddingTop: 6,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {modulesAffected.length > 0 && (
            <span>
              Al apagar: oculta del sidebar{" "}
              <strong style={{ color: "var(--ink)" }}>
                {modulesAffected.join(" · ")}
              </strong>
            </span>
          )}
          {nota && <span>{nota}</span>}
        </div>
      )}

      {state.error && state.flagKey === flagKey && (
        <div
          style={{
            font: "500 11.5px/1.4 var(--font-sans, 'Archivo')",
            color: "var(--danger)",
            paddingTop: 6,
          }}
        >
          {state.error}
        </div>
      )}
    </form>
  );
}
