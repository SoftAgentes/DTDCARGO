"use client";

/**
 * FeatureFlagsClient · grilla de toggles para los 20 flags del tenant.
 *
 * Cada toggle es un form independiente con server action propia
 * (optimistic UI no necesario para volumen actual). Tras éxito,
 * router.refresh() para que el layout traiga los flags nuevos y el
 * sidebar se actualice.
 */

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_LABELS,
  MODULE_FLAG_MAP,
  type FeatureFlagKey,
  type FeatureFlags,
} from "@/lib/studio/feature-flags-types";
import {
  toggleFeatureFlagAction,
  type ToggleFlagState,
} from "../actions";

interface Props {
  flags: FeatureFlags;
}

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
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
        gap: "var(--s-3)",
      }}
    >
      {FEATURE_FLAG_KEYS.map((key) => (
        <FlagCard
          key={key}
          flagKey={key}
          enabled={flags[key]}
          modulesAffected={FLAG_TO_MODULES[key] ?? []}
        />
      ))}
    </div>
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

      {modulesAffected.length > 0 && (
        <div
          style={{
            font: "500 11px/1.4 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            paddingTop: 6,
            borderTop: "1px solid var(--border)",
          }}
        >
          Al apagar: oculta del sidebar{" "}
          <strong style={{ color: "var(--ink)" }}>
            {modulesAffected.join(" · ")}
          </strong>
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
