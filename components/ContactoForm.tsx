"use client";

import type { FormEvent } from "react";
import { WhatsAppIcon } from "./Icon";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { trackLead } from "@/components/Analytics";

/**
 * Formulario de /contacto — envío por WhatsApp, y SOLO por WhatsApp.
 *
 * Decisión del founder (2026-07-20, mockup Cloud Design "Contáctenos ·
 * DTD-Cargo.html" variante C): la página ya NO postea a `/api/contact`. El
 * botón arma el mensaje con lo que el visitante escribió y abre WhatsApp con
 * el texto listo — un canal único, sin correo intermedio que se pierda.
 *
 * Consecuencias esperadas: sin backend desaparecen el honeypot y el límite
 * por IP de esta página (no hay endpoint que proteger). `/api/contact` queda
 * en el repo marcado como DEPRECADO por si se revierte la decisión.
 *
 * El número sale de `CONTACT` vía `buildWhatsAppLink` — nunca hardcodeado.
 * Marcado y clases (`cx-form`, `cx-field`, `cx-submit`…) son los del CSS real
 * del handoff; los estilos viven en `app/globals.css` bajo `.cx-surface`.
 */

const MOTIVOS = [
  "Cotizar un envío nuevo",
  "Rastrear mi carga",
  "Reclamo o siniestro",
  "Otra consulta",
] as const;

export function ContactoForm() {
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nombre = String(fd.get("nombre") ?? "").trim();
    const mark = String(fd.get("mark") ?? "").trim();
    const motivo = String(fd.get("motivo") ?? "");
    const mensaje = String(fd.get("mensaje") ?? "").trim();

    // Mismo armado que el mockup: una sola línea legible en el chat.
    const texto =
      `Hola, soy ${nombre}. Motivo: ${motivo}.` +
      (mark ? ` Mi Shipping Mark: ${mark}.` : "") +
      ` ${mensaje}`;

    // GA4 `generate_lead`: el visitante completó el formulario y salió al chat.
    trackLead("contacto");
    window.open(buildWhatsAppLink(texto), "_blank", "noopener");
  }

  return (
    <form className="cx-form" onSubmit={onSubmit}>
      <div className="cx-form-row">
        <div className="cx-field">
          <label htmlFor="cxNombre">Nombre</label>
          <input
            id="cxNombre"
            name="nombre"
            type="text"
            autoComplete="name"
            placeholder="Tu nombre"
            required
          />
        </div>
        <div className="cx-field">
          <label htmlFor="cxMark">
            Shipping Mark <span className="opt">(si ya tienes)</span>
          </label>
          <input id="cxMark" name="mark" type="text" placeholder="DTD-XXXX" />
        </div>
      </div>

      <div className="cx-field">
        <label htmlFor="cxMotivo">Motivo</label>
        <select id="cxMotivo" name="motivo" defaultValue={MOTIVOS[0]}>
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="cx-field">
        <label htmlFor="cxMensaje">Mensaje</label>
        <textarea
          id="cxMensaje"
          name="mensaje"
          placeholder="Cuéntanos qué necesitas…"
          required
        />
      </div>

      <button type="submit" className="cx-submit">
        <WhatsAppIcon size={19} />
        Enviar por WhatsApp
      </button>
      <p className="cx-form-note">
        Se abre WhatsApp con tu mensaje ya escrito — solo confirmas el envío.
      </p>
    </form>
  );
}
