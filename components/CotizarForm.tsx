"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ORIGINS, DESTINATIONS, CONTACT } from "@/lib/design-tokens";
import { ArrowIcon } from "./Icon";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Formulario completo de cotización. En MVP usa un mock que simula la respuesta
 * — cuando el ERP exponga `POST {ERP}/api/public/cotizar` y `POST /leads`,
 * cambiamos `mockSubmit` por `fetch(...)`.
 */
export function CotizarForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [estimate, setEstimate] = useState<{
    low: number;
    high: number;
    days: string;
    leadId: string;
  } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      // MOCK: simulamos llamada al ERP. Reemplazar cuando los endpoints estén listos.
      await new Promise((r) => setTimeout(r, 900));
      const peso = Number(payload.peso ?? 0);
      const volumen = Number(payload.volumen ?? 0);
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

      <div className="grid grid-cols-2 gap-4">
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
        <Row label="Volumen (m³)">
          <input
            type="number"
            name="volumen"
            min={0}
            step="0.01"
            required
            placeholder="0.5"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] font-medium text-ink"
          />
        </Row>
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
