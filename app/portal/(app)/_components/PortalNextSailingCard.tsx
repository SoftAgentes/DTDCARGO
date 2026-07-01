"use client";

import { useEffect, useState } from "react";
import type { PortalSailing } from "@/lib/portal/next-sailing-queries";
import { portalSpaceLabel } from "@/lib/portal/next-sailing-queries";
import type { SpaceLevel } from "@/lib/studio/naviera/types";

/**
 * Card "Próxima salida" del dashboard del portal (SDD-0133). Cuenta regresiva VIVA
 * al cut-off del próximo zarpe abierto + ETD/ETA + espacio disponible + copy de
 * acción. Informativa (V1 no reserva). SSR-safe: el server pinta los días como
 * fallback; el tick fino corre solo en el cliente (sin mismatch de hidratación).
 */

const SPACE_COLOR: Record<SpaceLevel, string> = {
  alta: "var(--color-status-success)",
  media: "var(--color-status-warning)",
  baja: "var(--color-status-danger)",
  cerrada: "var(--color-grey-500)",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/** ms restantes hasta el fin del día del cut-off (deadline de carga). */
function remainingMs(cutoffIso: string): number {
  const deadline = new Date(`${cutoffIso.slice(0, 10)}T23:59:59`).getTime();
  return deadline - Date.now();
}

function breakdown(ms: number): { d: number; h: number; m: number; s: number } {
  const clamped = Math.max(0, ms);
  const s = Math.floor(clamped / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export function PortalNextSailingCard({
  sailing,
  serverDaysToCutoff,
}: {
  sailing: PortalSailing;
  /** Días al cut-off calculados en el server (fallback pre-hidratación). */
  serverDaysToCutoff: number | null;
}) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!sailing.cutoff) return;
    const tick = () => setMs(remainingMs(sailing.cutoff as string));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sailing.cutoff]);

  const spaceColor = SPACE_COLOR[sailing.space];
  const cutoffLabel = formatDate(sailing.cutoff);
  const etd = formatDate(sailing.etd);
  const eta = formatDate(sailing.eta);
  const bd = ms != null ? breakdown(ms) : null;
  const route = `${sailing.pol} → ${sailing.pod}`;

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-grey-500">
          Próxima salida
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            color: spaceColor,
            background: `color-mix(in srgb, ${spaceColor} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${spaceColor} 30%, transparent)`,
          }}
        >
          {portalSpaceLabel(sailing.space)}
        </span>
      </div>

      {/* Cuenta regresiva al cut-off */}
      {sailing.cutoff ? (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-grey-500">
            Cierre de carga en
          </div>
          {bd ? (
            <div className="mt-1.5 flex items-end gap-3">
              <Unit n={bd.d} label="días" big />
              <Unit n={bd.h} label="h" />
              <Unit n={bd.m} label="m" />
              <Unit n={bd.s} label="s" />
            </div>
          ) : (
            // Fallback SSR: días del server (sin tick fino aún).
            <div className="mt-1.5 flex items-end gap-3">
              <Unit n={serverDaysToCutoff ?? 0} label="días" big />
            </div>
          )}
        </div>
      ) : null}

      {/* Datos del zarpe */}
      <dl className="mt-5 pt-4 border-t border-grey-200 flex flex-col gap-2.5">
        <Row label="Buque" value={sailing.vessel} mono />
        <Row label="Ruta" value={route} mono />
        {etd ? <Row label="Zarpe (ETD)" value={etd} /> : null}
        {eta ? <Row label="Llegada estimada" value={eta} /> : null}
      </dl>

      {cutoffLabel ? (
        <p className="mt-5 text-[12.5px] text-grey-700 leading-[1.55]">
          Para entrar en esta salida, tu mercancía debe llegar a nuestra bodega en
          China <b>antes del {cutoffLabel}</b>.
        </p>
      ) : null}
    </div>
  );
}

function Unit({ n, label, big = false }: { n: number; label: string; big?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span
        className={big ? "text-[34px] leading-none text-wine" : "text-[18px] leading-none text-ink"}
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontWeight: 800 }}
      >
        {n}
      </span>
      <span className="text-[11px] font-semibold text-grey-500">{label}</span>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[12.5px] text-grey-500">{label}</dt>
      <dd
        className="text-[13.5px] font-semibold text-ink whitespace-nowrap"
        style={mono ? { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
