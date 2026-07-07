"use client";

/**
 * ImportRatesDrawer — importador masivo de tarifas (Fase 3 Slice C, SDD-0055).
 *
 * Pega un CSV de tarifas en el textarea → "Validar" muestra una preview por
 * fila (válidas / inválidas / duplicadas) → "Importar como borrador" inserta
 * las válidas como `status=draft` (NO van live; se revisan y publican aparte).
 * Dedup por (service, origin, destination) dentro del CSV y contra la DB.
 */

import { useState, useTransition } from "react";
import {
  importRatesAction,
  previewRatesImportAction,
  type RateImportResult,
} from "../actions";
import type { RateImportPreview } from "@/lib/studio/rate-import";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

const CSV_PLACEHOLDER = `service,origin,destination,per_cbm,flat_rate,min_charge,transit_days,valid_from,valid_until,notes
consolidacion,Yiwu,Valencia,800,,380,38,2026-01-01,2026-12-31,Tarifa Q1
reserva_FCL,Shenzhen,La Guaira,,8500,,40,,,Contrato naviero`;

export function ImportRatesDrawer({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<RateImportPreview | null>(null);
  const [result, setResult] = useState<RateImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, startValidate] = useTransition();

  const handleValidate = () => {
    setError(null);
    setResult(null);
    startValidate(async () => {
      const p = await previewRatesImportAction(csv);
      setPreview(p);
      if (p.error) setError(p.error);
    });
  };

  const canImport =
    !!preview && !preview.error && preview.validCount > 0 && !result?.ok;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 98vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <h2
            id="import-drawer-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            Importar tarifas
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Formato esperado */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <p
              style={{
                font: "400 12.5px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
              }}
            >
              Pega un CSV con encabezado. Columnas:{" "}
              <code style={{ font: "500 11.5px/1 var(--f-mono)", color: "var(--ink)" }}>
                service, origin, destination, per_cbm, flat_rate, min_charge,
                transit_days, valid_from, valid_until, notes
              </code>
              . <code style={{ font: "500 11.5px/1 var(--f-mono)" }}>service</code> ∈{" "}
              consolidacion · puerta_a_puerta_DDP · reserva_FCL ·
              transporte_terrestre. Indica per_cbm o flat_rate. Las filas se
              importan como <strong style={{ color: "var(--ink)" }}>borrador</strong>{" "}
              (no van live). Dedup por servicio + origen + destino.
            </p>
          </div>

          <div>
            <label className="studio-label" htmlFor="csv">
              CSV de tarifas
            </label>
            <textarea
              id="csv"
              className="studio-input"
              rows={10}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
                setResult(null);
                setError(null);
              }}
              placeholder={CSV_PLACEHOLDER}
              style={{
                resize: "vertical",
                font: "400 12.5px/1.5 var(--f-mono)",
              }}
            />
          </div>

          {/* Botón validar */}
          <div>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={handleValidate}
              disabled={isValidating || csv.trim() === ""}
            >
              {isValidating ? "Validando…" : "Validar"}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: 0,
                padding: "10px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {error}
            </p>
          )}

          {/* Resumen de la importación */}
          {result?.ok && (
            <p
              style={{
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--success)",
                margin: 0,
                padding: "10px 12px",
                background: "var(--success-bg)",
                border: "1px solid var(--success)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {result.inserted ?? 0} tarifa(s) importada(s) como borrador.
              {result.skippedExisting
                ? ` ${result.skippedExisting} ya existía(n) y se saltaron.`
                : ""}
            </p>
          )}

          {/* Preview por fila */}
          {preview && !preview.error && (
            <div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginBottom: 10,
                  font: "600 12px/1 var(--f-sans)",
                }}
              >
                <span style={{ color: "var(--success)" }}>
                  {preview.validCount} válida(s)
                </span>
                <span style={{ color: "var(--danger)" }}>
                  {preview.invalidCount} inválida(s)
                </span>
                {preview.duplicateCount > 0 && (
                  <span style={{ color: "var(--ink-soft)" }}>
                    {preview.duplicateCount} duplicada(s) en el CSV
                  </span>
                )}
              </div>

              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  overflow: "hidden",
                }}
              >
                {preview.rows.map((r) => (
                  <div
                    key={r.line}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "8px 12px",
                      borderTop: r.line > 1 ? "1px solid var(--border)" : 0,
                      alignItems: "flex-start",
                      background: r.input
                        ? "transparent"
                        : "var(--danger-bg)",
                    }}
                  >
                    <span
                      style={{
                        font: "600 11px/1.4 var(--f-mono)",
                        color: "var(--ink-soft)",
                        flexShrink: 0,
                        width: 24,
                      }}
                    >
                      {r.line}
                    </span>
                    <span
                      style={{
                        font: "400 11.5px/1.4 var(--f-mono)",
                        color: r.input ? "var(--ink)" : "var(--danger)",
                        flex: 1,
                        wordBreak: "break-word",
                      }}
                    >
                      {r.input ? (
                        <>
                          {r.input.service} · {r.input.origin} →{" "}
                          {r.input.destination} ·{" "}
                          {r.input.per_cbm != null
                            ? `$${r.input.per_cbm}/CBM`
                            : `$${r.input.flat_rate}/ctr`}
                        </>
                      ) : (
                        <>
                          {r.raw}
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 2,
                              color: "var(--danger)",
                            }}
                          >
                            {Icon.warn(12)} {r.error}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
          >
            {result?.ok ? "Cerrar" : "Cancelar"}
          </button>
          <ActionButton
            variant="primary"
            size="default"
            idleLabel={
              preview && preview.validCount > 0
                ? `Importar ${preview.validCount} como borrador`
                : "Importar como borrador"
            }
            loadingLabel="Importando…"
            successLabel="Importadas"
            idleIcon={Icon.upload(14)}
            successIcon={Icon.check(14)}
            disabled={!canImport}
            onAction={async () => {
              const r = await importRatesAction(csv);
              setResult(r);
              setPreview(r.preview ?? preview);
              if (r.error) return { error: r.error };
              toast.success(
                `${r.inserted ?? 0} tarifa(s) importada(s) como borrador`,
              );
            }}
            onError={setError}
          />
        </footer>
      </aside>
    </div>
  );
}
