/**
 * WorkflowsSection — sección "Workflows custom" del admin (SDD-0129).
 *
 * El motor de flujo YA existe (SDD-0091, N8N-lite): vive como editor de flujo
 * dentro del módulo Servicios (`servicios/_components/WorkflowEditor.tsx`,
 * tab "Flujo"). En vez de duplicar un segundo motor, esta sección apunta ahí y
 * deja claro qué queda pendiente a nivel tenant-wide.
 *
 * Server-safe (sin hooks).
 */

import Link from "next/link";

export function WorkflowsSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--wine)",
          borderRadius: "var(--r-lg)",
          padding: "22px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="studio-display" style={{ fontSize: 16, color: "var(--ink)", letterSpacing: "-0.01em", marginBottom: 6 }}>
            El motor de flujo ya existe
          </div>
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "64ch" }}>
            La automatización por reglas (N8N-lite) vive en el módulo <strong style={{ color: "var(--ink)" }}>Servicios</strong>,
            pestaña <strong style={{ color: "var(--ink)" }}>Flujo</strong> (SDD-0091). Ahí se arman los pasos, condiciones y
            disparadores por servicio.
          </p>
        </div>
        <Link href="/studio/servicios" className="studio-btn studio-btn-primary studio-btn-sm">
          Abrir Servicios · Flujo →
        </Link>
      </section>

      <section
        style={{
          background: "var(--bg-surface)",
          border: "2px dashed var(--border-strong)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-5) var(--s-6)",
        }}
      >
        <div style={{ font: "700 10px/1 var(--f-sans)", color: "var(--wine-text)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>
          Workflows tenant-wide · por implementar
        </div>
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "64ch" }}>
          Reglas globales del tenant (cron, eventos cross-módulo, triggers que disparan agents/mailing/alertas) son un
          nivel por encima del flujo por servicio. Cuando se modelen, esta sección las administra. Hoy, todo lo de
          automatización operativa se hace en Servicios · Flujo.
        </p>
      </section>
    </div>
  );
}
