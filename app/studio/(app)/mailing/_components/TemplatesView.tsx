"use client";

/**
 * TemplatesView · lista de mail_templates con drawer editor (SDD-0026 Fase 3b).
 *
 * Click row → drawer con form (subject, body_html, active) + variables
 * detectadas + botón "Mandar prueba" que dispara sendEmail con sample vars.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { MailTemplate } from "@/lib/studio/mail-types";
import { TemplateEditorDrawer } from "./TemplateEditorDrawer";

interface Props {
  templates: MailTemplate[];
}

const CATEGORY_LABELS: Record<string, string> = {
  comercial: "Comercial",
  cobranza: "Cobranza",
  operativo: "Operativo",
  cliente: "Cliente",
  interno: "Interno",
  sistema: "Sistema",
};

export function TemplatesView({ templates }: Props) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const openTpl = openId ? templates.find((t) => t.id === openId) ?? null : null;

  if (templates.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin templates"
        title="No hay templates en este tenant"
        description="Corré `pnpm seed` para seedear los 10 templates oficiales."
      />
    );
  }

  return (
    <>
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
              <Th>Slug</Th>
              <Th>Nombre</Th>
              <Th>Categoría</Th>
              <Th>Subject</Th>
              <Th>Variables</Th>
              <Th>Activo</Th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr
                key={t.id}
                onClick={() => setOpenId(t.id)}
                style={{
                  borderTop: "1px solid var(--border, #E8E6E2)",
                  cursor: "pointer",
                  transition: "background var(--dur, 180ms)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-elevated, #F2F0EC)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <Td>
                  <code
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono')",
                      fontSize: 11,
                      color: "var(--wine, #7F0F1A)",
                      padding: "2px 6px",
                      background: "var(--wine-tint, #FBE9EC)",
                      borderRadius: 4,
                    }}
                  >
                    {t.slug}
                  </code>
                </Td>
                <Td>
                  <span style={{ color: "var(--ink)" }}>{t.name}</span>
                </Td>
                <Td>
                  <span style={{ color: "var(--ink-soft)" }}>
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </span>
                </Td>
                <Td>
                  <div
                    style={{
                      color: "var(--ink)",
                      maxWidth: 360,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={t.subject}
                  >
                    {t.subject}
                  </div>
                </Td>
                <Td>
                  <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                    {t.variables.length}
                  </span>
                </Td>
                <Td>
                  {t.active ? (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        background: "var(--success-bg, #E5F4ED)",
                        color: "var(--success, #1F8A5B)",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderRadius: 4,
                      }}
                    >
                      Activo
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        background: "var(--neutral-bg, #F2F0EC)",
                        color: "var(--ink-soft, #6B6B6B)",
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderRadius: 4,
                      }}
                    >
                      Inactivo
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openTpl && (
        <TemplateEditorDrawer
          template={openTpl}
          onClose={() => setOpenId(null)}
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
