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
import {
  listRecentDeploys,
  relativeTime,
  type DeployItem,
  type VercelDeployState,
} from "@/lib/studio/vercel-deploys";
import {
  checkAllIntegrations,
  fetchRemoteHealth,
  healthLabel,
  healthTone,
  type FetchRemoteResult,
  type IntegrationHealth,
} from "@/lib/studio/integration-health";
import { Badge } from "../../_components/ui/Badge";
import { RecheckButton } from "./_components/RecheckButton";

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

function deployStateTone(
  state: VercelDeployState,
): "success" | "warning" | "danger" | "neutral" {
  if (state === "READY") return "success";
  if (state === "BUILDING" || state === "QUEUED" || state === "INITIALIZING")
    return "warning";
  if (state === "ERROR") return "danger";
  return "neutral";
}

function deployStateLabel(state: VercelDeployState): string {
  if (state === "READY") return "Listo";
  if (state === "BUILDING") return "Buildeando";
  if (state === "QUEUED") return "En cola";
  if (state === "INITIALIZING") return "Inicializando";
  if (state === "ERROR") return "Error";
  if (state === "CANCELED") return "Cancelado";
  return state;
}

export default async function DebugPage() {
  const s = getEnvStatus();
  const mocks = countMocks(s);
  const isProd = s.env === "production";
  const isLocal = s.env === "local";
  // En local/preview además fetcheamos el estado real de producción
  // para poder comparar "lo que veo acá" vs "lo que ven los usuarios reales".
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
  // Corremos en paralelo: deploys + health local + health prod (si no es prod)
  const [deploysResult, healthByKey, remoteHealth] = await Promise.all([
    listRecentDeploys(10),
    checkAllIntegrations(),
    isProd ? Promise.resolve<FetchRemoteResult>({ ok: false, error: "skip_in_prod" }) : fetchRemoteHealth(siteUrl),
  ]);

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
      <Card title="Deploy actual">
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

      {/* Historial de deploys · Vercel API */}
      <Card title="Deploys recientes">
        {!deploysResult.ok ? (
          deploysResult.reason === "mock_no_token" ? (
            <div style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 var(--s-3) 0" }}>
                Para ver el historial de deploys del proyecto Vercel necesitás
                setear estas env vars (mismas que usa el bot del escritorio):
              </p>
              <ul style={{ margin: 0, paddingLeft: "var(--s-5)" }}>
                <li>
                  <code style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>
                    VERCEL_API_TOKEN
                  </code>{" "}
                  — el token de https://vercel.com/account/tokens
                </li>
                <li>
                  <code style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>
                    VERCEL_PROJECT_ID
                  </code>{" "}
                  — el ID del proyecto (formato <code>prj_...</code>)
                </li>
                <li>
                  <code style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>
                    VERCEL_TEAM_ID
                  </code>{" "}
                  — opcional, si el proyecto vive en un team
                </li>
              </ul>
              <p style={{ marginTop: "var(--s-3)", marginBottom: 0 }}>
                Agregalas en{" "}
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--info)", textDecoration: "underline" }}
                >
                  Vercel Dashboard
                </a>{" "}
                → Settings → Environment Variables → Production + Preview +
                Development.
              </p>
            </div>
          ) : (
            <div style={{ color: "var(--danger)", fontSize: 13 }}>
              No pude consultar Vercel API: {deploysResult.error ?? "error desconocido"}
            </div>
          )
        ) : deploysResult.deploys.length === 0 ? (
          <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>
            Sin deploys todavía.
          </div>
        ) : (
          <DeploysList deploys={deploysResult.deploys} currentShaShort={s.commitShaShort} />
        )}
      </Card>

      {/* Status de Producción · solo visible en local/preview */}
      {!isProd && (
        <Card title={`Status de Producción${remoteHealth.ok ? ` · ${remoteHealth.data.env}` : ""}`}>
          {remoteHealth.ok ? (
            <RemoteHealthList data={remoteHealth.data} />
          ) : (
            <div style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.55 }}>
              <p style={{ margin: 0 }}>
                No pude alcanzar <code style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>{siteUrl}/api/debug/health</code>
                {remoteHealth.error && (
                  <>
                    {" "}
                    <span style={{ color: "var(--danger)" }}>({remoteHealth.error})</span>
                  </>
                )}
              </p>
              <p style={{ margin: "var(--s-2) 0 0 0", fontSize: 12 }}>
                Razón típica: el endpoint <code style={{ fontFamily: "var(--f-mono)" }}>/api/debug/health</code> aún no está deployado a producción.
                Subí los cambios pendientes con el bot y volvé a recargar.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Integraciones · local */}
      <Card title={isProd ? "Integraciones" : "Integraciones · local"} action={<RecheckButton />}>
        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: 12,
            margin: "0 0 var(--s-3) 0",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>Configurado</strong> = la env var
          existe ·{" "}
          <strong style={{ color: "var(--ink)" }}>Web</strong> = el servicio
          responde en vivo (chequeo cacheado 60s).
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {INTEGRATION_ORDER.map((k) => {
            const st = s.integrations[k];
            const health = healthByKey[k];
            return (
              <div
                key={k}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
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
                <div style={{ minWidth: 90, display: "flex", justifyContent: "flex-end" }}>
                  {statusBadge(st)}
                </div>
                <div>
                  <HealthBadge health={health} />
                </div>
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

function RemoteHealthList({
  data,
}: {
  data: {
    env: string;
    vercelUrl: string | null;
    commitShaShort: string | null;
    integrations: Record<IntegrationKey, IntegrationStatus>;
    health: Record<IntegrationKey, IntegrationHealth>;
    at: number;
  };
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--ink-soft)",
          marginBottom: "var(--s-3)",
          display: "flex",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        {data.vercelUrl && (
          <span>
            URL:{" "}
            <a
              href={`https://${data.vercelUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--info)", textDecoration: "underline" }}
            >
              {data.vercelUrl}
            </a>
          </span>
        )}
        {data.commitShaShort && (
          <span>
            Commit:{" "}
            <code style={{ fontFamily: "var(--f-mono)" }}>{data.commitShaShort}</code>
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {INTEGRATION_ORDER.map((k) => {
          const st = data.integrations[k];
          const health = data.health[k];
          return (
            <div
              key={k}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                alignItems: "center",
                gap: "var(--s-4)",
                padding: "var(--s-3) 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--ink)",
                    fontSize: 14,
                  }}
                >
                  {integrationLabel(k)}
                </span>
              </div>
              <div style={{ minWidth: 90, display: "flex", justifyContent: "flex-end" }}>
                {statusBadge(st)}
              </div>
              <div>
                <HealthBadge health={health} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HealthBadge({ health }: { health: IntegrationHealth }) {
  // Todos los estados se renderizan como Badge — consistencia visual
  // con el de "Configurado" al lado.
  let tone: "success" | "warning" | "danger" | "neutral";
  let label: string;
  if (health.status === "skipped") {
    tone = "neutral";
    label = "Sin chequear";
  } else if (health.status === "ok") {
    tone = "success";
    label =
      health.latencyMs !== null ? `Web OK · ${health.latencyMs}ms` : "Web OK";
  } else {
    tone = "danger";
    label = "Web error";
  }

  const detailText = health.error ?? health.detail;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 4,
        minWidth: 140,
      }}
    >
      <Badge tone={tone} size="md" dot>
        {label}
      </Badge>
      {detailText && (
        <span
          style={{
            fontSize: 11,
            color:
              health.status === "error" ? "var(--danger)" : "var(--ink-mute)",
            textAlign: "right",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={detailText}
        >
          {detailText}
        </span>
      )}
    </div>
  );
}

function DeploysList({
  deploys,
  currentShaShort,
}: {
  deploys: DeployItem[];
  currentShaShort: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {deploys.map((d) => {
        const isCurrent =
          currentShaShort !== null && d.commitShaShort === currentShaShort;
        return (
          <div
            key={d.uid}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto",
              alignItems: "center",
              gap: "var(--s-4)",
              padding: "var(--s-3) 0",
              borderTop: "1px solid var(--border)",
            }}
          >
            {/* Estado + tipo */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minWidth: 90,
              }}
            >
              <Badge tone={deployStateTone(d.state)} size="md" dot>
                {deployStateLabel(d.state)}
              </Badge>
              <span
                style={{
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color:
                    d.type === "production"
                      ? "var(--wine)"
                      : "var(--ink-mute)",
                  fontWeight: 700,
                }}
              >
                {d.type === "production" ? "Producción" : "Preview"}
              </span>
            </div>

            {/* Commit + autor */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--ink)",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={d.commitMessage ?? undefined}
              >
                {d.commitMessage ?? <em style={{ color: "var(--ink-mute)" }}>sin mensaje</em>}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-soft)",
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-2)",
                  flexWrap: "wrap",
                }}
              >
                {d.commitShaShort && (
                  <code
                    style={{
                      fontFamily: "var(--f-mono)",
                      background: isCurrent
                        ? "var(--success-bg)"
                        : "var(--bg-elevated)",
                      color: isCurrent ? "var(--success)" : "var(--ink-mute)",
                      padding: "1px 5px",
                      borderRadius: "var(--r-xs)",
                      fontWeight: 600,
                    }}
                    title={isCurrent ? "Este es el commit que estás viendo" : undefined}
                  >
                    {d.commitShaShort}
                    {isCurrent && " ←"}
                  </code>
                )}
                {d.branch && (
                  <span style={{ color: "var(--ink-mute)" }}>
                    {d.branch}
                  </span>
                )}
                {d.author && (
                  <span style={{ color: "var(--ink-mute)" }}>
                    · {d.author}
                  </span>
                )}
              </div>
            </div>

            {/* Tiempo */}
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-soft)",
                whiteSpace: "nowrap",
              }}
            >
              {relativeTime(d.createdAt)}
            </div>

            {/* Link */}
            <a
              href={`https://${d.url}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--info)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                whiteSpace: "nowrap",
              }}
            >
              Abrir <span aria-hidden>↗</span>
            </a>
          </div>
        );
      })}
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          margin: "0 0 var(--s-4) 0",
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {action}
      </div>
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
