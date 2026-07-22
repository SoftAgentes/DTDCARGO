import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import "./baja.css";

export const metadata: Metadata = {
  title: "Preferencias de correo",
  description: "Confirmación de tus preferencias de correo de DTD Cargo.",
  robots: { index: false, follow: false },
};

type ViewState = "actualidad" | "marketing" | "invalido" | "error";

type ViewCopy = {
  tone: "success" | "warning";
  eyebrow: string;
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
};

const VIEWS: Record<ViewState, ViewCopy> = {
  actualidad: {
    tone: "success",
    eyebrow: "Preferencias guardadas",
    title: "Listo, dejaste de recibir Actualidad",
    body: "Ya no recibirás nuestras guías y noticias. Los avisos importantes sobre tus envíos y facturas seguirán llegando normalmente.",
    primary: { href: "/noticias", label: "Volver a Actualidad" },
    secondary: { href: "/noticias#newsletter", label: "Suscribirte nuevamente" },
  },
  marketing: {
    tone: "success",
    eyebrow: "Preferencias guardadas",
    title: "Listo, dejaste de recibir correos de marketing",
    body: "Ya no recibirás promociones de DTD Cargo. Los avisos importantes sobre tus envíos y facturas seguirán llegando normalmente.",
    primary: { href: "/", label: "Volver al inicio" },
  },
  invalido: {
    tone: "warning",
    eyebrow: "No pudimos confirmar el enlace",
    title: "Este enlace de baja no es válido",
    body: "Puede estar incompleto o pertenecer a un correo anterior. Puedes gestionar tu suscripción desde Actualidad o escribirnos si necesitas ayuda.",
    primary: { href: "/noticias#newsletter", label: "Ir a Actualidad" },
    secondary: { href: "/contacto", label: "Contactar a DTD Cargo" },
  },
  error: {
    tone: "warning",
    eyebrow: "No se guardaron los cambios",
    title: "No pudimos procesar la baja ahora",
    body: "Tu preferencia no fue modificada. Intenta nuevamente desde el enlace del correo o contáctanos para ayudarte.",
    primary: { href: "/contacto", label: "Contactar a DTD Cargo" },
    secondary: { href: "/noticias", label: "Volver a Actualidad" },
  },
};

function resolveState(value: string | string[] | undefined): ViewState {
  const state = Array.isArray(value) ? value[0] : value;
  return state && state in VIEWS ? state as ViewState : "invalido";
}

export default async function EmailUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string | string[] }>;
}) {
  const params = await searchParams;
  const view = VIEWS[resolveState(params.estado)];

  return (
    <main className="rp-surface email-baja-surface">
      <div className="email-baja-shell">
        <header className="email-baja-brand">
          <span className="email-baja-brand-light">
            <BrandMark asLink size={42} />
          </span>
          <span className="email-baja-brand-dark">
            <BrandMark asLink size={42} variant="reverse" />
          </span>
        </header>

        <section className="email-baja-panel" aria-labelledby="email-baja-title">
          <div className={`email-baja-symbol email-baja-symbol--${view.tone}`} aria-hidden="true">
            {view.tone === "success" ? <CheckIcon /> : <InfoIcon />}
          </div>
          <p className="email-baja-eyebrow">{view.eyebrow}</p>
          <h1 id="email-baja-title">{view.title}</h1>
          <p className="email-baja-copy">{view.body}</p>

          <div className="email-baja-actions">
            <Link className="btn btn-primary" href={view.primary.href}>
              {view.primary.label}
            </Link>
            {view.secondary ? (
              <Link className="email-baja-secondary" href={view.secondary.href}>
                {view.secondary.label}
              </Link>
            ) : null}
          </div>
        </section>

        <footer className="email-baja-footer">
          <span>DTD Cargo</span>
          <span aria-hidden="true">·</span>
          <span>Puerta a puerta China → Venezuela</span>
        </footer>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
