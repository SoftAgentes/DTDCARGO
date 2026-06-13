"use client";

import { useState, type FormEvent } from "react";
import { ArrowIcon, WhatsAppIcon } from "./Icon";
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

type LeadData = {
  topic: string;
  topicLabel: string;
  nombre: string;
  email: string;
  whatsapp: string;
  mensaje: string;
};

/**
 * Formulario de contacto general. Actualmente MOCK — el `onSubmit` solo
 * captura los datos para que el botón "Adelantar por WhatsApp" pueda
 * pre-armar un mensaje estructurado con toda la info del cliente.
 *
 * Próximo paso (NIVEL B): conectar a Resend para envío real por email.
 * Cuando ese endpoint exista (`/api/contact`), reemplazar el setTimeout
 * por un fetch a esa ruta.
 */
export function ContactoForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadData, setLeadData] = useState<LeadData | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");

    // Capturar datos del form ANTES del envío para usarlos en el WhatsApp prearmado
    const fd = new FormData(e.currentTarget);
    const topic = String(fd.get("topic") ?? "");
    const captured: LeadData = {
      topic,
      topicLabel: TOPICS.find((t) => t.v === topic)?.l ?? topic,
      nombre: String(fd.get("nombre") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      whatsapp: String(fd.get("whatsapp") ?? "").trim(),
      mensaje: String(fd.get("mensaje") ?? "").trim(),
    };

    try {
      // MOCK — sustituir por fetch('/api/contact', { method: 'POST', body: JSON.stringify(captured) })
      // cuando Resend esté configurado.
      await new Promise((r) => setTimeout(r, 700));
      setLeadData(captured);
      setLeadId(`DTD-${Date.now().toString(36).toUpperCase().slice(-6)}`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success" && leadData) {
    // Mensaje WhatsApp estructurado para que tu CRM pueda parsearlo fácil.
    // Formato: bullets con `• campo: valor` + un bloque de "Mensaje:" al final.
    const lines = [
      "Hola DTD Cargo, vengo del formulario web.",
      "",
      `• Código: ${leadId}`,
      `• Tema: ${leadData.topicLabel}`,
      `• Nombre: ${leadData.nombre}`,
      `• Email: ${leadData.email}`,
    ];
    if (leadData.whatsapp) lines.push(`• WhatsApp: ${leadData.whatsapp}`);
    lines.push("", "Mensaje:", leadData.mensaje);
    const whatsappText = lines.join("\n");
    const whatsappUrl = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(whatsappText)}`;

    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-8 lg:p-10">
        <div className="eyebrow" style={{ color: "var(--color-wine)" }}>
          Casi listo
        </div>
        <h3
          className="mt-4 text-[32px] leading-[1.05] tracking-[-0.02em] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          Un toque más<br />y listo.
        </h3>
        <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.55]">
          Toca el botón de abajo para enviarnos tu consulta por WhatsApp — ya va
          con todos tus datos cargados.
        </p>

        {/* CTA WhatsApp — único botón, prominente, mensaje pre-armado con todos los datos */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn mt-6 inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-whatsapp text-white"
        >
          <WhatsAppIcon size={20} />
          Enviar por WhatsApp
        </a>
        <p className="text-[12px] text-grey-500 mt-3 leading-[1.5]">
          Te responde un asesor humano, no un bot — normalmente en menos de 24
          horas.
        </p>
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
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus:ring-2 focus:ring-wine/40"
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
          className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus:ring-2 focus:ring-wine/40"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Email">
          <input
            type="email"
            name="email"
            required
            placeholder="tu@email.com"
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus:ring-2 focus:ring-wine/40"
          />
        </Field>
        <Field label="WhatsApp">
          <input
            type="tel"
            name="whatsapp"
            placeholder="+58 412 ..."
            className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus:ring-2 focus:ring-wine/40"
          />
        </Field>
      </div>

      <Field label="Mensaje">
        <textarea
          name="mensaje"
          required
          rows={4}
          placeholder="Cuéntanos qué necesitas. Si es un envío, pega el link del producto o describe volumen y peso."
          className="px-3.5 py-2.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink resize-none focus:ring-2 focus:ring-wine/40"
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
        Al enviar aceptas que un asesor te contacte por email o WhatsApp.
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
