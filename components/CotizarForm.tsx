"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { ORIGINS, DESTINATIONS, CONTACT } from "@/lib/design-tokens";
import { ArrowIcon } from "./Icon";
import { UltimoKmCalculator } from "./UltimoKmCalculator";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Formulario completo de cotización. En MVP usa un mock que simula la respuesta
 * — cuando el ERP exponga `POST {ERP}/api/public/cotizar` y `POST /leads`,
 * cambiamos `mockSubmit` por `fetch(...)`.
 *
 * Dimensiones: el usuario ingresa Largo × Ancho × Alto en cm y se calcula
 * el volumen en m³ al submit ((L×A×H) / 1.000.000). Esto es más amigable
 * que pedirle volumen directo a un usuario B2B no técnico.
 *
 * Diagrama educativo de dimensiones: SVG flotante que aparece cuando el
 * usuario hover por primera vez sobre los campos L/A/H (auto-hide a 3s),
 * y vuelve a aparecer cada vez que clickean en uno de esos campos.
 */
export function CotizarForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [estimate, setEstimate] = useState<{
    low: number;
    high: number;
    days: string;
    leadId: string;
  } | null>(null);

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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      // MOCK: simulamos llamada al ERP. Reemplazar cuando los endpoints estén listos.
      await new Promise((r) => setTimeout(r, 900));
      const peso = Number(payload.peso ?? 0);
      // L × A × H en cm → m³ (dividir entre 1.000.000)
      const largo = Number(payload.largo ?? 0);
      const ancho = Number(payload.ancho ?? 0);
      const alto = Number(payload.alto ?? 0);
      const volumen = (largo * ancho * alto) / 1_000_000;
      const factor = payload.modo === "aereo" ? 6 : 1.3;
      const base = Math.max(peso, volumen * 167) * factor + 220;
      setEstimate({
        low: Math.round(base * 0.9),
        high: Math.round(base * 1.15),
        days: payload.modo === "aereo" ? "5-10 días" : "30-45 días",
        leadId: `DTD-LEAD-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success" && estimate) {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10">
        <div className="inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] uppercase text-wine">
          ✓ Cotización generada
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
          24 hs con la cotización cerrada DDP — incluyendo flete, aduana,
          impuestos y entrega.
        </p>
        <div className="mt-3 text-[12px] tracking-[0.08em] uppercase text-grey-500">
          Lead #{estimate.leadId}
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
              `Hola, acabo de cotizar y mi lead es ${estimate.leadId}. Quiero confirmar mi envío.`
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
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 flex flex-col gap-5"
    >
      <Row label="Modo de envío">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { v: "maritimo", l: "Marítimo (LCL)" },
            { v: "aereo", l: "Aéreo" },
          ].map((opt) => (
            <label
              key={opt.v}
              className="flex items-center justify-center h-12 rounded-[10px] border border-grey-200 cursor-pointer has-[:checked]:border-wine has-[:checked]:bg-wine/5 has-[:checked]:text-wine font-semibold text-[14px] transition-colors"
            >
              <input
                type="radio"
                name="modo"
                value={opt.v}
                defaultChecked={opt.v === "maritimo"}
                className="sr-only"
              />
              {opt.l}
            </label>
          ))}
        </div>
      </Row>

      <Row label="Origen">
        <select
          name="origen"
          required
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink"
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
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink"
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
          type="number"
          name="peso"
          min={1}
          required
          placeholder="120"
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink"
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
            Como medir?
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
          placeholder="Ej: 5 cajas de auriculares bluetooth, link de Alibaba…"
          className="px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none"
        />
      </Row>

      <hr className="border-grey-200 my-2" />

      <Row label="Tu nombre">
        <input
          type="text"
          name="nombre"
          required
          placeholder="Nombre y apellido"
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
        />
      </Row>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Row label="Email">
          <input
            type="email"
            name="email"
            required
            placeholder="tu@email.com"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
          />
        </Row>
        <Row label="WhatsApp">
          <input
            type="tel"
            name="whatsapp"
            required
            placeholder="+58 412 ..."
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
          />
        </Row>
      </div>

      {/* Calculadora opcional del ultimo km en Venezuela */}
      <UltimoKmCalculator />

      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn btn-primary h-14 mt-3 disabled:opacity-60 disabled:cursor-wait"
      >
        {status === "submitting" ? "Calculando…" : "Cotizar ahora"}{" "}
        {status !== "submitting" && <ArrowIcon />}
      </button>

      {status === "error" && (
        <p className="text-[13.5px] text-wine">
          Algo falló. Inténtalo de nuevo o escríbenos por WhatsApp.
        </p>
      )}

      <p className="text-[12.5px] text-grey-500 leading-[1.5]">
        Al cotizar aceptás que un asesor te contacte por email o WhatsApp.
        No compartimos tus datos con terceros.
      </p>
    </form>
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
        type="number"
        name={name}
        min={1}
        required
        placeholder={placeholder}
        onClick={onTrigger}
        onFocus={onTrigger}
        className="h-12 px-2 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-semibold text-ink text-center"
      />
    </label>
  );
}
