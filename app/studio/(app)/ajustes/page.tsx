/**
 * Ajustes del Studio.
 *
 * MVP-0: placeholder. La configuración real del tenant vive en
 * `/studio/admin` (datos de la empresa, feature flags, notificaciones,
 * alertas de Telegram, agentes, rutas…). Esta ruta no está enlazada desde
 * ningún lado y se mantiene sólo para no romper un link viejo.
 *
 * Refactor visual: eyebrow con guión wine-soft + H1 30px + spacing rítmico 8/12/32.
 */

import Link from "next/link";

export const metadata = {
  title: "Ajustes",
};

export default function AjustesPage() {
  return (
    <div style={{ maxWidth: 800 }}>
      <span className="studio-eyebrow">Configuración</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 32px", color: "var(--ink)" }}
      >
        Ajustes.
      </h1>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 28,
        }}
      >
        <p
          style={{
            font: "400 14px/1.6 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 12px",
          }}
        >
          La configuración del tenant vive en Administración: datos de la empresa,
          casos de uso ON/OFF, notificaciones al cliente, alertas de Telegram,
          tasas de cambio y más.
        </p>
        <Link
          href="/studio/admin"
          style={{
            font: "600 14px/1.4 var(--f-sans)",
            color: "var(--wine-text)",
            textDecoration: "underline",
          }}
        >
          Ir a Administración &rarr;
        </Link>
      </div>
    </div>
  );
}
