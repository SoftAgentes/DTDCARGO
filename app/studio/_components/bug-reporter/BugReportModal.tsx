"use client";

/**
 * BugReportModal · form de reporte de bug (SDD-0036 Fase 2).
 *
 * Se invoca desde BugFABButton. Auto-detecta:
 *   - module (de pathname via moduleSlugFromPathname)
 *   - url (window.location.href)
 *   - browser_info (navigator.userAgent + viewport)
 *   - environment (locale + timezone)
 *
 * No captura console_logs / network_requests / replay todavía (eso es Fase 4).
 *
 * Submit via server action createBugAction (useActionState pattern).
 *
 * Brand: Archivo, tokens var(--*), chip selector para category + severity,
 * sentence case en CTAs, sin emojis.
 */

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { createBugAction } from "@/app/studio/(app)/mis-bugs/actions";
import {
  BUG_CATEGORY_LABELS,
  BUG_SEVERITY_LABELS,
  type BugActionState,
  type BugCategory,
  type BugSeverity,
} from "@/lib/studio/bug-types";
import {
  moduleLabelFromSlug,
  moduleSlugFromPathname,
} from "@/lib/studio/bug-module-name";
import { getBugTechCapture } from "@/lib/studio/bug-tech-capture";
import { getBugRrwebCapture } from "@/lib/studio/bug-rrweb-capture";

interface BugReportModalProps {
  onClose: () => void;
  buildSha: string | null;
}

/**
 * Best-effort upload del rrweb replay al endpoint POST /replay.
 * Si no hay buffer (ej: rrweb no instaló) o falla el upload, NO rompe el
 * flow del bug — solo log. El bug queda sin replay.
 */
async function uploadReplayBestEffort(bugId: string): Promise<void> {
  try {
    const rrweb = getBugRrwebCapture();
    const serialized = await rrweb.serializeToBlob();
    if (!serialized) {
      // sin eventos, nada que subir
      return;
    }
    const fd = new FormData();
    fd.append(
      "replay",
      new File([serialized.blob], `replay.${serialized.extension}`, {
        type: serialized.contentType,
      }),
    );
    const res = await fetch(`/api/studio/bugs/${bugId}/replay`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `[BugReportModal] replay upload failed: HTTP ${res.status}`,
        txt,
      );
      return;
    }
    rrweb.reset(); // buffer post-submit (next bug captures fresh window)
  } catch (err) {
    console.error("[BugReportModal] replay upload error:", err);
  }
}

const CATEGORIES: BugCategory[] = ["error", "improve", "suggest", "question"];
const SEVERITIES: BugSeverity[] = ["baja", "media", "alta", "critica"];

const INITIAL_STATE: BugActionState = {};

export function BugReportModal({ onClose, buildSha }: BugReportModalProps) {
  const pathname = usePathname() ?? "/";
  const moduleSlug = useMemo(() => moduleSlugFromPathname(pathname), [pathname]);
  const moduleLabel = moduleLabelFromSlug(moduleSlug);

  const [category, setCategory] = useState<BugCategory>("error");
  const [severity, setSeverity] = useState<BugSeverity>("media");
  const [state, formAction, isPending] = useActionState<BugActionState, FormData>(
    createBugAction,
    INITIAL_STATE,
  );

  // Auto-cerrar al éxito + subir replay rrweb (best-effort, no bloquea)
  useEffect(() => {
    if (state.ok && state.bugId) {
      uploadReplayBestEffort(state.bugId);
      const t = window.setTimeout(() => onClose(), 1800);
      return () => window.clearTimeout(t);
    }
  }, [state.ok, state.bugId, onClose]);

  // Escape para cerrar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPending, onClose]);

  // Snapshot del capture singleton (SDD-0036 Fase 4):
  // browser_info + environment + console_logs + network_requests, todos
  // sanitizados por bug-sanitizer. Captura al mount del modal. Si el user
  // abre modal y espera mucho antes de submit, el snapshot puede quedar
  // "viejo" — V2 podría re-snapshot on-submit. V1 acepta este trade-off.
  const [browserInfo, setBrowserInfo] = useState<string>("{}");
  const [environment, setEnvironment] = useState<string>("{}");
  const [consoleLogs, setConsoleLogs] = useState<string>("[]");
  const [networkRequests, setNetworkRequests] = useState<string>("[]");
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    setCurrentUrl(window.location.href);
    setBrowserInfo(
      JSON.stringify({
        userAgent: navigator.userAgent,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        pixelRatio: window.devicePixelRatio,
      }),
    );
    const snapshot = getBugTechCapture().getSnapshot();
    setEnvironment(JSON.stringify(snapshot.environment));
    setConsoleLogs(JSON.stringify(snapshot.console_logs));
    setNetworkRequests(JSON.stringify(snapshot.network_requests));
  }, []);

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--s-4, 16px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-modal-title"
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          color: "var(--ink)",
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "var(--s-5, 20px) var(--s-6, 24px)",
            borderBottom: "1px solid var(--border, #E8E6E2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--s-3, 12px)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              id="bug-modal-title"
              style={{
                margin: 0,
                fontFamily: "var(--font-archivo-black, 'Archivo Black')",
                fontSize: 20,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              Reportar
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                color: "var(--ink-soft, #6B6B6B)",
                fontSize: 13,
              }}
            >
              Estás en <strong style={{ color: "var(--ink)" }}>{moduleLabel}</strong>.
              Adjuntamos URL + entorno técnico automáticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !isPending && onClose()}
            aria-label="Cerrar"
            disabled={isPending}
            style={{
              background: "transparent",
              border: "none",
              padding: 8,
              cursor: isPending ? "wait" : "pointer",
              color: "var(--ink-soft)",
              borderRadius: 6,
              lineHeight: 0,
            }}
            onMouseEnter={(e) => {
              if (!isPending) e.currentTarget.style.background = "var(--bg-elevated, #F2F0EC)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <CloseIcon size={18} />
          </button>
        </header>

        {/* Success state */}
        {state.ok && (
          <div
            style={{
              padding: "var(--s-6, 24px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "var(--s-3, 12px)",
            }}
          >
            <CheckCircle size={48} color="var(--success, #1F8A5B)" />
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--font-archivo-black, 'Archivo Black')",
                fontSize: 18,
              }}
            >
              {state.duplicated ? "Ya estaba reportado" : "Reporte recibido"}
            </h3>
            <p style={{ margin: 0, color: "var(--ink-soft)" }}>
              {state.duplicated ? (
                <>
                  Sumamos al contador del bug{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono')",
                      color: "var(--wine)",
                      fontWeight: 700,
                    }}
                  >
                    {state.folio}
                  </code>
                  . Gracias por avisar.
                </>
              ) : (
                <>
                  Tu bug es{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono')",
                      color: "var(--wine)",
                      fontWeight: 700,
                    }}
                  >
                    {state.folio}
                  </code>
                  . Te avisamos cuando avancemos.
                </>
              )}
            </p>
          </div>
        )}

        {/* Form */}
        {!state.ok && (
          <form
            action={formAction}
            id="bug-report-form"
            style={{
              flex: 1,
              overflow: "auto",
              padding: "var(--s-5, 20px) var(--s-6, 24px)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4, 16px)",
            }}
          >
            {/* Hidden fields auto-captured (D3: invisible al user) */}
            <input type="hidden" name="module" value={moduleSlug} />
            <input type="hidden" name="url" value={currentUrl} />
            <input type="hidden" name="build_sha" value={buildSha ?? ""} />
            <input type="hidden" name="browser_info" value={browserInfo} />
            <input type="hidden" name="environment" value={environment} />
            {/* Tech capture · sanitizados por bug-sanitizer.ts (SDD-0036 Fase 4) */}
            <input type="hidden" name="console_logs" value={consoleLogs} />
            <input type="hidden" name="network_requests" value={networkRequests} />
            <input type="hidden" name="category" value={category} />
            {category === "error" && (
              <input type="hidden" name="severity" value={severity} />
            )}

            {/* Categoría */}
            <fieldset
              style={{
                border: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-2, 8px)",
              }}
            >
              <legend
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-soft)",
                  marginBottom: 4,
                }}
              >
                Tipo de reporte
              </legend>
              <div
                role="radiogroup"
                aria-label="Categoría"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "var(--s-2, 8px)",
                }}
              >
                {CATEGORIES.map((c) => (
                  <ChipButton
                    key={c}
                    active={category === c}
                    onClick={() => setCategory(c)}
                    label={BUG_CATEGORY_LABELS[c]}
                  />
                ))}
              </div>
            </fieldset>

            {/* Severity (only if error) */}
            {category === "error" && (
              <fieldset
                style={{
                  border: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-2, 8px)",
                }}
              >
                <legend
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--ink-soft)",
                    marginBottom: 4,
                  }}
                >
                  Severidad
                </legend>
                <div
                  role="radiogroup"
                  aria-label="Severidad"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "var(--s-2, 8px)",
                  }}
                >
                  {SEVERITIES.map((s) => (
                    <ChipButton
                      key={s}
                      active={severity === s}
                      onClick={() => setSeverity(s)}
                      label={BUG_SEVERITY_LABELS[s]}
                      compact
                    />
                  ))}
                </div>
              </fieldset>
            )}

            {/* Título */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                htmlFor="bug-title"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-soft)",
                }}
              >
                Título
              </label>
              <input
                id="bug-title"
                name="title"
                type="text"
                required
                minLength={4}
                maxLength={200}
                placeholder="Resumen corto del problema"
                disabled={isPending}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  border: state.fieldErrors?.title
                    ? "1px solid var(--danger, #A8323E)"
                    : "1px solid var(--border, #E8E6E2)",
                  borderRadius: 6,
                  background: "var(--bg-base)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              {state.fieldErrors?.title && (
                <span style={{ color: "var(--danger)", fontSize: 12 }}>
                  {state.fieldErrors.title}
                </span>
              )}
            </div>

            {/* Descripción */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                htmlFor="bug-description"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-soft)",
                }}
              >
                Descripción
              </label>
              <textarea
                id="bug-description"
                name="description"
                required
                minLength={10}
                maxLength={4000}
                rows={5}
                placeholder="Qué intentabas hacer, qué pasó, qué esperabas que pasara."
                disabled={isPending}
                style={{
                  width: "100%",
                  padding: 12,
                  border: state.fieldErrors?.description
                    ? "1px solid var(--danger, #A8323E)"
                    : "1px solid var(--border, #E8E6E2)",
                  borderRadius: 6,
                  background: "var(--bg-base)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  minHeight: 100,
                }}
              />
              {state.fieldErrors?.description && (
                <span style={{ color: "var(--danger)", fontSize: 12 }}>
                  {state.fieldErrors.description}
                </span>
              )}
            </div>

            {/* Info adjunta automáticamente */}
            <div
              style={{
                padding: "var(--s-3, 12px) var(--s-4, 16px)",
                background: "var(--bg-elevated, #F2F0EC)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--ink-soft)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div>
                <strong style={{ color: "var(--ink)" }}>Módulo:</strong> {moduleLabel}
              </div>
              {currentUrl && (
                <div
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={currentUrl}
                >
                  <strong style={{ color: "var(--ink)" }}>URL:</strong> {currentUrl}
                </div>
              )}
              {buildSha && (
                <div>
                  <strong style={{ color: "var(--ink)" }}>Build:</strong>{" "}
                  <code style={{ fontFamily: "var(--font-mono, monospace)" }}>
                    {buildSha.slice(0, 8)}
                  </code>
                </div>
              )}
            </div>

            {/* Error global */}
            {state.error && (
              <div
                style={{
                  padding: "var(--s-3, 12px) var(--s-4, 16px)",
                  background: "var(--danger-bg, #FCEDED)",
                  border: "1px solid var(--danger, #A8323E)",
                  borderRadius: 6,
                  color: "var(--danger, #A8323E)",
                  fontSize: 13,
                }}
                role="alert"
              >
                {state.error}
              </div>
            )}
          </form>
        )}

        {/* Footer */}
        {!state.ok && (
          <footer
            style={{
              padding: "var(--s-4, 16px) var(--s-6, 24px)",
              borderTop: "1px solid var(--border, #E8E6E2)",
              display: "flex",
              gap: "var(--s-3, 12px)",
              justifyContent: "flex-end",
              background: "var(--bg-surface)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="studio-btn studio-btn-ghost"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="bug-report-form"
              disabled={isPending}
              className="studio-btn studio-btn-primary"
            >
              {isPending ? "Enviando…" : "Enviar reporte"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function ChipButton({
  active,
  onClick,
  label,
  compact = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        height: compact ? 32 : 38,
        padding: `0 ${compact ? 8 : 12}px`,
        border: active
          ? "1px solid var(--wine, #7F0F1A)"
          : "1px solid var(--border, #E8E6E2)",
        background: active ? "var(--wine-tint, #FBE9EC)" : "var(--bg-surface)",
        color: active ? "var(--wine, #7F0F1A)" : "var(--ink)",
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: compact ? 12 : 13,
        fontWeight: active ? 600 : 500,
        transition: "all var(--dur, 180ms) var(--ease, ease-out)",
      }}
    >
      {label}
    </button>
  );
}

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function CheckCircle({ size = 48, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}
