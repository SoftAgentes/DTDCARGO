"use client";

import Link from "next/link";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Badge } from "@/app/studio/_components/ui/Badge";
import { TAMANOS_DE_LOTE, type LoteLegadoResult } from "@/lib/studio/markbox-legacy-types";
import { loteLegadoAction } from "../actions";

/**
 * Clientes › Migrar códigos del legado (SDD-0258).
 *
 * Pasa las fichas con serie de VENDEDOR al rango `DTD-8xxx`, separado de la
 * serie viva de la casa, para que migrar el legado no empuje el correlativo de
 * los clientes reales. Cada renombrado jubila su código viejo: queda reservado y
 * sigue resolviendo, así que una caja rotulada con él no llega huérfana.
 *
 * ⚠️ TODOS los números —pendientes, desglose y mapeo— salen de la MISMA función
 * que ejecuta, llamada en simulacro. No hay un conteo paralelo: el anterior se
 * desincronizó de la base en cuatro horas y mostraba 201 donde había 361.
 */
export function MigrarLegadoClient({ esAdmin }: { esAdmin: boolean }) {
  const [batch, setBatch] = useState<number>(10);
  /** Lo que se muestra arriba: siempre lo último que dijo la base. */
  const [resumen, setResumen] = useState<Pick<
    LoteLegadoResult,
    "pendientesDespues" | "porSerie"
  > | null>(null);
  /** Lo que se muestra abajo: sólo tras un Simular o un Migrar explícitos. */
  const [result, setResult] = useState<LoteLegadoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardarResumen = useCallback((r: LoteLegadoResult) => {
    setResumen({ pendientesDespues: r.pendientesDespues, porSerie: r.porSerie });
  }, []);

  // Al abrir la pantalla se pide el resumen con un simulacro de UNA ficha: es la
  // llamada más barata que devuelve los números autoritativos. No escribe nada.
  useEffect(() => {
    if (!esAdmin) return;
    let vivo = true;
    void loteLegadoAction(1, false).then((r) => {
      if (!vivo || !r) return;
      if ("error" in r) setError(r.error);
      else guardarResumen(r.result);
    });
    return () => {
      vivo = false;
    };
  }, [esAdmin, guardarResumen]);

  function correr(ejecutar: boolean) {
    setError(null);
    setConfirmando(false);
    startTransition(async () => {
      const r = await loteLegadoAction(batch, ejecutar);
      if (!r) return;
      if ("error" in r) {
        setError(r.error);
        setResult(null);
        return;
      }
      setResult(r.result);
      guardarResumen(r.result);
    });
  }

  const pendientes = resumen?.pendientesDespues ?? null;

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 900 }}>
      <header>
        {/* SDD-0266 · misma razón que en Duplicados: se llega sólo desde el menú
            de la cabecera y no hay entrada en el nav lateral. */}
        <Link
          href="/studio/clientes"
          className="studio-link-quiet"
          style={{
            font: "600 12px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          ← Clientes
        </Link>
        <span className="studio-eyebrow" style={{ display: "block" }}>
          Clientes
        </span>
        <h1 style={{ font: "800 26px/1.2 var(--f-display)", color: "var(--ink)", margin: "6px 0 8px" }}>
          Migrar códigos del legado
        </h1>
        <p style={{ font: "500 14px/1.55 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Las fichas con serie de <b style={{ color: "var(--ink)" }}>vendedor</b> —
          cada vendedor tenía su letra (A, D, J, P, Y)— pasan al rango{" "}
          <b style={{ color: "var(--ink)" }}>DTD-8xxx</b>, separado de la serie viva
          de la casa. Así migrar el legado no empuja el correlativo de tus clientes
          reales. El código viejo <b style={{ color: "var(--ink)" }}>no se borra</b>:
          queda reservado y sigue resolviendo, así que una caja rotulada con él
          llega igual a su ficha.
        </p>
      </header>

      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <span style={{ font: "800 34px/1 var(--f-mono)", color: "var(--ink)" }}>
            {pendientes ?? "—"}
          </span>
          <span style={{ font: "500 14px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {pendientes === null
              ? "consultando…"
              : `ficha${pendientes === 1 ? "" : "s"} por migrar`}
          </span>
        </div>

        {resumen && resumen.porSerie.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {resumen.porSerie.map((s) => (
              <Badge key={s.serie} tone="neutral" size="md">
                serie {s.serie} · {s.fichas}
              </Badge>
            ))}
          </div>
        )}

        {!esAdmin ? (
          <p style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Un lote sólo lo puede correr un administrador. Cambiar el Shipping Mark
            de un cliente suelto sí lo puedes hacer desde su ficha.
          </p>
        ) : pendientes === 0 ? (
          <p style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            No queda ninguna ficha del legado. Migración terminada.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <div>
                <label htmlFor="lote-tam" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
                  Fichas por tanda
                </label>
                <select
                  id="lote-tam"
                  className="studio-input"
                  value={batch}
                  onChange={(e) => setBatch(Number(e.target.value))}
                  disabled={pending}
                  style={{ width: 140 }}
                >
                  {TAMANOS_DE_LOTE.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => correr(false)}
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? "Calculando…" : "Simular"}
              </button>

              {!confirmando ? (
                <button
                  type="button"
                  className="studio-btn studio-btn-dark studio-btn-sm"
                  onClick={() => setConfirmando(true)}
                  disabled={pending || pendientes === null}
                >
                  Migrar esta tanda
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ font: "600 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                    ¿Migrar {Math.min(batch, pendientes ?? batch)} ficha
                    {Math.min(batch, pendientes ?? batch) === 1 ? "" : "s"}?
                  </span>
                  <button
                    type="button"
                    className="studio-btn studio-btn-dark studio-btn-sm"
                    onClick={() => correr(true)}
                    disabled={pending}
                  >
                    Sí, migrar
                  </button>
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    onClick={() => setConfirmando(false)}
                    disabled={pending}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <p style={{ font: "500 12px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: "10px 0 0" }}>
              Simular no escribe nada: calcula el mapeo con la misma función que
              después ejecuta, para que apruebes exactamente lo que va a pasar.
            </p>
          </>
        )}

        {error && (
          <p style={{ font: "500 13px/1.45 var(--f-sans)", color: "var(--danger)", margin: "12px 0 0" }}>
            {error}
          </p>
        )}
      </section>

      {result && (
        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span className="studio-eyebrow">
              {result.simulacro ? "Simulacro · no se escribió nada" : "Migradas"}
            </span>
            <Badge tone={result.simulacro ? "neutral" : "success"} size="md">
              {result.simulacro ? `${result.enEsteLote} en la tanda` : `${result.renombrados} listas`}
            </Badge>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Cliente</th>
                  <th style={th}>Código viejo</th>
                  <th style={th}>Código nuevo</th>
                </tr>
              </thead>
              <tbody>
                {result.mapeo.map((m) => (
                  <tr key={m.de}>
                    <td style={{ ...td, font: "500 13.5px/1.4 var(--f-sans)", color: "var(--ink)", minWidth: 200 }}>
                      {m.nombre || <span style={{ color: "var(--ink-soft)" }}>—</span>}
                      {m.portal && (
                        <span
                          title="Tiene portal: va a ver el código nuevo al entrar"
                          style={{
                            marginLeft: 8,
                            font: "600 10.5px/1 var(--f-sans)",
                            color: "var(--ink-soft)",
                            border: "1px solid var(--border)",
                            borderRadius: 999,
                            padding: "3px 7px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          portal
                        </span>
                      )}
                    </td>
                    <td style={td}>{m.de}</td>
                    <td style={{ ...td, color: "var(--ink)" }}>{m.a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "14px 0 0" }}>
            {result.simulacro ? (
              <>
                Nada de esto pasó todavía. Quedan{" "}
                <b style={{ color: "var(--ink)" }}>{result.pendientesDespues}</b> fichas
                por migrar — incluidas las de arriba, porque el simulacro no toca nada.
              </>
            ) : (
              <>
                Los códigos viejos quedaron en el historial de cada ficha, reservados
                y resolviendo. Quedan{" "}
                <b style={{ color: "var(--ink)" }}>{result.pendientesDespues}</b> por migrar.
              </>
            )}
          </p>
        </section>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  font: "600 11px/1.3 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "0 12px 8px 0",
  borderBottom: "1px solid var(--border)",
};

const td: React.CSSProperties = {
  font: "500 14px/1.4 var(--f-mono)",
  color: "var(--ink-soft)",
  letterSpacing: "0.03em",
  padding: "8px 12px 8px 0",
  borderBottom: "1px solid var(--border)",
};
