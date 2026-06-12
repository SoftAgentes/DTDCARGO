"use client";

/**
 * /m — Launcher del operario (selector de operación).
 *
 * start_url del TWA/APK. Un solo APK sirve a todos los operarios: acá
 * eligen su frente (Almacén China o Despacho Venezuela) y caen en el login
 * por PIN correspondiente. Sin estado: dos links.
 *
 * data-theme="dark" sobre el root (override del m-root light del layout) para
 * el hero navy usando tokens — sin rgba(255,…) inline (regla de app/m).
 */

import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";

export default function OperarioLauncherPage() {
  return (
    <div
      data-theme="dark"
      style={{
        minHeight: "100dvh",
        background:
          "linear-gradient(160deg, var(--bg-base) 0%, var(--bg-elevated) 100%)",
        color: "var(--ink)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {/* Inner · cap a 480 como las pantallas hermanas in-app (tablet/foldable) */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          padding:
            "calc(env(safe-area-inset-top) + 32px) 24px calc(env(safe-area-inset-bottom) + 24px)",
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 6,
            font: "900 18px/1 var(--f-display)",
            letterSpacing: "-0.01em",
          }}
        >
          <span>DTD</span>
          <span style={{ color: "var(--wine-soft)" }}>OPERARIO</span>
        </div>

        {/* Centro */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "var(--s-6)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                font: "700 11px/1 var(--f-sans)",
                color: "var(--wine-soft)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              DTD·CARGO
            </div>
            <h1
              style={{
                font: "900 30px/1.05 var(--f-display)",
                margin: "12px 0 6px",
                letterSpacing: "-0.025em",
              }}
            >
              ¿Dónde trabajas?
            </h1>
            <p
              style={{
                font: "500 14px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
              }}
            >
              Elige tu operación para entrar
            </p>
          </div>

          {/* Opciones */}
          <nav
            aria-label="Elige tu operación"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <LauncherCard
              href="/m/cn"
              icon={Icon.warehouse(24)}
              title="Almacén · China"
              subtitle="Recepción de mercadería · 仓库"
            />
            <LauncherCard
              href="/m/ve/login"
              icon={Icon.truck(24)}
              title="Despacho · Venezuela"
              subtitle="Bodega y entregas en ruta"
            />
          </nav>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
          }}
        >
          DTD Cargo 2026
        </div>
      </div>
    </div>
  );
}

function LauncherCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: 18,
        minHeight: 76,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        color: "var(--ink)",
        textDecoration: "none",
        transition: "transform var(--dur-fast) var(--ease)",
        WebkitTapHighlightColor: "transparent",
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.transform = "scale(0.985)";
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onTouchCancel={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: "var(--r-sm)",
          background: "var(--wine)",
          // blanco puro sobre wine — no hay token equivalente (igual que el wordmark)
          color: "#FFFFFF",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            font: "800 17px/1.1 var(--f-display)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: "block",
            font: "500 12.5px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 3,
          }}
        >
          {subtitle}
        </span>
      </span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill="none"
        style={{ flexShrink: 0, color: "var(--ink-soft)" }}
      >
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
