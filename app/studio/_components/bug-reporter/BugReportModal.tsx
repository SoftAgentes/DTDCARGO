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

import { usePathname } from "next/navigation"; import { useEffect, useMemo, useState, useRef } from "react";
import { useActionState } from "react";
import { createBugAction } from "@/app/studio/(app)/mis-bugs/actions";
import {
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
import { useT, useLocale, type I18nKey } from "@/lib/i18n";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";

const BUG_CATEGORY_KEY: Record<BugCategory, I18nKey> = {
  error: "bug.category.error",
  improve: "bug.category.improve",
  suggest: "bug.category.suggest",
  question: "bug.category.question",
};
const BUG_SEVERITY_KEY: Record<BugSeverity, I18nKey> = {
  baja: "bug.severity.baja",
  media: "bug.severity.media",
  alta: "bug.severity.alta",
  critica: "bug.severity.critica",
};

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
  const t = useT();
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const moduleSlug = useMemo(() => moduleSlugFromPathname(pathname), [pathname]);
  const moduleLabel = moduleLabelFromSlug(moduleSlug, locale);

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

  // SDD-0290 · el `useEffect` propio sólo cubría Escape. `useDialogA11y` trae
  // además focus-trap, foco inicial y restauración (WCAG 2.1.2 / 2.4.3), y su
  // Escape respeta `pending` igual. Dos manejadores habrían competido.
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, { onClose, pending: isPending });

  // Snapshot del capture singleton (SDD-0036 Fase 4):
  // browser_info + environment + console_logs + network_requests, todos
  // sanitizados por bug-sanitizer. Captura al mount del modal. Si el user
  // abre modal y espera mucho antes de submit, el snapshot puede quedar
  // "viejo" — V2 podría re-snapshot on-submit. V1 acepta este trade-off.
  const [captureSnapshot] = useState(() => {
    if (typeof window === "undefined") {
      return {
        currentUrl: "",
        browserInfo: "{}",
        environment: "{}",
        consoleLogs: "[]",
        networkRequests: "[]",
      };
    }
    const snapshot = getBugTechCapture().getSnapshot();
    return {
      currentUrl: window.location.href,
      browserInfo: JSON.stringify({
        userAgent: navigator.userAgent,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        pixelRatio: window.devicePixelRatio,
      }),
      environment: JSON.stringify(snapshot.environment),
      consoleLogs: JSON.stringify(snapshot.console_logs),
      networkRequests: JSON.stringify(snapshot.network_requests),
    };
  });
  const { browserInfo, environment, consoleLogs, networkRequests, currentUrl } =
    captureSnapshot;

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
        ref={panelRef}
        tabIndex={-1}
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
              {t("bug.modal.title")}
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                color: "var(--ink-soft, #6B6B6B)",
                fontSize: 13,
              }}
            >
              {t("bug.modal.subtitle", { module: moduleLabel })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !isPending && onClose()}
            aria-label={t("bug.modal.close_aria")}
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
              {state.duplicated
                ? t("bug.modal.success_duplicated")
                : t("bug.modal.success_new")}
            </h3>
            <p style={{ margin: 0, color: "var(--ink-soft)" }}>
              {(state.duplicated
                ? t("bug.modal.success_duplicated_desc", { folio: state.folio ?? "" })
                : t("bug.modal.success_new_desc", { folio: state.folio ?? "" })
              )
                /* Centinela que NUNCA aparece en el texto: sin folio no
                   hay nada que resaltar y el mensaje no se debe partir.
                   🔴 NO cambiar a "": `split("")` parte el string en
                   CARACTERES y renderiza un <span> por letra.
                   (SDD-0290: acá había un byte NUL CRUDO en el fuente, que
                   hacía que grep tratara el archivo como binario y lo
                   saltara en todo barrido de texto del repo. Mismo valor
                   en runtime, ahora escapado.) */
                .split(state.folio ?? "\0")
                .map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <code
                        style={{
                          fontFamily: "var(--font-mono, 'JetBrains Mono')",
                          color: "var(--wine-text)",
                          fontWeight: 700,
                        }}
                      >
                        {state.folio}
                      </code>
                    )}
                  </span>
                ))}
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
            {/* Locale del reporter al momento del envío · sirve al triage VE
                para saber si esperar texto CN o ES (col bug_reports.reporter_locale,
                migración 0052). */}
            <input type="hidden" name="reporter_locale" value={locale} />

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
                {t("bug.modal.category_legend")}
              </legend>
              <div
                role="radiogroup"
                aria-label={t("bug.modal.category_aria")}
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
                    label={t(BUG_CATEGORY_KEY[c])}
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
                  {t("bug.modal.severity_legend")}
                </legend>
                <div
                  role="radiogroup"
                  aria-label={t("bug.modal.severity_aria")}
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
                      label={t(BUG_SEVERITY_KEY[s])}
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
                {t("bug.modal.title_label")}
              </label>
              <input
                id="bug-title"
                name="title"
                type="text"
                required
                minLength={4}
                maxLength={200}
                placeholder={t("bug.modal.title_placeholder")}
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
                {t("bug.modal.description_label")}
              </label>
              <textarea
                id="bug-description"
                name="description"
                required
                minLength={10}
                maxLength={4000}
                rows={5}
                placeholder={t("bug.modal.description_placeholder")}
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

            {/* Traducción al español · solo visible si reporter está en zh-CN.
                Ayuda al triage VE a procesar bugs de la oficina CN sin demora.
                Campo opcional. V1 manual · V2 auto-traducción LLM. */}
            {locale === "zh-CN" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="bug-translation"
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--ink-soft)",
                  }}
                >
                  {t("bug.modal.translation_label")}
                </label>
                <textarea
                  id="bug-translation"
                  name="translation_es"
                  rows={3}
                  maxLength={4000}
                  placeholder={t("bug.modal.translation_placeholder")}
                  disabled={isPending}
                  style={{
                    width: "100%",
                    padding: 12,
                    border: "1px solid var(--border, #E8E6E2)",
                    borderRadius: 6,
                    background: "var(--bg-base)",
                    color: "var(--ink)",
                    fontFamily: "inherit",
                    fontSize: 14,
                    outline: "none",
                    resize: "vertical",
                    minHeight: 70,
                  }}
                />
              </div>
            )}

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
                <strong style={{ color: "var(--ink)" }}>
                  {t("bug.modal.attached_label_module")}
                </strong>{" "}
                {moduleLabel}
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
                  <strong style={{ color: "var(--ink)" }}>
                    {t("bug.modal.attached_label_url")}
                  </strong>{" "}
                  {currentUrl}
                </div>
              )}
              {buildSha && (
                <div>
                  <strong style={{ color: "var(--ink)" }}>
                    {t("bug.modal.attached_label_build")}
                  </strong>{" "}
                  <code style={{ fontFamily: "var(--font-mono, monospace)" }}>
                    {buildSha.slice(0, 8)}
                  </code>
                </div>
              )}
            </div>

            {/* Error global · ErrorAlert prioriza errorCode traducido. */}
            <ErrorAlert state={state} />
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
              {t("bug.modal.cancel")}
            </button>
            <button
              type="submit"
              form="bug-report-form"
              disabled={isPending}
              className="studio-btn studio-btn-primary"
            >
              {isPending
                ? t("bug.modal.submit_loading")
                : t("bug.modal.submit_idle")}
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
