/**
 * Pestaña Radar de la torre de control (SDD-0050 Slice C).
 *
 * Muestra el ÚLTIMO informe del Radar guardado en `public/api/radar-report.json`
 * (artefacto versionado en git). El Radar es la skill `/radar` de Claude Code:
 * corre SOLO en local (necesita el runtime de Claude + el filesystem del repo).
 * En la web NO se ejecuta y NO se actualiza — solo se renderiza el último informe
 * generado en local.
 *
 * El informe se lee en el server component padre (`page.tsx` → `loadRadarReport`)
 * y llega como prop `report` (consistente con cómo el server pasa data viva a los
 * demás tabs). Si `report` es `null` (no existe el artefacto o está corrupto), la
 * pestaña NO rompe: muestra solo el banner + cómo generarlo.
 *
 * Banner de limitación OBLIGATORIO (requisito no-negociable del founder),
 * MODE-AWARE usando el `EnvName` que el server pasa desde `getEnvStatus()`:
 *   - web (preview/prod) → banner prominente (warning): NO es funcional en la web,
 *     lo que se ve es el último informe local y NO se actualiza acá.
 *   - local              → banner suave (neutral): último informe, cómo regenerar.
 *
 * Solo tokens `var(--*)` del sistema (cero hex inventados) + dots de color en vez
 * de emojis decorativos (regla de marca C5). Usa primitivas del sistema (Badge,
 * EmptyState).
 */

import type { EnvName } from "@/lib/studio/env-status";
import {
  type RadarReport,
  severityBadgeTone,
  reconCompletionPct,
} from "@/lib/studio/radar-types";
import { Badge } from "../../../_components/ui/Badge";
import { EmptyState } from "../../../_components/ui/EmptyState";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

export function RadarTab({
  report,
  env,
}: {
  /** Último informe del Radar (o `null` si no existe el artefacto). */
  report: RadarReport | null;
  /** Entorno — el banner de limitación es mode-aware (web vs local). */
  env: EnvName;
}) {
  const isWeb = env === "preview" || env === "production";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      <RadarBanner env={env} generatedAt={report?.generatedAt ?? null} />

      {report ? (
        <RadarReportView report={report} />
      ) : (
        <EmptyState
          eyebrow="Radar · sin informe"
          title="Todavía no hay un informe del Radar"
          description={
            <>
              El Radar {isWeb ? "no es funcional en la web — " : ""}corre en local
              con{" "}
              <code style={{ fontFamily: "var(--f-mono)" }}>/radar</code> en Claude
              Code. Cuando lo ejecutes, escribe el artefacto{" "}
              <code style={{ fontFamily: "var(--f-mono)" }}>
                public/api/radar-report.json
              </code>{" "}
              y este informe aparece acá.
            </>
          }
        />
      )}
    </div>
  );
}

/**
 * Banner de limitación OBLIGATORIO, mode-aware.
 * Web → warning prominente (no funcional acá, último informe local, no se actualiza).
 * Local → neutral suave (último informe, cómo regenerar).
 */
function RadarBanner({
  env,
  generatedAt,
}: {
  env: EnvName;
  generatedAt: string | null;
}) {
  const isWeb = env === "preview" || env === "production";

  // Web = atención (limitación real); local = información.

  return (
    <div data-radar-mode={isWeb ? "web" : "local"}>
      <Aviso tono={isWeb ? "atencion" : "info"} compacto>
        {isWeb ? (
          <span>
            <strong>
              El Radar no es funcional en la web
            </strong>{" "}
            — corre solo en local con{" "}
            <code style={{ fontFamily: "var(--f-mono)" }}>/radar</code> en Claude
            Code. Lo que ves es el{" "}
            <strong>
              último informe generado en local
            </strong>
            {generatedAt ? <> (generado {generatedAt})</> : null};{" "}
            <strong>no se actualiza acá</strong>.
          </span>
        ) : (
          <span>
            <strong>Último informe local</strong> ·
            regenerá corriendo{" "}
            <code style={{ fontFamily: "var(--f-mono)" }}>/radar</code> en Claude
            Code.
          </span>
        )}
      </Aviso>
    </div>
  );
}

/** Render del informe: Parte A (hallazgos) + Parte B (reconciliación). */
function RadarReportView({ report }: { report: RadarReport }) {
  const { partA, partB } = report;
  const pct = reconCompletionPct(partB.counts);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      {/* Meta del informe */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          fontSize: 12.5,
          color: "var(--ink-soft)",
        }}
      >
        <Badge tone="neutral" size="sm">
          Norte {report.norteVersion}
        </Badge>
        <span>
          Generado{" "}
          <strong style={{ color: "var(--ink)" }}>{report.generatedAt}</strong>
        </span>
      </div>

      {/* Parte A · hallazgos de workspace */}
      <section
        aria-label="Parte A · workspace"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            flexWrap: "wrap",
          }}
        >
          <h2
            className="studio-display"
            style={{ fontSize: 16, margin: 0, color: "var(--ink)" }}
          >
            Parte A · Workspace
          </h2>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Ahorro estimado de tokens:{" "}
            <strong style={{ color: "var(--ink)" }}>
              {partA.estimatedTokenSavings}
            </strong>
          </span>
        </div>

        {partA.findings.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
            Sin hallazgos en la última corrida.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-3)",
            }}
          >
            {partA.findings.map((f) => (
              <li
                key={f.id}
                data-finding-id={f.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-2)",
                  paddingBottom: "var(--s-3)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <Badge tone={severityBadgeTone(f.severity)} size="sm">
                    {f.severity}
                  </Badge>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {f.top ? "★ " : ""}
                    {f.title}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-soft)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {f.action}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Parte B · reconciliación del Norte */}
      <section
        aria-label="Parte B · reconciliación"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            flexWrap: "wrap",
          }}
        >
          <h2
            className="studio-display"
            style={{ fontSize: 16, margin: 0, color: "var(--ink)" }}
          >
            Parte B · Modelo de datos
          </h2>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Completitud:{" "}
            <strong style={{ color: "var(--ink)" }}>{pct}%</strong> (
            {partB.counts.built}/{partB.counts.total})
          </span>
        </div>

        {/* Barra de progreso · built / partial / missing */}
        <ReconBar counts={partB.counts} />

        <div
          style={{
            display: "flex",
            gap: "var(--s-4)",
            flexWrap: "wrap",
            fontSize: 12,
            color: "var(--ink-soft)",
          }}
        >
          <CountChip
            label="Construido"
            value={partB.counts.built}
            color="var(--success)"
          />
          <CountChip
            label="Parcial"
            value={partB.counts.partial}
            color="var(--warning)"
          />
          <CountChip
            label="Faltante"
            value={partB.counts.missing}
            color="var(--danger)"
          />
        </div>

        {partB.blocks && partB.blocks.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-2)",
            }}
          >
            {partB.blocks.map((b) => (
              <li
                key={b.name}
                data-block-name={b.name}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "var(--s-3)",
                  fontSize: 12.5,
                  color: "var(--ink-soft)",
                }}
              >
                <span>
                  <strong style={{ color: "var(--ink)" }}>{b.name}</strong>
                  {b.note ? <> · {b.note}</> : null}
                </span>
                <span style={{ flexShrink: 0, fontFamily: "var(--f-mono)" }}>
                  falta {b.remaining}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Barra de progreso segmentada: built (verde) / partial (ámbar) / missing (rojo). */
function ReconBar({
  counts,
}: {
  counts: RadarReport["partB"]["counts"];
}) {
  const total = counts.total || 1;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      role="img"
      aria-label={`Modelo de datos: ${counts.built} construido, ${counts.partial} parcial, ${counts.missing} faltante de ${counts.total}`}
      style={{
        display: "flex",
        width: "100%",
        height: 10,
        borderRadius: "var(--r-sm)",
        overflow: "hidden",
        background: "var(--neutral-bg)",
      }}
    >
      <span
        style={{ width: seg(counts.built), background: "var(--success)" }}
      />
      <span
        style={{ width: seg(counts.partial), background: "var(--warning)" }}
      />
      <span
        style={{ width: seg(counts.missing), background: "var(--danger)" }}
      />
    </div>
  );
}

function CountChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {label}: <strong style={{ color: "var(--ink)" }}>{value}</strong>
    </span>
  );
}
