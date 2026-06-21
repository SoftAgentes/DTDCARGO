"use client";

/**
 * Academia DTD · Diplomas (SDD-0093, Feature B). Lista los diplomas emitidos
 * (de la DB) a la izquierda; al elegir uno, muestra el diploma IMPRIMIBLE a la
 * derecha, escalado para caber en pantalla. "Imprimir" → window.print(); el
 * @media print oculta el cromo del Studio (`[data-print-hide]`) + esta lista, y
 * deja SOLO el diploma a tamaño real (A4 landscape), con los tokens re-anclados
 * a su valor light canónico (no sangra el dark mode al papel).
 */

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  DIPLOMA_VARIANTS,
  pickDiplomaVariant,
  type AcademyDiploma,
  type DiplomaVariant,
} from "@/lib/studio/academia/types";
import { DiplomaPrint, type DiplomaData } from "./DiplomaPrint";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
function fmtShort(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MESES[(m - 1) % 12]} ${y}`;
}

function toData(d: AcademyDiploma): DiplomaData {
  return {
    folio: d.folio,
    studentName: d.student_name,
    courseTitle: d.course_title,
    hours: d.hours,
    place: d.place,
    issuedAt: d.issued_at,
  };
}

export function DiplomasClient({
  diplomas,
  qrByFolio,
}: {
  diplomas: AcademyDiploma[];
  qrByFolio: Record<string, string>;
  verifyUrl: string;
}) {
  const [selectedFolio, setSelectedFolio] = useState<string | null>(
    diplomas[0]?.folio ?? null,
  );
  // Override manual de variante (preview); null = la estable por folio.
  const [variantOverride, setVariantOverride] = useState<DiplomaVariant | null>(null);

  const selected =
    diplomas.find((d) => d.folio === selectedFolio) ?? diplomas[0] ?? null;

  if (diplomas.length === 0) {
    return (
      <div style={{ maxWidth: 1280 }}>
        <Header />
        <EmptyState
          eyebrow="Sin diplomas"
          title="Todavía no hay diplomas emitidos."
          description="Los diplomas se emiten desde una cohorte (a quien apruebe con ≥ 75% de asistencia). Cuando emitas el primero, aparecerá acá listo para imprimir."
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280 }}>
      <Header />

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
        {/* Lista */}
        <div
          data-print-hide
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {diplomas.map((d) => {
            const active = selected?.folio === d.folio;
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={active}
                aria-label={`Ver diploma de ${d.student_name}, folio ${d.folio}`}
                onClick={() => {
                  setSelectedFolio(d.folio);
                  setVariantOverride(null);
                }}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: "var(--r-lg)",
                  background: "var(--bg-surface)",
                  border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                  cursor: "pointer",
                  transition: "border-color var(--dur-fast) var(--ease)",
                }}
              >
                <div
                  style={{
                    font: "700 12.5px/1.3 var(--f-sans)",
                    color: active ? "var(--wine)" : "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.student_name}
                </div>
                <div
                  style={{
                    font: "500 11px/1.4 var(--f-sans)",
                    color: "var(--ink-mute)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginTop: 2,
                  }}
                >
                  {d.course_title}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 6,
                  }}
                >
                  <code style={{ font: "600 10.5px/1 var(--f-mono)", color: "var(--wine)" }}>
                    {d.folio}
                  </code>
                  <span style={{ font: "500 10px/1 var(--f-mono)", color: "var(--ink-mute)" }}>
                    {fmtShort(d.issued_at)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview + print */}
        {selected && (
          <DiplomaStage
            diploma={selected}
            qrSvg={qrByFolio[selected.folio] ?? ""}
            variantOverride={variantOverride}
            onVariant={setVariantOverride}
          />
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div data-print-hide style={{ marginBottom: 20 }}>
      <span className="studio-eyebrow" style={{ color: "var(--wine)" }}>
        Academia DTD
      </span>
      <h1
        className="studio-display"
        style={{ fontSize: 26, margin: "8px 0 8px", color: "var(--ink)" }}
      >
        Diplomas emitidos.
      </h1>
      <p
        style={{
          font: "400 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
          maxWidth: "64ch",
        }}
      >
        Elige un diploma para verlo e imprimirlo. Cada uno lleva su sello, folio y
        un código QR que verifica el certificado en dtdcargo.com/verificar.
      </p>
    </div>
  );
}

function DiplomaStage({
  diploma,
  qrSvg,
  variantOverride,
  onVariant,
}: {
  diploma: AcademyDiploma;
  qrSvg: string;
  variantOverride: DiplomaVariant | null;
  onVariant: (v: DiplomaVariant | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const effectiveVariant = variantOverride ?? pickDiplomaVariant(diploma.folio);

  // Ajusta la escala al ancho disponible (canvas real = 1123px).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      setScale(Math.min(1, w / 1123));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Toolbar */}
      <div
        data-print-hide
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              font: "600 11px/1 var(--f-sans)",
              color: "var(--ink-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Diseño
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <VariantBtn
              label="Auto"
              active={variantOverride === null}
              onClick={() => onVariant(null)}
            />
            {DIPLOMA_VARIANTS.map((v) => (
              <VariantBtn
                key={v}
                label={v}
                active={variantOverride === v}
                onClick={() => onVariant(v)}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={() => window.print()}
        >
          Imprimir / PDF
        </button>
      </div>

      {/* Escenario escalado (pantalla) */}
      <div
        ref={wrapRef}
        data-print-hide
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 16,
          overflow: "hidden",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 1123 * scale, height: 794 * scale }}>
          <div
            style={{
              width: 1123,
              height: 794,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <DiplomaPrint
              data={toData(diploma)}
              qrSvg={qrSvg}
              variant={effectiveVariant}
            />
          </div>
        </div>
      </div>

      {/* Capa de impresión: tamaño real, oculta en pantalla, visible al imprimir */}
      <div id="diploma-print-area" className="dpl-print-only">
        <DiplomaPrint
          data={toData(diploma)}
          qrSvg={qrSvg}
          variant={effectiveVariant}
        />
      </div>

      <style>{`
        .dpl-print-only { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          [data-print-hide] { display: none !important; }
          body * { visibility: hidden !important; }
          #diploma-print-area, #diploma-print-area * { visibility: visible !important; }
          .dpl-print-only { display: block !important; }
          #diploma-print-area {
            --ink: #0F1E3D;
            --ink-soft: #6B6B6B;
            --ink-mute: #9B9B9B;
            --wine: #7F0F1A;
            --wine-soft: #C2747F;
            --border: #E8E6E2;
            --bg-base: #FBFAF7;
            --bg-surface: #FFFFFF;
            --bg-sidebar: #0F1E3D;
            position: absolute;
            left: 0;
            top: 0;
          }
          #diploma-print-area .dpl {
            box-shadow: none !important;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

function VariantBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 34,
        padding: "6px 10px",
        borderRadius: "var(--r-sm)",
        border: `1px solid ${active ? "var(--ink)" : "var(--border)"}`,
        background: active ? "var(--ink)" : "var(--bg-surface)",
        color: active ? "var(--bg-surface)" : "var(--ink-soft)",
        font: "700 11px/1 var(--f-sans)",
        cursor: "pointer",
        transition: "all var(--dur-fast) var(--ease)",
      }}
    >
      {label}
    </button>
  );
}
