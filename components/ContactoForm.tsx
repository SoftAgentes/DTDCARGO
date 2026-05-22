"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowIcon } from "./Icon";
import { CONTACT } from "@/lib/design-tokens";

type Status = "idle" | "submitting" | "success" | "error";

const TOPICS = [
  { v: "cotizar", l: "Cotizar un envío" },
  { v: "agente", l: "Agente de compra" },
  { v: "inspeccion", l: "Inspección de fábrica" },
  { v: "marca", l: "Registro de marca" },
  { v: "visa", l: "Visa de negocios" },
  { v: "otro", l: "Otro" },
];

/**
 * Formulario de contacto general. MOCK actualmente.
 * Cuando el ERP exponga `POST {ERP}/api/public/leads`, reemplazar mockSubmit por fetch.
 */
export function ContactoForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [leadId, setLeadId] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    try {
      await new Promise((r) => setTimeout(r, 700));
      setLeadId(`DTD-${Date.now().toString(36).toUpperCase().slice(-6)}`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10">
        <div className="eyebrow" style={{ color: "var(--color-wine)" }}>
          ✓ Mensaje enviado
        </div>
        <h3
          className="mt-4 text-[32px] leading-[1.05] tracking-[-0.02em] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          Te respondemos<br />en menos de 24 hs.
        </h3>
        <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.55]">
          Tu mensaje quedó registrado con el código{" "}
          <strong className="text-ink">{leadId}</strong>. Un asesor humano se
          comunicará por email o WhatsApp para continuar.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(
              `Hola, ya escribí por el formulario. Mi código es ${leadId}.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Adelantar por WhatsApp <ArrowIcon />
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
      className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 flex flex-col gap-5 self-start"
    >
      <h2
        className="text-[26px] leading-[1.05] tracking-[-0.02em] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        Escríbenos
      </h2>

      <Field label="¿Sobre qué tema?">
        <select
          name="topic"
          required
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
        >
          {TOPICS.map((t) => (
            <option key={t.v} value={t.v}>
              {t.l}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tu nombre">
        <input
          name="nombre"
          required
          placeholder="Nombre y apellido"
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Email">
          <input
            type="email"
            name="email"
            required
            placeholder="tu@email.com"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
          />
        </Field>
        <Field label="WhatsApp">
          <input
            type="tel"
            name="whatsapp"
            placeholder="+58 412 ..."
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink"
          />
        </Field>
      </div>

      <Field label="Mensaje">
        <textarea
          name="mensaje"
          required
          rows={4}
          placeholder="Cuéntanos qué necesitas. Si es un envío, pega el link del producto o describe volumen y peso."
          className="px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none"
        />
      </Field>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn btn-primary h-14 mt-2 disabled:opacity-60 disabled:cursor-wait"
      >
        {status === "submitting" ? "Enviando…" : "Enviar mensaje"}{" "}
        {status !== "submitting" && <ArrowIcon />}
      </button>

      {status === "error" && (
        <p className="text-[13.5px] text-wine">
          Falló el envío. Intenta de nuevo o escríbenos por WhatsApp.
        </p>
      )}

      <p className="text-[12.5px] text-grey-500 leading-[1.5]">
        Al enviar aceptás que un asesor te contacte por email o WhatsApp.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11.5px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        {label}
      </span>
      {children}
    </label>
  );
}
