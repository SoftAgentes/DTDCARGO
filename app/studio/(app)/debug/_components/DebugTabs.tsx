"use client";

/**
 * Torre de control · navegación por pestañas (SDD-0050 Slice A).
 *
 * Client component que renderiza la barra de pestañas + un "badge de modo" por
 * pestaña (cada una declara si está VIVA en web, es un SNAPSHOT de build, o
 * corre SOLO en local — requisito no-negociable de la spec). La pestaña activa
 * se decide por `?tab=` (default `estado`); el switch navega cambiando ese
 * query param con el router (no remonta la página, solo cambia el contenido
 * visible que ya vino renderizado del server).
 *
 * Estado y Bugs llegan ya renderizados desde el server (slots). Norte y Radar
 * son placeholders visibles que muestran su banner de modo — su contenido real
 * es Slice B (Norte snapshot) y Slice C (Radar artefacto).
 */

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { EnvName } from "@/lib/studio/env-status";
import { EmptyState } from "../../../_components/ui/EmptyState";
import { NorteTab } from "./NorteTab";

export type DebugTabKey = "estado" | "bugs" | "norte" | "radar";

export type DebugTabMode = "vivo" | "snapshot" | "local";

export const DEBUG_TABS: ReadonlyArray<{
  key: DebugTabKey;
  label: string;
  /** Modo de la pestaña — declara qué tan "vivo" está su contenido en la web. */
  mode: DebugTabMode;
  modeLabel: string;
}> = [
  { key: "estado", label: "Estado", mode: "vivo", modeLabel: "vivo" },
  { key: "bugs", label: "Bugs", mode: "vivo", modeLabel: "vivo" },
  { key: "norte", label: "Norte", mode: "snapshot", modeLabel: "snapshot" },
  { key: "radar", label: "Radar", mode: "local", modeLabel: "solo local" },
];

/**
 * Color del dot que indica el modo de la pestaña. Reemplaza al glyph de emoji
 * (🟢/🟡/⚪) que usa la spec para describir los modos: el sistema del Studio usa
 * dots de color tokenizados, no emojis decorativos (regla de marca C5). El
 * mapping semántico se mantiene: vivo→verde, snapshot→ámbar, local→neutral.
 */
export function modeDotColor(mode: DebugTabMode): string {
  if (mode === "vivo") return "var(--success)";
  if (mode === "snapshot") return "var(--warning)";
  return "var(--ink-mute)";
}

export function isDebugTab(v: string | undefined | null): v is DebugTabKey {
  return v === "estado" || v === "bugs" || v === "norte" || v === "radar";
}

export function resolveDebugTab(raw: string | undefined | null): DebugTabKey {
  return isDebugTab(raw) ? raw : "estado";
}

export function DebugTabs({
  active,
  estado,
  bugs,
  env,
}: {
  active: DebugTabKey;
  estado: ReactNode;
  bugs: ReactNode;
  /** Entorno de ejecución — el banner del Norte es mode-aware (web vs local). */
  env: EnvName;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const go = (key: DebugTabKey) => {
    if (key === active) return;
    startTransition(() => {
      router.push(key === "estado" ? "/studio/debug" : `/studio/debug?tab=${key}`);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      {/* Barra de pestañas */}
      <div
        role="tablist"
        aria-label="Torre de control"
        style={{
          display: "flex",
          gap: "var(--s-2)",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "var(--s-2)",
          opacity: isPending ? 0.7 : 1,
        }}
      >
        {DEBUG_TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-tab={t.key}
              data-active={isActive ? "true" : "false"}
              onClick={() => go(t.key)}
              className="studio-btn studio-btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: isActive ? "var(--bg-elevated)" : "transparent",
                border: isActive
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
                color: isActive ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {t.label}
              <span
                aria-hidden
                title={`Modo ${t.modeLabel}`}
                data-mode={t.mode}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: modeDotColor(t.mode),
                  marginLeft: 2,
                  flexShrink: 0,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Banner de modo genérico para las pestañas que no traen el suyo propio.
          Norte trae su PROPIO banner de limitación (mode-aware, en NorteTab) →
          se omite el genérico acá para no duplicar. */}
      {active !== "norte" && <ModeBanner active={active} />}

      {/* Contenido de la pestaña activa */}
      {active === "estado" && estado}
      {active === "bugs" && bugs}
      {active === "norte" && <NorteTab env={env} />}
      {active === "radar" && <RadarPlaceholder />}
    </div>
  );
}

function ModeBanner({ active }: { active: DebugTabKey }) {
  const meta = DEBUG_TABS.find((t) => t.key === active);
  if (!meta) return null;

  const accent =
    meta.mode === "vivo"
      ? "var(--success)"
      : meta.mode === "snapshot"
        ? "var(--warning)"
        : "var(--ink-mute)";
  const bg =
    meta.mode === "vivo"
      ? "var(--success-bg)"
      : meta.mode === "snapshot"
        ? "var(--warning-bg)"
        : "var(--neutral-bg)";

  const text =
    meta.mode === "vivo"
      ? "Datos vivos · se consultan en tiempo real desde la web."
      : meta.mode === "snapshot"
        ? "Snapshot del último build · la versión viva/interactiva del Norte es local (node scripts/norte.mjs → :3010)."
        : "El Radar no corre en la web · se ejecuta solo en local con /radar en Claude Code. Llega en la Slice C.";

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--s-3)",
        background: bg,
        border: `1px solid ${accent}`,
        borderRadius: "var(--r-md)",
        padding: "var(--s-3) var(--s-4)",
        fontSize: 12.5,
        color: "var(--ink-soft)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: accent,
          flexShrink: 0,
        }}
      />
      <span>
        <strong style={{ color: "var(--ink)" }}>Modo {meta.modeLabel}</strong>
        {" · "}
        {text}
      </span>
    </div>
  );
}

function RadarPlaceholder() {
  return (
    <EmptyState
      eyebrow="Radar · próximamente"
      title="Informe del Radar — Slice C"
      description={
        <>
          El Radar no es funcional en la web — corre solo en local con{" "}
          <code style={{ fontFamily: "var(--f-mono)" }}>/radar</code> en Claude
          Code. La lectura del último informe guardado se agrega en la Slice C;
          los informes no aparecen ni se actualizan acá.
        </>
      }
    />
  );
}
