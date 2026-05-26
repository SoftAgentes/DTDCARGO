/**
 * /studio/documentos — Documentos (placeholder con wiring de "Generar BL").
 *
 * El módulo completo de Documentos (repo de BL/AWB/packing por embarque)
 * llega en un SDD futuro. Mientras tanto, el botón "Generar BL" del
 * SDD-0034 wiring abre el modal que crea el código mock.
 */

import { DocumentosClient } from "./_components/DocumentosClient";

export const metadata = { title: "Documentos · DTD Studio" };

export default function DocumentosPage() {
  return (
    <div style={{ maxWidth: 1100 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Finanzas · Documentos</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Documentos
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            BL, AWB, packing list, certificados — repositorio por envío.{" "}
            <span style={{ color: "var(--ink-mute)" }}>
              Módulo completo en SDD futuro. Mientras tanto, generá un Bill of
              Lading desde el botón de la derecha.
            </span>
          </p>
        </div>
        <DocumentosClient />
      </div>

      <div
        style={{
          padding: 60,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            font: "800 16px/1.2 var(--f-display)",
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          Repositorio completo · próximamente
        </div>
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "44ch",
            marginInline: "auto",
          }}
        >
          Por ahora podés generar un BL desde el botón de arriba. La biblioteca
          completa con AWB, packing list y certificados llega cuando se
          implemente el spec correspondiente.
        </p>
      </div>
    </div>
  );
}
