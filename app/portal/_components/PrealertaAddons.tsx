"use client";

/**
 * SDD-0098 · Menú de servicios de recepción ("ads") sobre la compra + video-ayuda.
 *
 * Tres piezas:
 *  - `BeforeWarehouseNotice`  — el principio rector: pídelo ANTES de que llegue a la bodega.
 *  - `PrealertaServiceVideo`  — short vertical lazy-load (iframe al click) o placeholder.
 *  - `PrealertaAddonPicker`   — selector multi (dentro del <form> de "Nueva compra"):
 *                               outputs `addon` (multi) + `notes_<code>` + `trackings_<code>`
 *                               + `consent` (required cuando hay alguno → bloquea el submit).
 *  - `PrealertaServiceGallery`— galería permanente (un short por servicio · Capa 2).
 *
 * Solo tokens `var(--*)` + clases del portal (BRAND.md). Cero hex inventados.
 */

import { useState } from "react";
import { CheckIcon, PlayIcon } from "@/components/Icon";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";

/** Extrae el id del short de una URL de YouTube (shorts/ · watch?v= · youtu.be/). */
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/,
  );
  return m ? m[1] : null;
}

// ── Aviso "antes de almacén" (principio rector) ─────────────────
export function BeforeWarehouseNotice() {
  return (
    <div
      className="rounded-[10px] border-l-[3px] px-3.5 py-2.5 flex items-start gap-2.5"
      style={{
        background: "var(--color-paper)",
        borderColor: "var(--color-status-success)",
      }}
    >
      <span
        className="w-4 h-4 rounded-full grid place-items-center flex-shrink-0 mt-0.5"
        style={{ background: "var(--color-status-success)", color: "var(--color-white)" }}
      >
        <CheckIcon size={11} />
      </span>
      <p className="text-[12px] text-grey-700 leading-[1.45]">
        Pide estos servicios <strong className="text-ink">antes</strong> de que tu
        compra llegue a nuestra bodega en China. Después no podemos garantizarlos.
      </p>
    </div>
  );
}

// ── Video corto vertical (lazy) ─────────────────────────────────
export function PrealertaServiceVideo({
  url,
  label,
}: {
  url: string | null;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const id = url ? youtubeId(url) : null;

  // Sin video configurado → placeholder sobrio (nunca un iframe roto).
  if (!id) {
    return (
      <div
        className="rounded-[10px] border border-dashed px-3 py-2.5 text-[11.5px] text-grey-500 flex items-center gap-2"
        style={{ borderColor: "var(--color-grey-200)" }}
      >
        <PlayIcon size={13} /> Video de ayuda próximamente.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        style={{ background: "var(--color-paper)", color: "var(--color-wine)" }}
      >
        <span
          className="w-5 h-5 rounded-full grid place-items-center flex-shrink-0"
          style={{ background: "var(--color-wine)", color: "var(--color-white)" }}
          aria-hidden
        >
          <PlayIcon size={11} />
        </span>
        Mira el video y actívalo bien
      </button>
    );
  }

  return (
    <div
      className="relative w-full max-w-[220px] mx-auto rounded-[12px] overflow-hidden bg-black"
      style={{ aspectRatio: "9 / 16" }}
    >
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
        title={`Video: ${label}`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}

// ── Una fila del picker (checkbox-card; expande al marcar) ──────
function AddonRow({
  addon,
  checked,
  onToggle,
}: {
  addon: PrealertaAddon;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-[10px] border transition-colors"
      style={{
        borderColor: checked ? "var(--color-wine)" : "var(--color-grey-200)",
        background: checked ? "var(--color-paper)" : "var(--color-white)",
      }}
    >
      <label className="flex items-start gap-3 p-3 cursor-pointer">
        <input
          type="checkbox"
          name="addon"
          value={addon.code}
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-wine)]"
        />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-bold text-ink">
            {addon.label}
          </span>
          <span className="block mt-0.5 text-[12.5px] text-grey-700 leading-[1.45]">
            {addon.description}
          </span>
        </span>
      </label>

      {checked && (
        <div
          className="px-3 pb-3 flex flex-col gap-2.5 border-t"
          style={{ borderColor: "var(--color-grey-200)" }}
        >
          <div className="pt-3">
            <PrealertaServiceVideo url={addon.videoUrl} label={addon.label} />
          </div>
          <textarea
            name={`notes_${addon.code}`}
            rows={2}
            placeholder={addon.notasPlaceholder ?? "Notas para el equipo (opcional)"}
            className="w-full px-3 py-2 rounded-[10px] bg-white border border-grey-200 outline-none text-[13px] text-ink resize-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
          />
          {addon.multiTracking && (
            <textarea
              name={`trackings_${addon.code}`}
              rows={2}
              placeholder="Trackings a unificar — uno por línea o separados por coma"
              className="w-full px-3 py-2 rounded-[10px] bg-white border border-grey-200 outline-none text-[13px] text-ink resize-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Picker multi-select (va DENTRO del <form> de Nueva compra) ──
export function PrealertaAddonPicker({ addons }: { addons: PrealertaAddon[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [show, setShow] = useState(false);
  if (addons.length === 0) return null;

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const any = selected.size > 0;

  // Revelado de una vía (no colapsa de vuelta → no se pierde la selección): el
  // teaser deja claro que hay servicios sin cargar el modal de entrada (UX review).
  if (!show) {
    return (
      <div className="rounded-[12px] border border-grey-200 p-4">
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
          Servicios sobre tu compra (opcional)
        </span>
        <p className="mt-1.5 text-[11.5px] text-grey-700 leading-[1.45]">
          ¿Quieres que hagamos algo con tu compra al llegar a la bodega?
          Verificarla, inspeccionarla, reempacarla y más. Lo cotiza tu asesor.
        </p>
        <button
          type="button"
          onClick={() => setShow(true)}
          className="btn btn-ghost mt-3 inline-flex items-center gap-2"
        >
          + Ver servicios
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-grey-200 p-4">
      <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
        Servicios sobre tu compra (opcional)
      </span>
      <p className="mt-1.5 text-[11.5px] text-grey-700 leading-[1.45]">
        Pídenos que hagamos algo con tu compra cuando llegue a la bodega. Cada
        servicio lo coordina y cotiza tu asesor.
      </p>

      <div className="mt-3">
        <BeforeWarehouseNotice />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {addons.map((a) => (
          <AddonRow
            key={a.code}
            addon={a}
            checked={selected.has(a.code)}
            onToggle={() => toggle(a.code)}
          />
        ))}
      </div>

      {any && (
        <label
          className="mt-3 flex items-start gap-2.5 cursor-pointer rounded-[10px] p-3 text-[12px] text-grey-700 leading-[1.45]"
          style={{ background: "var(--color-grey-100)" }}
        >
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-wine)]"
          />
          <span>
            Entiendo que estos servicios los coordina y cotiza mi asesor, y que
            debo pedirlos antes de que mi compra llegue a la bodega.
          </span>
        </label>
      )}
    </div>
  );
}

// ── Galería permanente de shorts (Capa 2) ───────────────────────
export function PrealertaServiceGallery({ addons }: { addons: PrealertaAddon[] }) {
  if (addons.length === 0) return null;
  return (
    <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-7">
      <div className="text-[15px] font-bold text-ink">
        ¿Necesitas ayuda con los servicios?
      </div>
      <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.5] max-w-[70ch]">
        Cada servicio que puedes pedir sobre tu compra, explicado en un video corto.
      </p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {addons.map((a) => (
          <div
            key={a.code}
            className="rounded-[12px] border border-grey-200 p-3.5"
          >
            <div className="text-[13px] font-bold text-ink">{a.label}</div>
            <div className="mt-2">
              <PrealertaServiceVideo url={a.videoUrl} label={a.label} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
