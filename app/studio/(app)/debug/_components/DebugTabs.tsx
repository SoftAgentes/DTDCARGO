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
import { NorteTab } from "./NorteTab";

// Tipos + helpers puros viven en `debug-tabs.shared.ts` (server-safe, sin
// "use client"): el page.tsx (server) los necesita para resolver la pestaña
// activa. Acá los importamos para uso interno y los re-exportamos para que los
// consumidores client (tabs, tests) sigan importando desde "./DebugTabs".
import {
  DEBUG_TABS,
  isDebugTab,
  modeDotColor,
  resolveDebugTab,
  type DebugTabKey,
  type DebugTabMode,
} from "./debug-tabs.shared";

export { DEBUG_TABS, isDebugTab, modeDotColor, resolveDebugTab };
export type { DebugTabKey, DebugTabMode };

export function DebugTabs({
  active,
  estado,
  bugs,
  radar,
  searates,
  env,
}: {
  active: DebugTabKey;
  estado: ReactNode;
  bugs: ReactNode;
  /**
   * Pestaña Radar (Slice C) — llega ya renderizada desde el server porque su
   * informe se lee del filesystem (`public/api/radar-report.json`). Trae su
   * PROPIO banner de limitación mode-aware → el genérico no se renderiza.
   */
  radar: ReactNode;
  /**
   * Pestaña SeaRates (SDD-0092) — panel de prueba del benchmark de fletes.
   * Opcional para no romper callers/tests previos; el genérico de modo "vivo"
   * sí aplica (consulta en tiempo real al endpoint admin).
   */
  searates?: ReactNode;
  /** Entorno de ejecución — el banner del Norte/Radar es mode-aware (web vs local). */
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
          Norte y Radar traen su PROPIO banner de limitación (mode-aware, en
          NorteTab/RadarTab) → se omite el genérico acá para no duplicar. */}
      {active !== "norte" && active !== "radar" && <ModeBanner active={active} />}

      {/* Contenido de la pestaña activa */}
      {active === "estado" && estado}
      {active === "bugs" && bugs}
      {active === "norte" && <NorteTab env={env} />}
      {active === "radar" && radar}
      {active === "searates" && searates}
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
