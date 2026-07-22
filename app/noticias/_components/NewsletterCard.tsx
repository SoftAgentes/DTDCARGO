import Link from "next/link";
import { EditorialIcon } from "./EditorialIcon";

export function NewsletterCard({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`actual-newsletter ${compact ? "actual-newsletter--compact" : ""}`} aria-labelledby={compact ? "newsletter-article-title" : "newsletter-title"}>
      <EditorialIcon name="mail" />
      <h2 id={compact ? "newsletter-article-title" : "newsletter-title"}>
        Recibe solo las noticias que cambian tu operación.
      </h2>
      <p>Máximo dos correos al mes. Puedes darte de baja cuando quieras.</p>
      <form aria-describedby={compact ? "newsletter-article-status" : "newsletter-status"}>
        <label className="sr-only" htmlFor={compact ? "newsletter-email-article" : "newsletter-email"}>
          Correo electrónico
        </label>
        <input
          id={compact ? "newsletter-email-article" : "newsletter-email"}
          type="email"
          placeholder="tu@empresa.com"
          autoComplete="email"
          disabled
        />
        <button type="button" disabled>Suscripción próximamente</button>
        <label className="actual-consent">
          <input type="checkbox" disabled />
          <span>
            Acepto recibir comunicaciones por email y la{" "}
            <Link href="/privacidad">Política de Privacidad</Link>.
          </span>
        </label>
      </form>
      <p id={compact ? "newsletter-article-status" : "newsletter-status"} className="actual-newsletter-status">
        Activaremos el formulario cuando la suscripción y la baja estén verificadas de punta a punta.
      </p>
    </aside>
  );
}
