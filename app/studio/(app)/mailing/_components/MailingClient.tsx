"use client";

/**
 * MailingClient · orquestador del módulo Mailing admin (SDD-0026 Fase 3a).
 *
 * 3 tabs: Logs · Templates · Reglas. Por ahora solo Logs implementado.
 * Templates y Reglas son placeholders con próximamente.
 */

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type {
  MailRuleWithTemplate,
  MailScheduled,
  MailSignature,
  MailTemplate,
} from "@/lib/studio/mail-types";
import {
  MAIL_LOG_STATUS_LABEL,
  MAIL_LOG_STATUS_TONE,
  type MailBlacklistRow,
  type MailConfigRow,
  type MailLogRow,
  type MailLogStatus,
  type MailingAdminTab,
  type MailingFilters,
  type SignatureTeamMember,
} from "./mailing-types";
import { TemplatesView } from "./TemplatesView";
import { SignaturesView } from "./SignaturesView";
import { ComposeView } from "./ComposeView";
import { ScheduledView } from "./ScheduledView";
import { RulesView } from "./RulesView";
import { ConfigView } from "./ConfigView";
import { BlacklistView } from "./BlacklistView";

interface Props {
  tab: MailingAdminTab;
  logs: MailLogRow[];
  templates: Array<{ slug: string; name: string }>;
  templatesFull: MailTemplate[];
  rules: MailRuleWithTemplate[];
  config: MailConfigRow | null;
  blacklist: MailBlacklistRow[];
  signatures: MailSignature[];
  composeSignatures: MailSignature[];
  members: SignatureTeamMember[];
  scheduled: MailScheduled[];
  filters: MailingFilters;
}

const TONE_BG: Record<string, string> = {
  success: "var(--success-bg, #E5F4ED)",
  warning: "var(--warning-bg, #FBF1DF)",
  danger: "var(--danger-bg, #FCEDED)",
  info: "var(--info-bg, #E5EEF9)",
  wine: "var(--wine-tint, #FBE9EC)",
  neutral: "var(--neutral-bg, #F2F0EC)",
};

const TONE_FG: Record<string, string> = {
  success: "var(--success, #1F8A5B)",
  warning: "var(--warning, #B8893A)",
  danger: "var(--danger, #A8323E)",
  info: "var(--info, #2A6FDB)",
  wine: "var(--wine, #7F0F1A)",
  neutral: "var(--ink-soft, #6B6B6B)",
};

const TABS: Array<{ value: MailingAdminTab; label: string }> = [
  { value: "templates", label: "Templates" },
  { value: "signatures", label: "Firmas" },
  { value: "compose", label: "Envío manual" },
  { value: "scheduled", label: "Programados" },
  { value: "reglas", label: "Reglas auto." },
  { value: "config", label: "Configuración" },
  { value: "logs", label: "Logs" },
];

export function MailingClient({
  tab,
  logs,
  templates,
  templatesFull,
  rules,
  config,
  blacklist,
  signatures,
  composeSignatures,
  members,
  scheduled,
  filters,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const setQp = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "all") sp.delete(key);
    else sp.set(key, value);
    startTransition(() => {
      router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  const changeTab = (newTab: MailingAdminTab) => {
    const sp = new URLSearchParams();
    if (newTab !== "templates") sp.set("tab", newTab);
    startTransition(() => {
      router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  return (
    <>
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Mailing"
        style={{
          display: "inline-flex",
          background: "var(--bg-elevated, #F2F0EC)",
          borderRadius: 8,
          padding: 4,
          gap: 2,
          marginBottom: 20,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => changeTab(t.value)}
            style={{
              padding: "8px 16px",
              border: "none",
              background:
                tab === t.value ? "var(--bg-surface, #FFFFFF)" : "transparent",
              color: tab === t.value ? "var(--ink)" : "var(--ink-soft)",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: tab === t.value ? 600 : 500,
              boxShadow: tab === t.value ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              transition: "all var(--dur, 180ms) var(--ease, ease-out)",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "templates" && <TemplatesView templates={templatesFull} />}

      {tab === "signatures" && (
        <SignaturesView signatures={signatures} members={members} />
      )}

      {tab === "compose" && (
        <ComposeView
          templates={templatesFull}
          signatures={composeSignatures}
        />
      )}

      {tab === "scheduled" && <ScheduledView scheduled={scheduled} />}

      {tab === "reglas" && (
        <RulesView rules={rules} templates={templatesFull} />
      )}

      {tab === "config" && (
        <>
          <ConfigView config={config} />
          <div style={{ marginTop: 24 }}>
            <BlacklistView blacklist={blacklist} />
          </div>
        </>
      )}

      {tab === "logs" && (
        <LogsView
          logs={logs}
          templates={templates}
          filters={filters}
          setQp={setQp}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// LogsView · tabla read-only de mail_logs con filters
// ─────────────────────────────────────────────────────────────

function LogsView({
  logs,
  templates,
  filters,
  setQp,
}: {
  logs: MailLogRow[];
  templates: Array<{ slug: string; name: string }>;
  filters: MailingFilters;
  setQp: (key: string, value: string | null) => void;
}) {
  return (
    <>
      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          alignItems: "flex-end",
        }}
      >
        <FilterSelect
          label="Estado"
          value={filters.status}
          onChange={(v) => setQp("status", v)}
          options={[
            { value: "all", label: "Todos" },
            ...Object.entries(MAIL_LOG_STATUS_LABEL).map(([v, l]) => ({
              value: v,
              label: l,
            })),
          ]}
        />
        <FilterSelect
          label="Template"
          value={filters.template}
          onChange={(v) => setQp("template", v)}
          options={[
            { value: "all", label: "Todos" },
            ...templates.map((t) => ({ value: t.slug, label: t.name })),
          ]}
        />
        <SearchInput
          value={filters.search}
          onChange={(v) => setQp("q", v)}
          placeholder="Buscar por email o subject…"
        />
        <div
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "var(--ink-soft)",
            paddingBottom: 8,
          }}
        >
          {logs.length} {logs.length === 1 ? "log" : "logs"}
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          eyebrow="Sin logs"
          title="No hay emails que mostrar"
          description="Cuando se mande el primer email del Studio (invitación, bug reporter, etc.), va a aparecer acá."
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface, #FFFFFF)",
            border: "1px solid var(--border, #E8E6E2)",
            borderRadius: 8,
            overflow: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: "var(--bg-elevated, #F2F0EC)" }}>
                <Th>Estado</Th>
                <Th>Destinatario</Th>
                <Th>Subject</Th>
                <Th>Template</Th>
                <Th>Enviado</Th>
                <Th>Entregado</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  style={{
                    borderTop: "1px solid var(--border, #E8E6E2)",
                  }}
                >
                  <Td>
                    <StatusBadge status={log.status} />
                    {log.error && (
                      <div
                        title={log.error}
                        style={{
                          fontSize: 11,
                          color: "var(--danger)",
                          marginTop: 2,
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.error}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div style={{ color: "var(--ink)" }}>{log.to_email}</div>
                    {log.to_name && (
                      <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                        {log.to_name}
                      </div>
                    )}
                    {(() => {
                      const origTo =
                        typeof log.metadata?.original_to === "string"
                          ? log.metadata.original_to
                          : null;
                      if (!origTo || origTo === log.to_email) return null;
                      return (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--warning, #B8893A)",
                          }}
                          title="Test mode redirigió este email del destinatario original al inbox interno de pruebas"
                        >
                          Test mode · orig: {origTo}
                        </div>
                      );
                    })()}
                  </Td>
                  <Td>
                    <div
                      style={{
                        color: "var(--ink)",
                        maxWidth: 320,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={log.subject}
                    >
                      {log.subject}
                    </div>
                  </Td>
                  <Td>
                    <code
                      style={{
                        fontFamily: "var(--font-mono, 'JetBrains Mono')",
                        fontSize: 11,
                        color: "var(--ink-soft)",
                        padding: "2px 6px",
                        background: "var(--bg-elevated)",
                        borderRadius: 4,
                      }}
                    >
                      {log.template_slug ?? "—"}
                    </code>
                  </Td>
                  <Td>
                    <RelTime iso={log.sent_at ?? log.created_at} />
                  </Td>
                  <Td>
                    {log.delivered_at ? (
                      <RelTime iso={log.delivered_at} />
                    ) : (
                      <span style={{ color: "var(--ink-soft)" }}>—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MailLogStatus }) {
  const tone = MAIL_LOG_STATUS_TONE[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        background: TONE_BG[tone],
        color: TONE_FG[tone],
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderRadius: 4,
      }}
    >
      {MAIL_LOG_STATUS_LABEL[status]}
    </span>
  );
}

function RelTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const label =
    diffMin < 1
      ? "ahora"
      : diffMin < 60
        ? `${diffMin}m`
        : diffMin < 1440
          ? `${Math.floor(diffMin / 60)}h`
          : `${Math.floor(diffMin / 1440)}d`;
  return (
    <span
      title={d.toLocaleString("es-VE")}
      style={{
        color: "var(--ink-soft)",
        cursor: "help",
        textDecoration: "underline dotted",
        textDecorationColor: "var(--ink-mute, #B5B5B5)",
        textUnderlineOffset: 3,
      }}
    >
      {label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 12px",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--ink-soft)",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "12px 12px",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 160,
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 36,
          padding: "0 28px 0 10px",
          border: "1px solid var(--border, #E8E6E2)",
          borderRadius: 6,
          background: "var(--bg-surface, #FFFFFF)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 280,
        flex: 1,
        maxWidth: 420,
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        Buscar
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 36,
          padding: "0 12px",
          border: "1px solid var(--border, #E8E6E2)",
          borderRadius: 6,
          background: "var(--bg-surface, #FFFFFF)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 13,
          outline: "none",
        }}
      />
    </label>
  );
}
