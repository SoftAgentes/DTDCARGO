"use client";

/**
 * RecepcionAddonsSection — editor de los 7 "Servicios de recepción" que el cliente
 * pide sobre su compra (SDD-0098 · PORT-6). El admin prende/apaga cada servicio y
 * pega su video de ayuda de YouTube, sin SQL. Cada fila guarda por separado
 * (useActionState). Solo tokens var(--*).
 */

import { useActionState, useEffect, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import {
  updatePrealertaAddonConfigAction,
  type AddonConfigState,
} from "../recepcion-addons-actions";

export function RecepcionAddonsSection({
  addons,
}: {
  addons: PrealertaAddon[];
}) {
  const withVideo = addons.filter((a) => a.videoUrl).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          font: "500 12.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          padding: "10px 13px",
        }}
      >
        {withVideo === 0
          ? "Ningún servicio tiene video de ayuda todavía — el cliente ve “próximamente”. Pega un enlace de YouTube (short vertical) para activarlo."
          : `${withVideo} de ${addons.length} servicios tienen video de ayuda.`}
      </div>

      {addons.map((a) => (
        <AddonConfigRow key={a.code} addon={a} />
      ))}
    </div>
  );
}

function AddonConfigRow({ addon }: { addon: PrealertaAddon }) {
  const [state, formAction, pending] = useActionState<AddonConfigState, FormData>(
    updatePrealertaAddonConfigAction,
    {},
  );
  const [active, setActive] = useState(addon.isActive);
  const [saved, setSaved] = useState(false);
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.ok) setSaved(true);
  }

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <form
      action={formAction}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
      <input type="hidden" name="code" value={addon.code} />
      <input type="hidden" name="is_active" value={active ? "true" : "false"} />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{ font: "700 14px/1.3 var(--f-sans)", color: "var(--ink)" }}
            >
              {addon.label}
            </span>
            {addon.multiTracking && (
              <Badge tone="neutral" size="sm">
                Multi-tracking
              </Badge>
            )}
          </div>
          <p
            style={{
              font: "400 12px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "4px 0 0",
              maxWidth: "68ch",
            }}
          >
            {addon.description}
          </p>
        </div>

        {/* Toggle activo */}
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={`${active ? "Desactivar" : "Activar"} ${addon.label}`}
          onClick={() => setActive((v) => !v)}
          style={{
            flexShrink: 0,
            width: 44,
            height: 24,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            padding: 2,
            background: active ? "var(--success)" : "var(--border-strong)",
            transition: "background .15s ease",
            display: "inline-flex",
            justifyContent: active ? "flex-end" : "flex-start",
            alignItems: "center",
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              display: "block",
            }}
          />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <label
          htmlFor={`video-${addon.code}`}
          style={{
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            flexShrink: 0,
          }}
        >
          Video de ayuda
        </label>
        <input
          id={`video-${addon.code}`}
          name="video_url"
          type="url"
          inputMode="url"
          defaultValue={addon.videoUrl ?? ""}
          placeholder="https://youtu.be/… (vacío = próximamente)"
          className="studio-input studio-input-mono"
          style={{ flex: "1 1 260px", minWidth: 200 }}
        />
        <button
          type="submit"
          disabled={pending}
          className="studio-btn studio-btn-primary studio-btn-sm"
        >
          {pending ? "Guardando…" : saved ? "Guardado ✓" : "Guardar"}
        </button>
      </div>

      {state.error && (
        <p
          role="alert"
          style={{
            font: "600 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: "10px 0 0",
          }}
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
