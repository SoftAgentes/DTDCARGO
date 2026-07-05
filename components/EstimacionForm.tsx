"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { ORIGINS, DESTINATIONS, CONTACT } from "@/lib/design-tokens";
import { trackWhatsAppConversion } from "@/components/Analytics";
import { parseDecimalInput } from "@/lib/calculadora";
import {
  buildEstimadoWhatsAppMessage,
  type EstimadoCalcKind,
} from "@/lib/public/estimado-web";
import { EstimadoModal, type EstimadoContact } from "./EstimadoModal";
import { ArrowIcon, CheckIcon } from "./Icon";

type Status = "idle" | "submitting" | "success" | "error";

/** Datos del estimado calculado al submit, que viajan al modal + al ERP. */
type EstimateDraft = {
  low: number;
  high: number;
  mid: number;
  days: string;
  calc: EstimadoCalcKind;
  origen: string;
  destino: string;
  peso: number;
  volumen: number;
  descripcion: string;
  nombre: string;
  email: string;
  whatsapp: string;
};

/**
 * Formulario completo de estimación.
 *
 * SDD-0061 Fase B1: al "Estimar ahora" se calcula el rango y se abre el modal de
 * captura (nota + contacto prefilleado). El modal hace POST a
 * `/api/public/estimacion` (crea el estimado en el ERP con EST-XXXX) y abre
 * WhatsApp con el mensaje + nota + EST. El `leadId` mock pasó a ser el EST real
 * del ERP. Si el POST falla, igual se abre WhatsApp (fallback) con EST nulo.
 *
 * Dimensiones: el usuario ingresa Largo × Ancho × Alto en cm y se calcula
 * el volumen en m³ al submit ((L×A×H) / 1.000.000). Esto es más amigable
 * que pedirle volumen directo a un usuario B2B no técnico.
 *
 * Diagrama educativo de dimensiones: SVG flotante que aparece cuando el
 * usuario hover por primera vez sobre los campos L/A/H (auto-hide a 3s),
 * y vuelve a aparecer cada vez que clickean en uno de esos campos.
 */
export function EstimacionForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [estimate, setEstimate] = useState<{
    low: number;
    high: number;
    days: string;
    // null = el POST falló y el ERP no asignó código todavía. NO mostramos un
    // código placeholder falso (EST-PENDIENTE) como si fuera real.
    estimateCode: string | null;
  } | null>(null);

  // SDD-0061 Fase B1 · borrador calculado + modal de captura.
  const [draft, setDraft] = useState<EstimateDraft | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ─── Diagrama de dimensiones — UX hover-first + click-to-repeat ───
  const [showDiagram, setShowDiagram] = useState(false);
  const [hasShownViaHover, setHasShownViaHover] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDiagramFor3s = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowDiagram(true);
    hideTimerRef.current = setTimeout(() => setShowDiagram(false), 3000);
  };

  const onDimensionsHover = () => {
    // Solo la PRIMERA vez que el usuario hover, mostramos automáticamente.
    if (!hasShownViaHover) {
      setHasShownViaHover(true);
      showDiagramFor3s();
    }
  };

  // Cleanup del timer si el componente desmonta
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    // Parseo tolerante a coma o punto (es-VE escribe "120,5"). Los campos son
    // type="text" inputMode="decimal", así que la coma llega cruda en FormData.
    const num = (v: FormDataEntryValue | undefined) => {
      const n = parseDecimalInput(String(v ?? ""));
      return Number.isFinite(n) ? n : 0;
    };
    const peso = num(payload.peso);
    // L × A × H en cm → m³ (dividir entre 1.000.000)
    const largo = num(payload.largo);
    const ancho = num(payload.ancho);
    const alto = num(payload.alto);
    const volumen = (largo * ancho * alto) / 1_000_000;
    // Aéreo retirado: el flete aéreo de carga está suspendido → solo marítimo.
    const factor = 1.3;
    const base = Math.max(peso, volumen * 167) * factor + 220;

    setDraft({
      low: Math.round(base * 0.9),
      high: Math.round(base * 1.15),
      mid: Math.round(base),
      days: "60-90 días puerta a puerta",
      calc: "maritimo",
      origen: String(payload.origen ?? ""),
      destino: String(payload.destino ?? ""),
      peso,
      volumen,
      descripcion: String(payload.descripcion ?? ""),
      nombre: String(payload.nombre ?? ""),
      email: String(payload.email ?? ""),
      whatsapp: String(payload.whatsapp ?? ""),
    });
    setStatus("idle");
    setModalOpen(true);
  }

  // Confirmar desde el modal: el estimado ya quedó en el ERP (estimateCode o
  // null si falló). Mostramos la pantalla de éxito y abrimos WhatsApp.
  function handleConfirm(contact: EstimadoContact, estimateCode: string | null) {
    if (!draft) return;
    const base = [
      "Hola, acabo de estimar mi envío en la web:",
      "",
      `• Modo: Marítimo (LCL)`,
      `• Origen: ${draft.origen}`,
      `• Destino: ${draft.destino}`,
      `• Peso: ${draft.peso} kg`,
      `• Volumen aprox: ${draft.volumen.toFixed(3)} m³`,
      ...(draft.descripcion ? [`• Mercancía: ${draft.descripcion}`] : []),
      `• Estimado web: US$${draft.low.toLocaleString("en-US")} – ${draft.high.toLocaleString("en-US")}`,
      "",
      "¿Me confirman la tarifa final y los tiempos?",
    ].join("\n");
    const text = buildEstimadoWhatsAppMessage({
      baseMessage: base,
      nota: contact.nota,
      estimateCode,
    });
    const url = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(text)}`;
    // window.open NO pasa por el listener global de <a> — conversión manual.
    trackWhatsAppConversion("estimacion");
    window.open(url, "_blank", "noopener,noreferrer");

    setEstimate({
      low: draft.low,
      high: draft.high,
      days: draft.days,
      estimateCode,
    });
    setStatus("success");
    setModalOpen(false);
  }

  if (status === "success" && estimate) {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10">
        <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] uppercase text-wine">
          <CheckIcon size={16} className="text-wine" />
          Estimación generada
        </div>
        <div
          className="mt-4 text-[40px] lg:text-[56px] leading-none text-ink"
          style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
        >
          USD {estimate.low.toLocaleString("es-VE")} –{" "}
          {estimate.high.toLocaleString("es-VE")}
        </div>
        <div className="mt-3 text-[15px] text-grey-500">
          Tiempo estimado: <strong className="text-ink">{estimate.days}</strong>
        </div>
        <p className="mt-6 text-[14.5px] text-grey-700 leading-[1.55]">
          Este es un rango referencial. Un asesor te contactará en menos de
          24 hs con la estimación cerrada DDP — incluyendo flete, aduana,
          impuestos y entrega.
        </p>
        <div className="mt-3 text-[12px] tracking-[0.08em] uppercase text-grey-500">
          {estimate.estimateCode
            ? `Estimado #${estimate.estimateCode}`
            : "Tu asesor te asigna el código al confirmar."}
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
              estimate.estimateCode
                ? `Hola, mi código de estimado es ${estimate.estimateCode}. Quiero confirmar mi envío.`
                : "Hola, acabo de generar un estimado en la web y quiero confirmar mi envío."
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Confirmar por WhatsApp <ArrowIcon />
          </a>
          <Link href="/" className="btn btn-ghost">
            Volver al inicio
          </Link>
        </div>

        {/* SDD-0061 Fase B2 — CTA opcional de registro (baja fricción). Lleva el
            código del estimado para vincularlo automáticamente a la cuenta. */}
        {estimate.estimateCode && (
          <Link
            href={`/registro?est=${encodeURIComponent(estimate.estimateCode)}`}
            className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-grey-200 bg-grey-100 px-4 py-3 text-[13.5px] text-grey-700 transition-colors hover:border-wine hover:text-wine"
          >
            <span>
              <strong className="text-ink">Regístrate y obtén tu MARKBOX.</strong>{" "}
              Tu estimado queda guardado y vinculado a tu cuenta.
            </span>
            <span className="inline-flex items-center gap-1.5 flex-shrink-0 font-semibold text-wine">
              Crear cuenta <ArrowIcon />
            </span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
    <form
      onSubmit={onSubmit}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 flex flex-col gap-5"
    >
      {/* No usar <Row>: el chip es un dato de estado, no un control → no va en <label>. */}
      <div className="flex flex-col gap-2">
        <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
          Modo de envío
        </span>
        <div
          className="flex items-center h-12 px-3.5 rounded-[10px] bg-grey-100 text-[14.5px] font-medium text-grey-700"
          title="Servicio aéreo temporalmente no disponible"
        >
          Marítimo (LCL)
        </div>
      </div>

      <Row label="Origen">
        <select
          name="origen"
          required
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink focus:ring-2 focus:ring-wine/40"
        >
          {ORIGINS.map((o) => (
            <option key={o.code} value={o.label}>
              {o.label} · {o.cjk}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Destino">
        <select
          name="destino"
          required
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink focus:ring-2 focus:ring-wine/40"
        >
          {DESTINATIONS.map((d) => (
            <option key={d.code} value={d.label}>
              {d.label}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Peso (kg)">
        <input
          type="text"
          inputMode="decimal"
          name="peso"
          required
          placeholder="120"
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink focus:ring-2 focus:ring-wine/40"
        />
      </Row>

      {/* Dimensiones (L x A x H en cm) + diagrama flotante educativo */}
      <div className="relative" onMouseEnter={onDimensionsHover}>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
            Dimensiones por caja (cm)
          </span>
          <button
            type="button"
            onClick={showDiagramFor3s}
            className="text-[11.5px] font-medium text-wine hover:text-wine-deep underline underline-offset-2"
          >
            ¿Cómo medir?
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {/* Labels color-coded para matchear el SVG educativo (wine/gold/ink
              en versiones mas tenues). Asi el usuario asocia visualmente
              el campo del form con la flecha del diagrama. */}
          <DimInput name="largo" label="Largo" placeholder="40" onTrigger={showDiagramFor3s} labelColor="#C2747F" />
          <DimInput name="ancho" label="Ancho" placeholder="30" onTrigger={showDiagramFor3s} labelColor="#D4B077" />
          <DimInput name="alto" label="Alto" placeholder="25" onTrigger={showDiagramFor3s} labelColor="#5C6B8E" />
        </div>

        {/* Diagrama flotante - aparece por hover (1ra vez) o click en campos L/A/H */}
        <div
          aria-hidden={!showDiagram}
          className={`absolute left-1/2 -translate-x-1/2 top-full mt-3 z-30 w-full max-w-[420px] pointer-events-none transition-all duration-500 ease-out ${
            showDiagram
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/dtdcargo-dimensions-box.svg"
            alt="Diagrama: como medir el largo, ancho y alto de una caja"
            width={600}
            height={500}
            className="w-full h-auto drop-shadow-[0_20px_40px_rgba(15,30,61,0.25)]"
          />
        </div>
      </div>

      <Row label="Descripción de la mercancía">
        <textarea
          name="descripcion"
          rows={2}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${t.scrollHeight}px`;
          }}
          placeholder="Ej: 5 cajas de auriculares bluetooth, link de Alibaba…"
          className="px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none focus:ring-2 focus:ring-wine/40 overflow-hidden"
        />
      </Row>

      <hr className="border-grey-200 my-2" />

      <Row label="Tu nombre">
        <input
          type="text"
          name="nombre"
          required
          autoComplete="name"
          placeholder="Nombre y apellido"
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus:ring-2 focus:ring-wine/40"
        />
      </Row>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Row label="Email">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="tu@email.com"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus:ring-2 focus:ring-wine/40"
          />
        </Row>
        <Row label="WhatsApp">
          <input
            type="tel"
            name="whatsapp"
            required
            autoComplete="tel"
            placeholder="+58 412 ..."
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus:ring-2 focus:ring-wine/40"
          />
        </Row>
      </div>

      {/* Enlace contextual a la calculadora del último km (ahora en su propia
          página). La calc terrestre salió de este form en SDD-0061 Fase A. */}
      <Link
        href="/calculadora-terrestre"
        className="flex items-center justify-between gap-3 rounded-[10px] border border-grey-200 bg-grey-100 px-4 py-3 text-[13.5px] text-grey-700 transition-colors hover:border-wine hover:text-wine"
      >
        <span>
          <strong className="text-ink">¿Necesitas el flete interno en Venezuela?</strong>{" "}
          Calcula el último km hasta tu ciudad.
        </span>
        <span className="inline-flex items-center gap-1.5 flex-shrink-0 font-semibold text-wine">
          Calculadora terrestre <ArrowIcon />
        </span>
      </Link>

      <button
        type="submit"
        className="btn btn-primary h-14 mt-3"
      >
        Estimar ahora <ArrowIcon />
      </button>

      {status === "error" && (
        <p className="text-[13.5px] text-wine">
          Algo falló. Prueba de nuevo o escríbenos por WhatsApp.
        </p>
      )}

      <p className="text-[12.5px] text-grey-500 leading-[1.5]">
        Al estimar aceptas que un asesor te contacte por email o WhatsApp.
        No compartimos tus datos con terceros.
      </p>
    </form>

      <EstimadoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialNombre={draft?.nombre ?? ""}
        initialTelefono={draft?.whatsapp ?? ""}
        onConfirm={handleConfirm}
        buildPayload={() => ({
          calc: draft?.calc ?? "maritimo",
          origin: draft?.origen ?? "China",
          destination: draft?.destino ?? "Venezuela",
          weightKg: draft?.peso ?? null,
          cbm: draft?.volumen ?? null,
          packaging: "carton",
          // El form da un rango; persistimos el punto medio como total estimado.
          totalUsd: draft?.mid ?? 0,
          subtotalUsd: draft?.mid ?? 0,
          prospectEmail: draft?.email ?? null,
        })}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Input compacto para una dimension (largo/ancho/alto) en cm.
 * Trigger del diagrama tanto en click como en focus (TAB nav).
 */
function DimInput({
  name,
  label,
  placeholder,
  onTrigger,
  labelColor,
}: {
  name: string;
  label: string;
  placeholder: string;
  onTrigger: () => void;
  /**
   * Opcional: color custom para el label (usado en L/A/H para matchear los
   * colores del SVG educativo). Default: text-grey-500 via Tailwind class.
   */
  labelColor?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className={`text-[11px] font-bold uppercase tracking-[0.08em] text-center ${labelColor ? "" : "text-grey-500"}`}
        style={labelColor ? { color: labelColor } : undefined}
      >
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        required
        placeholder={placeholder}
        onClick={onTrigger}
        onFocus={onTrigger}
        className="h-12 px-2 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-semibold text-ink text-center"
      />
    </label>
  );
}
