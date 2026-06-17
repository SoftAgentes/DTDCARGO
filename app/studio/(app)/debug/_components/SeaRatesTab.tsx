"use client";

/**
 * Torre de control · pestaña SeaRates (SDD-0092 Fase 1).
 *
 * Panel de PRUEBA del benchmark de fletes marítimos: el admin ingresa los IDs de
 * punto SeaRates (origen/destino, formato "P_<n>") + modo (FCL/LCL) + contenedor
 * y consulta una tarifa de referencia. El fetch va SIEMPRE a
 * `/api/studio/searates/probe` (ruta admin del Studio) y NUNCA a searates.com →
 * el secreto no viaja al cliente.
 *
 * La API real es GraphQL: el request usa `pointIdFrom`/`pointIdTo` (IDs de punto
 * "P_<n>"), no LOCODEs. El autocompletado nombre→ID es Fase 2; por ahora el
 * operador ingresa los IDs a mano (placeholders con los conocidos de la ruta).
 *
 * El rate es REFERENCIA para el costing, NO el precio al cliente público. En
 * mock mode (sin SEARATES_API_KEY) el endpoint responde { ok:false,
 * error:'mock_no_key' } y el panel lo muestra como "modo mock" sin tratarlo como
 * fallo. Cuota: 100 llamadas/mes → cada consulta cuenta.
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";

type ProbeResult =
  | {
      ok: true;
      mode: "FCL" | "LCL";
      rateUsd: number | null;
      currency: string | null;
      transitDays: number | null;
      carrier: string | null;
      validityTo: string | null;
      spot: boolean | null;
      indicative: boolean | null;
      expired: boolean | null;
      raw: unknown;
    }
  | { ok: false; error: string; code?: string; raw?: unknown };

// IDs de punto conocidos de la ruta canónica China→Venezuela (referencia visible
// al operador). Nansha → La Guaira es la que validamos a mano.
const DEFAULTS = { pointIdFrom: "P_27395", pointIdTo: "P_19774", container: "HC40" };

// Puntos VE conocidos, para el placeholder/ayuda (Fase 2 = autocompletado).
const KNOWN_POINTS =
  "Nansha P_27395 · La Guaira P_19774 · Puerto Cabello P_19792 · Guanta P_19772 · Shekou P_27079";

function errorLabel(error: string, code?: string): string {
  switch (error) {
    case "mock_no_key":
      return "Modo mock · SEARATES_API_KEY no está configurada en este entorno.";
    case "invalid_input":
      return `Datos inválidos${code ? ` · ${code}` : ""}.`;
    case "auth_failed":
      return "No se pudo obtener el token de SeaRates (credenciales o auth caído).";
    case "graphql_error":
      return `El proveedor rechazó la consulta GraphQL${code ? ` · ${code}` : ""}.`;
    case "no_rate":
      return "El proveedor respondió pero sin una tarifa reconocible (ver mapeo).";
    default:
      if (error.startsWith("http_"))
        return `El proveedor respondió ${error.replace("http_", "HTTP ")}${
          code ? ` · ${code}` : ""
        }.`;
      if (error.startsWith("network:"))
        return `Fallo de red al consultar el proveedor (${error.slice(8).trim()}).`;
      return error;
  }
}

export function SeaRatesTab() {
  const [pointIdFrom, setPointIdFrom] = useState(DEFAULTS.pointIdFrom);
  const [pointIdTo, setPointIdTo] = useState(DEFAULTS.pointIdTo);
  const [mode, setMode] = useState<"FCL" | "LCL">("FCL");
  const [container, setContainer] = useState(DEFAULTS.container);
  const [volumeM3, setVolumeM3] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  const canSubmit =
    pointIdFrom.trim().length >= 3 &&
    pointIdTo.trim().length >= 3 &&
    (mode === "LCL" || container.trim().length > 0) &&
    !loading;

  async function consultar() {
    setLoading(true);
    setResult(null);
    setReqError(null);
    try {
      const body: Record<string, unknown> = {
        pointIdFrom: pointIdFrom.trim(),
        pointIdTo: pointIdTo.trim(),
        shippingType: mode,
      };
      if (mode === "FCL") body.container = container.trim();
      if (volumeM3.trim()) body.volumeM3 = Number(volumeM3);
      if (weightKg.trim()) body.weightKg = Number(weightKg);

      const res = await fetch("/api/studio/searates/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | { rate?: ProbeResult; error?: string }
        | null;

      if (!res.ok) {
        setReqError(json?.error ?? `HTTP ${res.status}`);
        return;
      }
      if (json?.rate) setResult(json.rate);
      else setReqError("Respuesta sin tarifa.");
    } catch (e) {
      setReqError(e instanceof Error ? e.message : "Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      {/* Nota de rol */}
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "var(--s-3) var(--s-4)",
          fontSize: 12.5,
          color: "var(--ink-soft)",
        }}
      >
        <strong style={{ color: "var(--ink)" }}>Benchmark interno.</strong> El
        rate de SeaRates es referencia para el costing, no el precio al cliente.
        Cuota 100 consultas/mes · cada consulta cuenta. Sin{" "}
        <code style={{ fontFamily: "var(--f-mono)", fontSize: 11 }}>
          SEARATES_API_KEY
        </code>{" "}
        el panel corre en modo mock.
      </div>

      {/* Formulario */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "var(--s-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "var(--s-4)",
          }}
        >
          <Field label="Punto origen (ID)">
            <input
              className="studio-input studio-input-mono"
              value={pointIdFrom}
              onChange={(e) => setPointIdFrom(e.target.value.toUpperCase())}
              placeholder="P_27395"
              aria-label="Punto origen ID"
            />
          </Field>
          <Field label="Punto destino (ID)">
            <input
              className="studio-input studio-input-mono"
              value={pointIdTo}
              onChange={(e) => setPointIdTo(e.target.value.toUpperCase())}
              placeholder="P_19774"
              aria-label="Punto destino ID"
            />
          </Field>
          <Field label="Modo">
            <select
              className="studio-input"
              value={mode}
              onChange={(e) => setMode(e.target.value as "FCL" | "LCL")}
              aria-label="Modo"
            >
              <option value="FCL">FCL (contenedor)</option>
              <option value="LCL">LCL (carga suelta)</option>
            </select>
          </Field>
          {mode === "FCL" ? (
            <Field label="Contenedor">
              <select
                className="studio-input"
                value={container}
                onChange={(e) => setContainer(e.target.value)}
                aria-label="Contenedor"
              >
                <option value="ST20">ST20 (20&apos;)</option>
                <option value="ST40">ST40 (40&apos;)</option>
                <option value="HC40">HC40 (40&apos; HQ)</option>
                <option value="REF20">REF20 (reefer 20&apos;)</option>
                <option value="REF40">REF40 (reefer 40&apos;)</option>
              </select>
            </Field>
          ) : (
            <>
              <Field label="Volumen m³ (opcional)">
                <input
                  className="studio-input"
                  value={volumeM3}
                  onChange={(e) => setVolumeM3(e.target.value)}
                  placeholder="3.40"
                  inputMode="decimal"
                  aria-label="Volumen m3"
                />
              </Field>
              <Field label="Peso kg (opcional)">
                <input
                  className="studio-input"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="1200"
                  inputMode="decimal"
                  aria-label="Peso kg"
                />
              </Field>
            </>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>
          IDs de punto conocidos: {KNOWN_POINTS}. El autocompletado nombre→ID
          llega en Fase 2.
        </div>

        <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
          <button
            type="button"
            className="studio-btn studio-btn-primary studio-btn-sm"
            onClick={consultar}
            disabled={!canSubmit}
            aria-busy={loading}
          >
            {loading ? "Consultando…" : "Consultar SeaRates"}
          </button>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            Pega a <code style={{ fontFamily: "var(--f-mono)" }}>/api/studio/searates/probe</code>
          </span>
        </div>
      </div>

      {/* Error de request (no del proveedor) */}
      {reqError && (
        <div
          role="alert"
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-md)",
            padding: "var(--s-3) var(--s-4)",
            fontSize: 13,
            color: "var(--ink)",
          }}
        >
          {reqError}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "var(--s-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
            {result.ok ? (
              <Badge tone="success" size="sm">Tarifa</Badge>
            ) : result.error === "mock_no_key" ? (
              <Badge tone="neutral" size="sm">Mock</Badge>
            ) : (
              <Badge tone="warning" size="sm">Sin tarifa</Badge>
            )}
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {result.ok
                ? `${result.mode} · ${pointIdFrom} → ${pointIdTo}`
                : errorLabel(result.error, result.code)}
            </span>
          </div>

          {result.ok && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "var(--s-4)",
              }}
            >
              <Stat
                label="Rate referencia"
                value={
                  result.rateUsd != null
                    ? `${result.currency ?? "USD"} ${result.rateUsd.toLocaleString("en-US")}`
                    : "—"
                }
              />
              <Stat
                label="Tránsito"
                value={result.transitDays != null ? `${result.transitDays} días` : "—"}
              />
              <Stat label="Carrier" value={result.carrier ?? "—"} />
              <Stat label="Válida hasta" value={result.validityTo ?? "—"} />
            </div>
          )}

          {/* JSON crudo: clave para ajustar el mapeo durante la validación en vivo.
              Disponible también en errores de proveedor (graphql_error, http_*). */}
          {result.raw != null && (
            <details>
              <summary
                style={{ fontSize: 12, color: "var(--ink-soft)", cursor: "pointer" }}
              >
                Ver respuesta cruda (raw) · para ajustar el mapeo
              </summary>
              <pre
                style={{
                  marginTop: "var(--s-2)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  padding: "var(--s-3)",
                  fontSize: 11,
                  fontFamily: "var(--f-mono)",
                  color: "var(--ink-soft)",
                  overflow: "auto",
                  maxHeight: 280,
                }}
              >
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="studio-label">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
