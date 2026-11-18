"use client";

/**
 * ReglasTab — la ficha de «Reglas» de nómina frente a la ley (SDD-0653).
 *
 * Muestra la versión vigente con su fecha, compara cada regla con la ley
 * pública (`lib/studio/nomina/ley/parametros.ts`) y marca con asterisco lo que
 * no está verificado. El asterisco (o el nombre de la regla) abre la «ficha
 * legal»: qué dice la norma, la fuente, la vigencia y, si no está verificada,
 * la nota de consultar con un abogado.
 *
 * Solo lee las reglas del tenant y datos públicos de la ley: ningún dato de
 * empleados pasa por aquí.
 */

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import {
  dayMethodLabel,
  payFrequencyLabel,
  payrollRulesStatusLabel,
  type PayrollRules,
} from "@/lib/studio/nomina/payroll-rules-types";
import {
  ESTADO_META,
  FECHA_CORTE_LEY,
  GRADO_META,
  GRUPOS_LEY,
  NOTA_NO_VERIFICADO,
  compararConLey,
  cuentaComoObligacion,
  estaVerificado,
  formatearFechaLey,
  formatearValorLey,
  resumenComparacion,
  type Comparacion,
  type EstadoComparacion,
} from "@/lib/studio/nomina/ley/parametros";

type Filtro = "todo" | "revisar" | "falta" | "referencia";

const ESTADO_TONO: Record<EstadoComparacion, BadgeTone> = {
  "al-dia": "success",
  difiere: "danger",
  unidad: "warning",
  falta: "neutral",
};

// Cabecera en tinta con texto invertido (app/studio/CLAUDE.md, tokens): en dark
// ambos se invierten juntos y el contraste se conserva.
const HERO_BG = "var(--ink)";
const CREMA = "var(--ink-inv)";
const CREMA_SUAVE = "var(--ink-inv-soft)";
const CREMA_TENUE = "var(--ink-inv-mute)";

/* Movimiento (MOT-01): solo --dur-fast, --dur y --dur-slow con --ease. Nada se
   repite: el asterisco responde a hover, foco y presión, y la ficha entra una
   sola vez. Con movimiento reducido no hay escala ni desplazamiento. */
const CSS = `
.rl-row { transition: background-color var(--dur-fast) var(--ease); }
.rl-row:hover { background: var(--bg-elevated); }
.rl-ast {
  all:unset; display:inline-grid; place-items:center; flex:none; width:32px; height:32px;
  margin:-5px 0; border-radius:999px; cursor:pointer;
}
.rl-ast-dot {
  display:grid; place-items:center; width:22px; height:22px; border-radius:999px;
  background:var(--warning-bg); color:var(--ink); font:800 15px/1 var(--f-sans);
  transition: transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
}
.rl-ast:hover .rl-ast-dot, .rl-ast:focus-visible .rl-ast-dot { transform: scale(1.18) rotate(-8deg); box-shadow: 0 0 0 4px var(--warning-bg); }
.rl-ast:active .rl-ast-dot { transform: scale(.94); }
.rl-ast:focus-visible { outline:2px solid var(--ink); outline-offset:-2px; }
.rl-name { all:unset; cursor:pointer; font:600 13px/1.3 var(--f-sans); color:var(--ink); }
.rl-name:hover { text-decoration: underline; text-underline-offset: 3px; }
.rl-name:focus-visible { outline:2px solid var(--ink); outline-offset:2px; border-radius:4px; }
.rl-scrim { position:fixed; inset:0; background: var(--scrim-soft); z-index:80; animation: rl-fade var(--dur) var(--ease); }
.rl-ficha {
  position:fixed; z-index:81; width:min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 32px); overflow:auto;
  background:var(--bg-surface); color:var(--ink); border:1px solid var(--border-strong);
  border-radius: var(--r-xl); box-shadow: var(--shadow-pop);
  animation: rl-abrir var(--dur-slow) var(--ease);
}
.rl-sello {
  display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:6px;
  border:2px solid currentColor; font:800 11px/1 var(--f-sans); letter-spacing:.14em; text-transform:uppercase;
  transform: rotate(-6deg); animation: rl-sello var(--dur-slow) var(--ease) both;
}
.rl-barra-fill { transform-origin:left; animation: rl-barra var(--dur-slow) var(--ease); }
@keyframes rl-abrir { from { opacity:0; transform: scale(.86) translateY(6px); } to { opacity:1; transform:none; } }
@keyframes rl-fade { from { opacity:0 } to { opacity:1 } }
@keyframes rl-sello { from { opacity:0; transform: rotate(-18deg) scale(1.6); } to { opacity:1; transform: rotate(-6deg) scale(1); } }
@keyframes rl-barra { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@media (max-width: 719px) {
  .rl-ficha { left:16px !important; right:16px; top:auto !important; bottom:16px; width:auto; transform-origin: 50% 100% !important; }
}
@media (prefers-reduced-motion: reduce) {
  .rl-ficha, .rl-scrim, .rl-sello, .rl-barra-fill { animation: none !important; }
  .rl-ast-dot, .rl-row { transition: none !important; }
  .rl-ast:hover .rl-ast-dot, .rl-ast:focus-visible .rl-ast-dot, .rl-ast:active .rl-ast-dot { transform:none; }
}
`;

function fechaCorta(iso: string): string {
  return formatearFechaLey(iso);
}

export function ReglasTab({
  rules,
  onEdit,
}: {
  rules: PayrollRules | null;
  onEdit: () => void;
}) {
  const items = useMemo(() => compararConLey(rules), [rules]);
  const resumen = useMemo(() => resumenComparacion(items), [items]);
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [abierta, setAbierta] = useState<{ c: Comparacion; origen: DOMRect | null } | null>(null);

  const visibles = items.filter((c) => {
    if (filtro === "todo") return true;
    const obliga = cuentaComoObligacion(c.parametro);
    if (filtro === "referencia") return !obliga;
    if (!obliga) return false;
    return filtro === "falta" ? c.estado === "falta" : c.estado === "difiere" || c.estado === "unidad";
  });

  return (
    <>
      <style>{CSS}</style>

      <Hero
        rules={rules}
        alDia={resumen.obligacionesAlDia}
        porRevisar={resumen.porRevisar}
        faltan={resumen.faltan}
        referencias={resumen.referencias}
        noVerificados={resumen.noVerificados}
        total={resumen.obligaciones}
        onEdit={onEdit}
      />

      {!rules && (
        <div style={{ marginBottom: "var(--s-4)" }}>
          <EmptyState
            eyebrow="Sin reglas"
            title="Aún no defines las reglas de cálculo."
            description="Abajo ves lo que dice la ley para cada parámetro. Define tus reglas para compararlas."
            action={
              <button type="button" className="studio-btn studio-btn-primary" onClick={onEdit}>
                Definir reglas
              </button>
            }
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          margin: "var(--s-4) 0",
        }}
      >
        <SegmentedControl<Filtro>
          variant="pills"
          size="sm"
          ariaLabel="Filtrar reglas"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "todo", label: `Todo (${items.length})` },
            { value: "revisar", label: `Por revisar (${resumen.porRevisar})` },
            { value: "falta", label: `No están en tus reglas (${resumen.faltan})` },
            { value: "referencia", label: `Referencias (${resumen.referencias})` },
          ]}
        />
        <p style={{ margin: 0, font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "52ch" }}>
          <span aria-hidden="true" style={{ fontWeight: 800, color: "var(--ink)" }}>* </span>
          No verificado: tócalo para ver por qué. Consúltalo con un abogado laboral o con el contador.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: "var(--s-4)",
        }}
      >
        {GRUPOS_LEY.map((g) => {
          const filas = visibles.filter((c) => c.parametro.grupo === g.id);
          if (filas.length === 0) return null;
          return (
            <section
              key={g.id}
              aria-labelledby={`rl-grupo-${g.id}`}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
              }}
            >
              <header style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border)" }}>
                <h3
                  id={`rl-grupo-${g.id}`}
                  style={{ margin: 0, fontFamily: "var(--f-sans)", fontWeight: 800, fontSize: 14, lineHeight: 1.2, color: "var(--ink)" }}
                >
                  {g.titulo}
                </h3>
                <p style={{ margin: "2px 0 0", font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {g.bajada}
                </p>
              </header>
              <div
                aria-hidden="true"
                style={{
                  display: "grid",
                  gridTemplateColumns: COLS,
                  gap: 8,
                  padding: "8px 18px 4px",
                  font: "700 9.5px/1 var(--f-sans)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                }}
              >
                <span>Regla</span>
                <span style={{ textAlign: "right" }}>Tus reglas</span>
                <span style={{ textAlign: "right" }}>Ley</span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: "0 0 6px" }}>
                {filas.map((c) => (
                  <Fila
                    key={c.parametro.id}
                    c={c}
                    onAbrir={(origen) => setAbierta({ c, origen })}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {rules?.notes && (
        <p
          style={{
            font: "400 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "var(--s-4) 0 0",
            maxWidth: "62ch",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>Nota de la versión:</strong> {rules.notes}
        </p>
      )}

      <p style={{ font: "400 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "var(--s-3) 0 0" }}>
        Revisión de la ley al {formatearFechaLey(FECHA_CORTE_LEY)}. Es información general, no asesoría para un
        caso concreto.
      </p>

      {abierta && (
        <FichaLegal c={abierta.c} origen={abierta.origen} onClose={() => setAbierta(null)} />
      )}
    </>
  );
}

const COLS = "minmax(0,1.5fr) minmax(64px,auto) minmax(64px,auto)";

// ─────────────────────────────────────────────────────────────
// Cabecera: versión, fecha de actualización y conteos
// ─────────────────────────────────────────────────────────────
function Hero({
  rules,
  alDia,
  porRevisar,
  faltan,
  referencias,
  noVerificados,
  total,
  onEdit,
}: {
  rules: PayrollRules | null;
  alDia: number;
  porRevisar: number;
  faltan: number;
  referencias: number;
  noVerificados: number;
  total: number;
  onEdit: () => void;
}) {
  const pct = total > 0 ? Math.round((alDia / total) * 100) : 0;
  return (
    <section
      aria-label="Versión de las reglas"
      style={{
        background: HERO_BG,
        color: CREMA,
        borderRadius: "var(--r-xl)",
        padding: "20px 22px",
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: CREMA_SUAVE,
            }}
          >
            Reglas de cálculo · LOTTT
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 26, lineHeight: 1.1, color: CREMA }}>
              {rules ? `Versión ${rules.version}` : "Sin versión"}
            </h2>
            {rules && (
              <span
                style={{
                  font: "700 11px/1 var(--f-sans)",
                  padding: "5px 9px",
                  borderRadius: 999,
                  border: `1px solid ${CREMA_TENUE}`,
                  color: CREMA,
                }}
              >
                {payrollRulesStatusLabel(rules.status)}
              </span>
            )}
          </div>
          <p style={{ margin: "6px 0 0", font: "500 13px/1.4 var(--f-sans)", color: CREMA_SUAVE }}>
            {rules ? (
              <>
                Actualizada el <strong style={{ color: CREMA }}>{fechaCorta(rules.created_at)}</strong>
                {" · "}
                {payFrequencyLabel(rules.pay_frequency)} · {dayMethodLabel(rules.day_method)}
              </>
            ) : (
              "Todavía no hay una versión guardada."
            )}
          </p>
          {rules && rules.vigente_desde !== undefined && (
            <p style={{ margin: "4px 0 0", font: "500 13px/1.4 var(--f-sans)", color: CREMA_SUAVE }}>
              {rules.vigente_desde ? (
                <>
                  Rige desde el <strong style={{ color: CREMA }}>{formatearFechaLey(rules.vigente_desde)}</strong>
                </>
              ) : (
                "Sin fecha de vigencia registrada"
              )}
              {rules.fuente_legal && (
                <>
                  {" · "}Fuente: <strong style={{ color: CREMA }}>{rules.fuente_legal}</strong>
                </>
              )}
            </p>
          )}
        </div>
        <button type="button" className="studio-btn studio-btn-primary" onClick={onEdit}>
          {rules ? "Editar reglas" : "Definir reglas"}
        </button>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", font: "600 12px/1 var(--f-sans)", color: CREMA_SUAVE }}>
          <span>Obligaciones al día</span>
          <span style={{ color: CREMA }}>
            {alDia} de {total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Obligaciones de ley que tus reglas tienen al día"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={alDia}
          style={{ marginTop: 8, height: 6, borderRadius: 999, background: CREMA_TENUE, overflow: "hidden" }}
        >
          <div
            className="rl-barra-fill"
            style={{
              width: `${pct}%`,
              height: "100%",
              background: CREMA,
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Pastilla valor={porRevisar} texto="por revisar" />
        <Pastilla valor={faltan} texto="no están en tus reglas" />
        <Pastilla valor={referencias} texto="referencias, no cuentan" />
        <Pastilla valor={noVerificados} texto="sin verificar" prefijo="*" />
      </div>
    </section>
  );
}

function Pastilla({ valor, texto, prefijo }: { valor: number; texto: string; prefijo?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        padding: "7px 11px",
        borderRadius: 999,
        border: `1px solid ${CREMA_TENUE}`,
        font: "500 12px/1 var(--f-sans)",
        color: CREMA_SUAVE,
      }}
    >
      <strong style={{ font: "800 14px/1 var(--f-sans)", color: CREMA }}>
        {prefijo ? `${prefijo} ` : ""}
        {valor}
      </strong>
      {texto}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Fila de la comparación
// ─────────────────────────────────────────────────────────────
function Fila({ c, onAbrir }: { c: Comparacion; onAbrir: (origen: DOMRect | null) => void }) {
  const p = c.parametro;
  const verificado = estaVerificado(p);
  const valorRegla =
    c.valorRegla != null && c.unidadRegla ? formatearValorLey(c.valorRegla, c.unidadRegla) : "—";
  const abrir = (e: React.MouseEvent<HTMLButtonElement>) =>
    onAbrir(e.currentTarget.getBoundingClientRect());

  return (
    <li
      className="rl-row"
      style={{
        display: "grid",
        gridTemplateColumns: COLS,
        gap: 8,
        alignItems: "center",
        padding: "9px 18px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
        <button type="button" className="rl-name" onClick={abrir} aria-haspopup="dialog">
          {p.etiqueta}
        </button>
        {!verificado && (
          <button
            type="button"
            className="rl-ast"
            onClick={abrir}
            aria-haspopup="dialog"
            aria-label={`${p.etiqueta}: no verificado. Ver por qué`}
            title="No verificado"
          >
            <span className="rl-ast-dot" aria-hidden="true">*</span>
          </button>
        )}
        </div>
        <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone={ESTADO_TONO[c.estado]} size="xs">
            {ESTADO_META[c.estado].etiqueta}
          </Badge>
          {!cuentaComoObligacion(p) && (
            <Badge tone="neutral" size="xs">
              Referencia
            </Badge>
          )}
        </div>
      </div>
      <span
        style={{
          textAlign: "right",
          whiteSpace: "nowrap",
          font: "700 12.5px/1.2 var(--f-mono)",
          color: c.valorRegla == null ? "var(--ink-soft)" : "var(--ink)",
          textDecoration: c.estado === "difiere" ? "line-through" : undefined,
          textDecorationColor: c.estado === "difiere" ? "var(--danger)" : undefined,
        }}
      >
        {valorRegla}
      </span>
      <span style={{ textAlign: "right", whiteSpace: "nowrap", font: "800 12.5px/1.2 var(--f-mono)", color: "var(--ink)" }}>
        {p.comparacion === "minimo" ? "≥ " : ""}
        {formatearValorLey(p.valor, p.unidad)}
      </span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Ficha legal: se abre desde el asterisco o el nombre de la regla
// ─────────────────────────────────────────────────────────────
function posicion(origen: DOMRect | null): CSSProperties {
  if (!origen || typeof window === "undefined") {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  const ancho = Math.min(420, window.innerWidth - 32);
  const left = Math.max(16, Math.min(origen.left, window.innerWidth - ancho - 16));
  const abajo = window.innerHeight - origen.bottom;
  const top = abajo > 360 ? origen.bottom + 8 : Math.max(16, origen.top - 8 - Math.min(460, window.innerHeight - 32));
  const ox = Math.max(0, origen.left + origen.width / 2 - left);
  return { left, top, transformOrigin: `${ox}px ${abajo > 360 ? 0 : "100%"}` };
}

function FichaLegal({
  c,
  origen,
  onClose,
}: {
  c: Comparacion;
  origen: DOMRect | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, { onClose, pending: false });
  const p = c.parametro;
  const verificado = estaVerificado(p);
  const grado = GRADO_META[p.grado];
  const tituloId = `rl-ficha-${p.id}`;
  const [estilo] = useState<CSSProperties>(() => posicion(origen));

  return (
    <>
      <div className="rl-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className="rl-ficha"
        style={estilo}
      >
        <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                font: "700 10px/1 var(--f-sans)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-soft)",
              }}
            >
              Ficha legal
            </div>
            <h3 id={tituloId} style={{ margin: "6px 0 0", fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
              {p.etiqueta}
            </h3>
          </div>
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose} aria-label="Cerrar ficha legal" title="Cerrar">
            {Icon.close(14)}
          </button>
        </div>

        <div style={{ padding: "12px 20px 0" }}>
          <span
            className="rl-sello"
            style={{ color: verificado ? "var(--success)" : "var(--warning)" }}
          >
            <span aria-hidden="true" style={{ display: "inline-flex" }}>{verificado ? Icon.check(12) : "*"}</span>
            <span style={{ color: "var(--ink)" }}>{verificado ? "Verificado" : grado.etiqueta}</span>
          </span>
        </div>

        <p style={{ margin: "14px 20px 0", font: "500 13.5px/1.5 var(--f-sans)" }}>{p.texto}</p>

        <dl
          style={{
            margin: "14px 20px 0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <Dato titulo="Según la ley" valor={`${p.comparacion === "minimo" ? "≥ " : ""}${formatearValorLey(p.valor, p.unidad)}`} />
          <Dato
            titulo="Tus reglas"
            valor={c.valorRegla != null && c.unidadRegla ? formatearValorLey(c.valorRegla, c.unidadRegla) : "No lo tienen"}
            pie={ESTADO_META[c.estado].etiqueta}
          />
        </dl>

        <div
          style={{
            margin: "14px 20px 0",
            padding: "12px 14px",
            borderRadius: "var(--r-md)",
            background: "var(--bg-elevated)",
            font: "500 12.5px/1.5 var(--f-sans)",
          }}
        >
          <div style={{ font: "700 10px/1 var(--f-sans)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 6 }}>
            Fuente
          </div>
          <div style={{ fontWeight: 700 }}>{p.fuente.instrumento}</div>
          {(p.fuente.gaceta || p.fuente.fecha || p.fuente.articulo) && (
            <div style={{ color: "var(--ink-soft)" }}>
              {[p.fuente.gaceta, p.fuente.fecha ? formatearFechaLey(p.fuente.fecha) : null, p.fuente.articulo]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
          <div style={{ color: "var(--ink-soft)", marginTop: 4 }}>
            {p.vigenteDesde ? `Vigente desde el ${formatearFechaLey(p.vigenteDesde)}` : "Vigencia: por confirmar"}
          </div>
          {p.detalle && <p style={{ margin: "8px 0 0" }}>{p.detalle}</p>}
          <p style={{ margin: "8px 0 0", color: "var(--ink-soft)" }}>
            <strong style={{ color: "var(--ink)" }}>Dónde se comprobó:</strong> {p.comprobadoEn}
          </p>
          <p style={{ margin: "8px 0 0", color: "var(--ink-soft)" }}>
            <strong style={{ color: "var(--ink)" }}>¿Obliga a la empresa?</strong>{" "}
            {p.alcance === "obliga"
              ? p.grado === "anuncio"
                ? "Sí, el beneficio es de ley. El monto es solo un anuncio y por eso no cuenta en la barra."
                : "Sí."
              : "No consta que obligue al sector privado. Se muestra como referencia y no cuenta en la barra."}
          </p>
        </div>

        {!verificado && (
          <div style={{ margin: "12px 20px 0" }}>
            <Aviso tono="atencion" titulo={grado.explicacion} compacto>
              {NOTA_NO_VERIFICADO}
            </Aviso>
          </div>
        )}

        <p style={{ margin: "12px 20px 18px", font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Revisión de la ley al {formatearFechaLey(FECHA_CORTE_LEY)}. Información general, no asesoría.
        </p>
      </div>
    </>
  );
}

function Dato({ titulo, valor, pie }: { titulo: string; valor: string; pie?: string }) {
  return (
    <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
      <dt style={{ font: "700 10px/1 var(--f-sans)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
        {titulo}
      </dt>
      <dd style={{ margin: "6px 0 0", font: "800 15px/1.1 var(--f-mono)" }}>{valor}</dd>
      {pie && <dd style={{ margin: "4px 0 0", font: "500 11.5px/1.2 var(--f-sans)", color: "var(--ink-soft)" }}>{pie}</dd>}
    </div>
  );
}
