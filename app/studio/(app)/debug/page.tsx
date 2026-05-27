/**
 * /studio/debug · estado del entorno e integraciones.
 *
 * Página de transparencia: dice exactamente dónde está corriendo el Studio
 * (local / preview / producción), qué commit está deployado, y qué
 * integraciones externas están activas vs en modo mock.
 *
 * Pensada para el founder · "¿por qué no salió ese mail?" se responde acá
 * en 3 segundos sin tocar el dashboard de Vercel.
 *
 * Server component. NUNCA muestra valores de env vars, solo nombres.
 */

import type { Metadata } from "next";
import {
  countMocks,
  envLabel,
  getEnvStatus,
  integrationEnvVar,
  integrationLabel,
  TRACKED_ENV_VARS_LIST,
  type IntegrationKey,
  type IntegrationStatus,
} from "@/lib/studio/env-status";
import { Badge } from "../../_components/ui/Badge";

export const metadata: Metadata = {
  title: "Estado del entorno",
};

const INTEGRATION_ORDER: IntegrationKey[] = [
  "supabase",
  "resend",
  "resendWebhook",
  "telegram",
  "telegramWebhook",
  "anthropic",
  "hailuway",
];

const INTEGRATION_DESCRIPTIONS: Record<IntegrationKey, string> = {
  supabase: "Base de datos del Studio (Postgres, Auth, Storage, Realtime).",
  resend: "Envío de emails transaccionales (welcome, factura, invitación, bug).",
  resendWebhook: "Recepción de eventos delivery/bounce/complaint de Resend.",
  telegram: "Bot @DTDStudioBot · notif a operarios y reporters de bugs.",
  telegramWebhook: "Recepción de mensajes del bot (linkeo, comandos).",
  anthropic: "Features con Claude (LLM Agent, AI assist).",
  hailuway: "ERP HailuWay externo · usado por sitio público (cotizar, track).",
};

function statusBadge(s: IntegrationStatus) {
  if (s === "active") return <Badge tone="success" size="md" dot>Activo</Badge>;
  if (s === "mock") return <Badge tone="warning" size="md" dot>Mock</Badge>;
  return <Badge tone="danger" size="md" dot>Falta</Badge>;
}

export default function DebugPage() {
  const s = getEnvStatus();
  const mocks = countMocks(s);
  const isProd = s.env === "production";
  const isLocal = s.env === "local";

  const envAccent = isProd
    ? "var(--success)"
    : isLocal
      ? "var(--warning)"
      : "var(--info)";
  const envBg = isProd
    ? "var(--success-bg)"
    : isLocal
      ? "var(--warning-bg)"
      : "var(--info-bg)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>
      {/* Header */}
      <div>
        <div
          className="studio-eyebrow"
          style={{ color: "var(--ink-soft)", marginBottom: "var(--s-2)" }}
        >
          Diagnóstico
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 28, margin: 0, color: "var(--ink)" }}
        >
          Estado del entorno
        </h1>
        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: 14,
            marginTop: "var(--s-2)",
            maxWidth: 720,
          }}
        >
          Dónde está corriendo el Studio en este momento y qué integraciones
          externas están activas. Si algo no funciona (mail no llegó, bot no
          mandó), revisá acá antes de tocar Vercel.
        </p>
      </div>

      {/* Hero · entorno actual */}
      <div
        style={{
          background: envBg,
          border: `1px solid ${envAccent}`,
          borderRadius: "var(--r-lg)",
          padding: "var(--s-6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-6)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-4)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: envAccent,
              boxShadow: `0 0 0 4px ${envBg}`,
            }}
          />
          <div>
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Entorno
            </div>
            <div
              className="studio-display"
              style={{ fontSize: 24, color: "var(--ink)", marginTop: 2 }}
            >
              {envLabel(s.env)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--s-6)" }}>
          <Stat label="Activas" value={INTEGRATION_ORDER.length - mocks} tone="success" />
          <Stat label="En mock" value={mocks} tone={mocks > 0 ? "warning" : "neutral"} />
        </div>
      </div>

      {/* Deploy info */}
      <Card title="Deploy">
        <KV
          k="URL del deploy"
          v={
            s.vercelUrl
              ? `https://${s.vercelUrl}`
              : "—  (corriendo en local con next dev)"
          }
        />
        <KV k="Branch" v={s.branch ?? "— (local)"} />
        <KV
          k="Commit SHA"
          v={s.commitSha ? `${s.commitShaShort}  (${s.commitSha})` : "— (local)"}
          mono
        />
      </Card>

      {/* Integraciones */}
      <Card title="Integraciones">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {INTEGRATION_ORDER.map((k) => {
            const st = s.integrations[k];
            return (
              <div
                key={k}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: "var(--s-4)",
                  padding: "var(--s-3) 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--s-3)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--ink)",
                        fontSize: 14,
                      }}
                    >
                      {integrationLabel(k)}
                    </span>
                    <code
                      style={{
                        fontSize: 11,
                        color: "var(--ink-mute)",
                        background: "var(--bg-elevated)",
                        padding: "2px 6px",
                        borderRadius: "var(--r-xs)",
                        fontFamily: "var(--f-mono)",
                      }}
                    >
                      {integrationEnvVar(k)}
                    </code>
                  </div>
                  <div
                    style={{
                      color: "var(--ink-soft)",
                      fontSize: 12.5,
                      marginTop: 4,
                    }}
                  >
                    {INTEGRATION_DESCRIPTIONS[k]}
                  </div>
                </div>
                <div>{statusBadge(st)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Env vars presentes */}
      <Card title={`Env vars detectadas (${s.envVarsPresent.length} de ${TRACKED_ENV_VARS_LIST.length})`}>
        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: 12.5,
            margin: "0 0 var(--s-3) 0",
          }}
        >
          Solo nombres. Los valores nunca se exponen.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--s-2)",
          }}
        >
          {TRACKED_ENV_VARS_LIST.map((k) => {
            const present = s.envVarsPresent.includes(k);
            return (
              <code
                key={k}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--f-mono)",
                  padding: "4px 8px",
                  borderRadius: "var(--r-sm)",
                  background: present
                    ? "var(--success-bg)"
                    : "var(--neutral-bg)",
                  color: present ? "var(--success)" : "var(--ink-mute)",
                  border: present
                    ? "1px solid var(--success)"
                    : "1px solid var(--border)",
                  opacity: present ? 1 : 0.7,
                }}
                title={present ? "Configurada" : "No configurada"}
              >
                {present ? "✓ " : "  "}
                {k}
              </code>
            );
          })}
        </div>
      </Card>

      {/* Ayuda */}
      {!isProd && mocks > 0 && (
        <Card title="¿Por qué hay integraciones en mock?">
          <p style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.55, margin: 0 }}>
            En <strong>{envLabel(s.env)}</strong> faltan algunas env vars de
            servicios externos. Eso es <strong>esperado</strong>: el código
            detecta la ausencia y entra en "mock mode" (devuelve un error
            controlado sin romper el flujo, pero no envía nada al exterior).
          </p>
          <p style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.55, marginTop: "var(--s-3)" }}>
            Si querés que tu local mande mails y bots <strong>reales</strong>{" "}
            (cuidado, salen a clientes reales), instalá Vercel CLI y corré:
          </p>
          <pre
            style={{
              fontFamily: "var(--f-mono)",
              fontSize: 12,
              background: "var(--bg-elevated)",
              padding: "var(--s-3)",
              borderRadius: "var(--r-sm)",
              marginTop: "var(--s-2)",
              overflow: "auto",
            }}
          >{`# OJO: el último comando sobrescribe tu .env.local actual.
# Si lo necesitás, hacé backup antes:
cp .env.local .env.local.backup

pnpm add -g vercel
vercel login
vercel link
vercel env pull .env.local`}</pre>
        </Card>
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5) var(--s-6)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
          margin: "0 0 var(--s-4) 0",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function KV({
  k,
  v,
  mono = false,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: "var(--s-4)",
        padding: "var(--s-2) 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{k}</div>
      <div
        style={{
          color: "var(--ink)",
          fontSize: 13,
          fontFamily: mono ? "var(--f-mono)" : undefined,
          wordBreak: "break-all",
        }}
      >
        {v}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "neutral";
}) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--ink-soft)";
  return (
    <div style={{ textAlign: "right" }}>
      <div
        className="studio-display"
        style={{ fontSize: 28, color, lineHeight: 1 }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
