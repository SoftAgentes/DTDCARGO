/**
 * EnvBanner · barra de entorno arriba del Studio.
 *
 * Server component. Avisa visualmente al operador qué entorno está usando
 * (local / preview / producción) y qué integraciones externas están en
 * modo mock vs activas.
 *
 * En producción NO renderiza nada (cero ruido visual al user real).
 *
 * En local/preview muestra:
 *   - Dot de color + nombre del entorno
 *   - Resumen "N integraciones en mock" o "todas activas"
 *   - Chips por integración crítica con tono según estado
 *   - Link "Ver detalle" → /studio/debug
 */

import Link from "next/link";
import {
  countMocks,
  envLabel,
  getEnvStatus,
  integrationLabel,
  type IntegrationKey,
  type IntegrationStatus,
} from "@/lib/studio/env-status";
import { Badge } from "./ui/Badge";
import { DeployButton } from "./deploy/DeployWebBot";

const CRITICAL_INTEGRATIONS: IntegrationKey[] = [
  "resend",
  "telegram",
  "anthropic",
];

function statusTone(s: IntegrationStatus): "success" | "warning" | "danger" {
  if (s === "active") return "success";
  if (s === "mock") return "warning";
  return "danger";
}

function statusLabel(s: IntegrationStatus): string {
  if (s === "active") return "activo";
  if (s === "mock") return "mock";
  return "falta";
}

export function EnvBanner() {
  const s = getEnvStatus();
  if (s.env === "production") return null;

  const mocks = countMocks(s);
  const isLocal = s.env === "local";

  const accentColor = isLocal ? "var(--warning)" : "var(--info)";
  const bgColor = isLocal ? "var(--warning-bg)" : "var(--info-bg)";

  const summary =
    mocks === 0
      ? "Todas las integraciones activas"
      : mocks === 1
        ? "1 integración en mock"
        : `${mocks} integraciones en mock`;

  return (
    <div
      role="status"
      aria-label={`Entorno ${envLabel(s.env)}. ${summary}.`}
      style={{
        background: bgColor,
        borderBottom: `1px solid ${accentColor}`,
        color: "var(--ink)",
        padding: "var(--s-2) var(--s-6)",
        fontSize: 12.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--s-4)",
        flexWrap: "wrap",
        minHeight: 36,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-2)",
            fontWeight: 600,
            color: accentColor,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: accentColor,
              display: "inline-block",
            }}
          />
          {envLabel(s.env)}
        </span>

        <span style={{ color: "var(--ink-soft)" }}>·</span>

        <span style={{ color: "var(--ink-soft)" }}>{summary}</span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-2)",
            marginLeft: "var(--s-2)",
          }}
        >
          {CRITICAL_INTEGRATIONS.map((k) => {
            const st = s.integrations[k];
            return (
              <Badge key={k} tone={statusTone(st)} size="sm" dot>
                {integrationLabel(k).split(" ")[0]} · {statusLabel(st)}
              </Badge>
            );
          })}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-3)",
        }}
      >
        {isLocal && <DeployButton />}
        <Link
          href="/studio/debug"
          style={{
            color: accentColor,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: 2,
            textDecorationThickness: 1,
            whiteSpace: "nowrap",
          }}
        >
          Ver detalle <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
