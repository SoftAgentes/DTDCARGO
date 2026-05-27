"use client";

/**
 * RulesView · lista de mail_rules con drawer crear/editar (SDD-0026 Fase 3c).
 *
 * Click row → drawer en modo edit. Click "+ Nueva regla" → drawer en modo crear.
 * NOTE: las reglas creadas NO se disparan automáticamente — el runtime
 * engine que watch los eventos (shipment_created, invoice_emitted, etc.)
 * todavía no existe. Las reglas son data por ahora · cuando implementemos
 * el watcher, va a leer esta tabla y disparar sendEmail.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  RULE_EVENT_LABELS,
  ruleEventBadgeTone,
  type MailRuleWithTemplate,
  type MailTemplate,
} from "@/lib/studio/mail-types";
import { RuleEditorDrawer } from "./RuleEditorDrawer";

interface Props {
  rules: MailRuleWithTemplate[];
  templates: MailTemplate[];
}

const RECIPIENT_LABEL: Record<string, string> = {
  client: "Cliente del evento",
  internal: "Email interno (mail_config)",
  custom: "Email custom",
};

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

export function RulesView({ rules, templates }: Props) {
  const router = useRouter();
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const openRule = openRuleId ? rules.find((r) => r.id === openRuleId) ?? null : null;

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--ink-soft)",
            maxWidth: "60ch",
          }}
        >
          Configurá reglas para disparar emails automáticos cuando ocurre un
          evento (ej: al crear un embarque, mandar shipment_created al cliente).
          El runtime engine que escucha los eventos está pendiente — por ahora
          las reglas guardan data pero no disparan.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="studio-btn studio-btn-primary studio-btn-sm"
        >
          + Nueva regla
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          eyebrow="Sin reglas"
          title="No hay reglas configuradas"
          description="Click '+ Nueva regla' para crear la primera. Ej: 'cuando se crea un embarque, mandar shipment_created al cliente'."
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated, #F2F0EC)" }}>
                <Th>Evento</Th>
                <Th>Template</Th>
                <Th>Destinatario</Th>
                <Th>Disparos</Th>
                <Th>Activa</Th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const tone = ruleEventBadgeTone(r.event);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpenRuleId(r.id)}
                    style={{
                      borderTop: "1px solid var(--border, #E8E6E2)",
                      cursor: "pointer",
                      transition: "background var(--dur, 180ms)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-elevated)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <Td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          background: TONE_BG[tone],
                          color: TONE_FG[tone],
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 4,
                        }}
                      >
                        {RULE_EVENT_LABELS[r.event]}
                      </span>
                    </Td>
                    <Td>
                      {r.template ? (
                        <div>
                          <div style={{ color: "var(--ink)" }}>{r.template.name}</div>
                          <code
                            style={{
                              fontFamily: "var(--font-mono, 'JetBrains Mono')",
                              fontSize: 10,
                              color: "var(--ink-soft)",
                            }}
                          >
                            {r.template.slug}
                          </code>
                        </div>
                      ) : (
                        <span style={{ color: "var(--danger)" }}>(template borrado)</span>
                      )}
                    </Td>
                    <Td>
                      <div style={{ color: "var(--ink)" }}>
                        {RECIPIENT_LABEL[r.recipient_kind] ?? r.recipient_kind}
                      </div>
                      {r.recipient_kind === "custom" && r.recipient_value && (
                        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                          {r.recipient_value}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span style={{ color: "var(--ink-soft)" }}>
                        {r.trigger_count}
                      </span>
                    </Td>
                    <Td>
                      {r.active ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            background: "var(--success-bg, #E5F4ED)",
                            color: "var(--success, #1F8A5B)",
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 4,
                          }}
                        >
                          Activa
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            background: "var(--neutral-bg, #F2F0EC)",
                            color: "var(--ink-soft)",
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 4,
                          }}
                        >
                          Inactiva
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <RuleEditorDrawer
          mode="create"
          templates={templates}
          onClose={() => setCreating(false)}
          onMutated={() => router.refresh()}
        />
      )}
      {openRule && (
        <RuleEditorDrawer
          mode="edit"
          rule={openRule}
          templates={templates}
          onClose={() => setOpenRuleId(null)}
          onMutated={() => router.refresh()}
        />
      )}
    </>
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
    <td style={{ padding: "12px 12px", verticalAlign: "top" }}>{children}</td>
  );
}
