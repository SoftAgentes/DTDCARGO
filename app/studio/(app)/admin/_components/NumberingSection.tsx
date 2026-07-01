"use client";

/**
 * NumberingSection — sección "Numeración & legal" del admin (SDD-0122).
 *
 * 2 tarjetas:
 *   1. Formatos de numeración → READ-ONLY. Los correlativos son legales y fijos
 *      por diseño (viven en RPCs); solo Facturas/Estimados muestran el próximo
 *      en vivo. Editarlos = spec fiscal dedicada.
 *   2. Leyendas legales en facturas → editable (pie + T&C), guardado en tenants.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { updateLegalLegendsAction } from "../numbering-actions";
import type { NumberingActionState, NumberingOverview } from "@/lib/studio/numbering-types";

const INITIAL: NumberingActionState = {};

export function NumberingSection({ data }: { data: NumberingOverview }) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(updateLegalLegendsAction, INITIAL);

  const handled = useRef<NumberingActionState | null>(null);
  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      toast.success("Leyendas legales guardadas");
    }
  }, [state, toast]);

  const [footer, setFooter] = useState(data.legends.footer);
  const [terms, setTerms] = useState(data.legends.terms);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. Formatos (read-only) */}
      <Card>
        <CardEyebrow>Formatos de numeración</CardEyebrow>
        <p style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 14px", maxWidth: "72ch" }}>
          Los correlativos son legales y fijos por diseño (se generan en la base de datos). Esta vista es de
          solo lectura; cambiar un formato requiere una spec fiscal dedicada.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.formats.map((f) => (
            <div
              key={f.label}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1.2fr",
                gap: 14,
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{f.label}</div>
                <code style={{ font: "600 11px/1.4 var(--f-mono)", color: "var(--ink-mute)" }}>{f.source}</code>
              </div>
              <code style={{ font: "700 13px/1 var(--f-mono)", color: "var(--wine)" }}>{f.format}</code>
              <div style={{ justifySelf: "start" }}>
                {f.next ? (
                  <>
                    <div style={{ font: "600 9.5px/1 var(--f-sans)", color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                      Próximo
                    </div>
                    <code style={{ font: "800 13px/1 var(--f-mono)", color: "var(--ink)" }}>{f.next}</code>
                  </>
                ) : (
                  <Badge tone="neutral" size="sm">Fijo por diseño</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 2. Leyendas legales (editable) */}
      <Card>
        <CardEyebrow>Leyendas legales en facturas</CardEyebrow>
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="studio-label" htmlFor="nl-footer">Texto de pie de página</label>
            <textarea
              id="nl-footer"
              name="footer"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              className="studio-input"
              rows={3}
              placeholder="Razón social · RIF · Contribuyente especial · Resolución SENIAT … · Imprenta autorizada Nº …"
              style={{ marginTop: 6, resize: "vertical" }}
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="nl-terms">Términos y condiciones</label>
            <textarea
              id="nl-terms"
              name="terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="studio-input"
              rows={4}
              placeholder="Alcance del servicio, exclusiones, condiciones de pago…"
              style={{ marginTop: 6, resize: "vertical" }}
            />
          </div>

          {state?.error && (
            <div
              style={{
                padding: 12,
                background: "var(--danger-bg)",
                color: "var(--danger)",
                borderRadius: "var(--r-md)",
                font: "600 13px/1.3 var(--f-sans)",
              }}
            >
              {state.error}
            </div>
          )}

          <p style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: 0 }}>
            Estas leyendas se imprimirán en las facturas cuando el renderer de facturación las consuma.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="studio-btn studio-btn-primary" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Primitivas locales ────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
      }}
    >
      {children}
    </section>
  );
}

function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: 14 }}>
      {children}
    </div>
  );
}
