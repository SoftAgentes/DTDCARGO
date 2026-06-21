"use client";

/**
 * Captación de lead de la Academia (SDD-0093, Fase 3). Reusa el backend de
 * /api/contact (notifica al equipo + confirma al cliente + throttle) con
 * topic="academia" — el form solo hace `fetch` (no import del ERP → respeta la
 * frontera pública↔ERP). Fallback a WhatsApp pase lo que pase (nunca pierde al
 * lead que sí escribe).
 */

import { useState, type FormEvent } from "react";
import { buildWhatsAppLink } from "@/lib/design-tokens";

type Status = "idle" | "sending" | "ok" | "error";

const INPUT =
  "w-full h-12 px-4 rounded-[10px] border border-grey-200 bg-white text-[15px] text-ink placeholder:text-grey-500/60 outline-none focus:border-wine focus-visible:ring-2 focus-visible:ring-wine-soft transition-colors";

export function AcademiaLeadForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      topic: "academia",
      nombre: String(data.get("nombre") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      whatsapp: String(data.get("whatsapp") ?? "").trim(),
      mensaje: String(data.get("mensaje") ?? "").trim() || "Quiero info de la Academia DTD.",
      empresa_web: String(data.get("empresa_web") ?? ""), // honeypot
    };
    if (!payload.nombre || !payload.email || !payload.whatsapp) {
      setError("Completa tu nombre, WhatsApp y email.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "No pudimos registrar tus datos.");
      }
      setStatus("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 text-center">
        <h3
          className="text-[24px] leading-[1.15] tracking-[-0.01em] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          Listo, te avisamos.
        </h3>
        <p className="text-[14.5px] text-grey-500 mt-3 leading-[1.55]">
          Recibimos tus datos. Cuando abramos los cupos te escribimos — y si quieres
          adelantar, un asesor te atiende ahora por WhatsApp.
        </p>
        <a
          href={buildWhatsAppLink("Hola DTD Cargo, me anoté en la Academia y quiero más info.")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mt-5 inline-flex"
        >
          Hablar por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] p-7 lg:p-9 flex flex-col gap-4"
      noValidate
    >
      <div>
        <span className="eyebrow">Anótate</span>
        <h3
          className="mt-3 text-[24px] lg:text-[28px] leading-[1.1] tracking-[-0.01em] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)" }}
        >
          Reserva tu cupo
        </h3>
        <p className="text-[14px] text-grey-500 mt-2 leading-[1.5]">
          Déjanos tus datos y te avisamos cuando abran los cursos. Sin compromiso.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">Nombre</span>
        <input name="nombre" type="text" autoComplete="name" required className={INPUT} placeholder="Tu nombre" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">WhatsApp</span>
        <input name="whatsapp" type="tel" autoComplete="tel" required className={INPUT} placeholder="+58 412 000 0000" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">Email</span>
        <input name="email" type="email" autoComplete="email" required className={INPUT} placeholder="tucorreo@ejemplo.com" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">
          ¿Qué quieres aprender? <span className="font-normal text-grey-500">(opcional)</span>
        </span>
        <textarea
          name="mensaje"
          rows={3}
          className={`${INPUT} h-auto py-3 resize-y`}
          placeholder="Ej.: quiero importar para mi tienda y no sé por dónde empezar."
        />
      </label>

      {/* Honeypot anti-bot — oculto a humanos, lo revisa /api/contact */}
      <input
        type="text"
        name="empresa_web"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {status === "error" && error ? (
        <p role="alert" className="text-[13.5px] text-wine">
          {error}{" "}
          <a
            href={buildWhatsAppLink("Hola DTD Cargo, quiero info de la Academia DTD.")}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
          >
            o escríbenos por WhatsApp →
          </a>
        </p>
      ) : null}

      <button type="submit" disabled={status === "sending"} className="btn btn-primary w-full disabled:opacity-60">
        {status === "sending" ? "Enviando…" : "Reservar mi cupo"}
      </button>
      <p className="text-[12px] text-grey-500 text-center leading-[1.5]">
        Te contactamos solo por esto. Nada de spam.
      </p>
    </form>
  );
}
