"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import { NEWSLETTER_HONEYPOT_FIELD } from "@/lib/newsletter/constants";
import { EditorialIcon } from "./EditorialIcon";

export function NewsletterCard({ compact = false }: { compact?: boolean }) {
  const uid = useId();
  const emailId = `${uid}-newsletter-email`;
  const consentId = `${uid}-newsletter-consent`;
  const statusId = `${uid}-newsletter-status`;
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState(
    "Tu correo queda guardado solo para Actualidad. No usamos WhatsApp para esta suscripción.",
  );

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("Registrando tu suscripción…");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consent,
          source: compact ? "noticias-articulo" : "noticias",
          [NEWSLETTER_HONEYPOT_FIELD]: honeypot,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setStatus("error");
        setMessage(payload.error ?? "No pudimos registrar el correo. Intenta de nuevo.");
        return;
      }

      setStatus("ok");
      setMessage(
        payload.message ??
          "Listo. Registramos tu correo para Actualidad de DTD Cargo.",
      );
      setEmail("");
      setConsent(false);
      setHoneypot("");
    } catch {
      setStatus("error");
      setMessage("No pudimos registrar el correo. Intenta de nuevo.");
    }
  }

  return (
    <aside
      className={`actual-newsletter ${compact ? "actual-newsletter--compact" : ""}`}
      aria-labelledby={compact ? "newsletter-article-title" : "newsletter-title"}
    >
      <EditorialIcon name="mail" />
      <h2 id={compact ? "newsletter-article-title" : "newsletter-title"}>
        Recibe solo las noticias que cambian tu operación.
      </h2>
      <p>Máximo dos correos al mes. Puedes darte de baja cuando quieras.</p>
      <form aria-describedby={statusId} onSubmit={subscribe}>
        <label className="sr-only" htmlFor={emailId}>
          Correo electrónico
        </label>
        <input
          id={emailId}
          type="email"
          placeholder="tu@empresa.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "loading"}
          required
        />
        <label className="sr-only" htmlFor={`${uid}-empresa-web`}>
          Empresa
        </label>
        <input
          id={`${uid}-empresa-web`}
          className="actual-newsletter-hp"
          name={NEWSLETTER_HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Registrando…" : "Suscribirme por email"}
        </button>
        <label className="actual-consent" htmlFor={consentId}>
          <input
            id={consentId}
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            disabled={status === "loading"}
            required
          />
          <span>
            Acepto recibir comunicaciones por email y la{" "}
            <Link href="/privacidad">Política de Privacidad</Link>.
          </span>
        </label>
      </form>
      <p
        id={statusId}
        className={`actual-newsletter-status actual-newsletter-status--${status}`}
        role={status === "error" ? "alert" : "status"}
      >
        {message}
      </p>
    </aside>
  );
}
