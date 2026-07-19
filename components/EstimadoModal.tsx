"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon, WhatsAppIcon } from "./Icon";
import { trackLead } from "./Analytics";

/**
 * SDD-0061 Fase B1 — Modal de captura del estimado web.
 *
 * Aparece al oprimir el botón primario de estimar/WhatsApp en cualquier
 * calculadora pública. Pide NOTA (opcional) + NOMBRE + TELÉFONO. Al confirmar:
 *   1. POST /api/public/estimacion  (avisa al equipo del lead — ya NO crea EST-)
 *   2. abre wa.me con el mensaje (datos + nota) — el padre lo arma.
 *
 * El POST es best-effort (solo dispara el aviso): abrimos WhatsApp igual si falla.
 * onConfirm recibe (contact, null) — ya no hay código del ERP para el visitante.
 *
 * Sobrio: solo tokens de marca + fuentes del sitio (Archivo). Cero AI slop.
 * Boundary-safe: vive en components/, no toca Supabase (el fetch va al endpoint).
 */

export type EstimadoContact = {
  nombre: string;
  telefono: string;
  nota: string;
};

export function EstimadoModal({
  open,
  onClose,
  /** Prefill (en /estimacion ya hay nombre/teléfono del form). */
  initialNombre = "",
  initialTelefono = "",
  /**
   * Confirmar. Recibe el contacto + el `estimateCode` devuelto por el ERP
   * (o null si el POST falló). El padre arma + abre el wa.me.
   */
  onConfirm,
  /** Payload de la calc para el POST (todo menos contacto/nota). */
  buildPayload,
}: {
  open: boolean;
  onClose: () => void;
  initialNombre?: string;
  initialTelefono?: string;
  onConfirm: (contact: EstimadoContact, estimateCode: string | null) => void;
  buildPayload: (contact: EstimadoContact) => Record<string, unknown>;
}) {
  const [nombre, setNombre] = useState(initialNombre);
  const [telefono, setTelefono] = useState(initialTelefono);
  const [nota, setNota] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ nombre?: string; telefono?: string }>({});
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Re-sync del prefill cuando se abre (el form de /estimacion puede cambiar).
  useEffect(() => {
    if (open) {
      setNombre(initialNombre);
      setTelefono(initialTelefono);
      setNota("");
      setErrors({});
      setSubmitting(false);
    }
  }, [open, initialNombre, initialTelefono]);

  // Cerrar con Escape + foco inicial + focus trap (WCAG 2.4.3 / 2.1.2).
  // El modal es aria-modal → el foco de teclado debe quedar contenido en la card.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusables = card.querySelectorAll<HTMLElement>(
        'button, input, textarea, a[href]'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      // Si el foco está fuera de la card (p.ej. en el scrim), traerlo dentro.
      if (!card.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose, submitting]);

  if (!open) return null;

  async function handleConfirm() {
    const nextErrors: { nombre?: string; telefono?: string } = {};
    if (!nombre.trim()) nextErrors.nombre = "Dinos tu nombre.";
    if (!telefono.trim()) nextErrors.telefono = "Dinos tu WhatsApp o teléfono.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const contact: EstimadoContact = {
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      nota: nota.trim(),
    };

    setSubmitting(true);
    let estimateCode: string | null = null;
    try {
      const res = await fetch("/api/public/estimacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPayload(contact),
          prospectName: contact.nombre,
          prospectWhatsapp: contact.telefono,
          nota: contact.nota || null,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { estimateCode?: string };
        estimateCode = data.estimateCode ?? null;
      } else {
        // No bloqueamos: el estimado puede no haberse guardado, pero igual
        // abrimos WhatsApp para no perder al cliente.
        console.warn("[EstimadoModal] POST estimacion no-ok:", res.status);
      }
    } catch (err) {
      console.warn("[EstimadoModal] POST estimacion error de red:", err);
    }

    // GA4 `generate_lead`: el contacto ya quedó capturado (nombre + teléfono),
    // aunque el POST haya fallado — el flujo sigue a WhatsApp igual.
    trackLead("estimado");

    onConfirm(contact, estimateCode);
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Scrim. z-[110] (sobre el WhatsAppFAB en z-100) para que no flote encima. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-ink/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 rounded-[6px]"
        style={{ backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      />

      {/* Card */}
      <div
        ref={cardRef}
        className="relative w-full sm:max-w-[460px] bg-white rounded-t-[20px] sm:rounded-[18px] card-shadow border border-grey-200 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-grey-200">
          <div>
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine">
              Último paso
            </span>
            <h2
              id={titleId}
              className="mt-1.5 text-[22px] leading-[1.15] text-ink"
              style={{ fontFamily: "var(--font-brand-display)" }}
            >
              ¿A quién le respondemos?
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => !submitting && onClose()}
            className="flex-shrink-0 text-grey-500 hover:text-ink transition-colors -mt-1 -mr-1 p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 rounded-[6px]"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <Field label="Tu nombre" error={errors.nombre}>
            <input
              ref={firstFieldRef}
              type="text"
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink w-full focus:ring-2 focus:ring-wine/40"
            />
          </Field>

          <Field label="WhatsApp o teléfono" error={errors.telefono}>
            <input
              type="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+58 412 ..."
              className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink w-full focus:ring-2 focus:ring-wine/40"
            />
          </Field>

          <Field label="Nota para tu asesor (opcional)">
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${t.scrollHeight}px`;
              }}
              rows={2}
              placeholder="Ej: tengo la mercancía lista para despachar."
              className="px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink w-full resize-none focus:ring-2 focus:ring-wine/40 overflow-hidden"
            />
          </Field>
        </div>

        <div className="px-6 pb-6 pt-1 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="btn bg-whatsapp text-white disabled:opacity-60 disabled:cursor-wait"
            style={{ minHeight: 52 }}
          >
            <WhatsAppIcon size={20} />
            {submitting ? "Enviando…" : "Enviar por WhatsApp"}
          </button>
          <p className="text-[11.5px] text-grey-500 text-center leading-[1.45]">
            Abrimos WhatsApp con tu estimado y tus datos. Un asesor te responde.
            No compartimos tus datos con terceros.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </span>
      {children}
      {error && (
        <span className="text-[12px] font-medium text-wine">{error}</span>
      )}
    </label>
  );
}
