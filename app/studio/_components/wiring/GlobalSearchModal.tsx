"use client";

/**
 * GlobalSearchModal — buscador global ⌘K del Studio (SDD-0135).
 *
 * Reemplaza el `SearchPlaceholderModal` de la topbar. Busca as-you-type
 * (debounce ~250ms, race token) vía `searchGlobalAction` — server action que
 * hace el fan-out permission-aware. El modal NO decide permisos: solo pinta lo
 * que el server devuelve (grupos ejecutados + facetas con candado).
 *
 * UX (spec §4):
 *   - Resultados agrupados por faceta: operativo primero, dinero después,
 *     candado (facetas restringidas) al final con nota genérica.
 *   - Chips de scope para estrechar a una faceta.
 *   - Teclado: ↑/↓ recorre TODOS los hits, Enter navega, Esc cierra.
 *   - Vacío = búsquedas recientes (localStorage).
 *
 * Solo tokens `var(--*)`. Accesible: role="dialog", listbox/option, aria-*.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "../icons";
import { useT } from "@/lib/i18n";
import { useIsMac } from "../ui/usePlatformMod";
import {
  searchGlobalAction,
} from "@/lib/studio/global-search/search-action";
import type {
  GlobalSearchFacetId,
  GlobalSearchHit,
  GlobalSearchResult,
} from "@/lib/studio/global-search/types";
import { FACETS } from "@/lib/studio/global-search/facets";

const DEBOUNCE_MS = 250;
const RECENTS_KEY = "dtd.studio.search.recents";
const RECENTS_MAX = 6;

const FACET_ICON: Record<GlobalSearchFacetId, IconName> = {
  clients: "users",
  shipments: "box",
  quotes: "calc",
  invoices: "invoice",
  payments: "tag",
};

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string) {
  if (typeof window === "undefined") return;
  const t = term.trim();
  if (t.length < 2) return;
  const next = [t, ...readRecents().filter((x) => x !== t)].slice(0, RECENTS_MAX);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* localStorage lleno / bloqueado — no es crítico */
  }
}

export function GlobalSearchModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const isMac = useIsMac();
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<GlobalSearchFacetId | null>(null);
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef(0);
  const listboxId = useId();

  useEffect(() => {
    setRecents(readRecents());
    inputRef.current?.focus();
  }, []);

  const runSearch = useCallback(
    async (term: string, facet: GlobalSearchFacetId | null) => {
      const trimmed = term.trim();
      if (trimmed.length < 2) {
        setResult(null);
        setLoading(false);
        return;
      }
      const myReq = ++reqRef.current;
      setLoading(true);
      const res = await searchGlobalAction(trimmed, facet ?? undefined);
      if (myReq !== reqRef.current) return; // respuesta obsoleta
      setResult(res);
      setActive(0);
      setLoading(false);
    },
    [],
  );

  // Debounce de la búsqueda al cambiar value / scope.
  useEffect(() => {
    const id = setTimeout(() => void runSearch(value, scope), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, scope, runSearch]);

  // Lista plana de hits (para navegación por teclado a través de grupos).
  const flatHits: GlobalSearchHit[] = useMemo(
    () => (result?.groups ?? []).flatMap((g) => g.hits),
    [result],
  );

  // Mantener el hit activo a la vista al recorrer con ↑/↓ (listas largas).
  useEffect(() => {
    if (flatHits.length === 0) return;
    document
      .getElementById(`${listboxId}-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, flatHits.length, listboxId]);

  const go = useCallback(
    (hit: GlobalSearchHit) => {
      pushRecent(value);
      onClose();
      router.push(hit.href);
    },
    [value, onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (flatHits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flatHits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? flatHits.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flatHits[active];
      if (hit) go(hit);
    }
  };

  const showRecents = value.trim().length < 2;
  const noResults =
    !loading &&
    !showRecents &&
    result != null &&
    result.groups.length === 0 &&
    result.locked.length === 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim-soft)",
        zIndex: 100,
        display: "grid",
        placeItems: "start center",
        paddingTop: "12vh",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("chrome.search.dialog_aria")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: "min(600px, 92vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-pop)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        {/* Input */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
            {Icon.search(16)}
          </span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("chrome.search.placeholder")}
            role="combobox"
            aria-expanded={flatHits.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              flatHits.length > 0 ? `${listboxId}-opt-${active}` : undefined
            }
            autoComplete="off"
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: "transparent",
              font: "500 14px/1 var(--f-sans)",
              color: "var(--ink)",
            }}
          />
          {loading && (
            <span
              style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}
            >
              {t("chrome.search.searching")}
            </span>
          )}
          <kbd
            style={{
              padding: "2px 6px",
              borderRadius: "var(--r-sm)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              font: "600 10px/1.3 var(--f-mono)",
              color: "var(--ink-soft)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Chips de scope */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 18px",
            borderBottom: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          <ScopeChip
            label={t("chrome.search.scope_all")}
            active={scope === null}
            onClick={() => setScope(null)}
          />
          {FACETS.map((f) => (
            <ScopeChip
              key={f.id}
              label={t(`chrome.search.facet.${f.id}`)}
              active={scope === f.id}
              onClick={() => setScope((s) => (s === f.id ? null : f.id))}
            />
          ))}
        </div>

        {/* Cuerpo */}
        <div
          id={listboxId}
          role="listbox"
          aria-label={t("chrome.search.dialog_aria")}
          style={{ overflowY: "auto", padding: "8px 8px 12px" }}
        >
          {showRecents ? (
            <RecentsBlock
              recents={recents}
              onPick={(term) => setValue(term)}
              emptyHint={t("chrome.search.empty_hint")}
              title={t("chrome.search.recents")}
            />
          ) : (
            <>
              {result?.groups.map((grp) => (
                <FacetBlock
                  key={grp.facet}
                  label={t(`chrome.search.facet.${grp.facet}`)}
                  icon={FACET_ICON[grp.facet]}
                >
                  {grp.hits.map((hit) => {
                    const idx = flatHits.indexOf(hit);
                    return (
                      <HitRow
                        key={`${hit.facet}-${hit.id}`}
                        hit={hit}
                        active={idx === active}
                        optionId={`${listboxId}-opt-${idx}`}
                        onHover={() => setActive(idx)}
                        onSelect={() => go(hit)}
                      />
                    );
                  })}
                </FacetBlock>
              ))}

              {noResults && (
                <div
                  style={{
                    padding: "18px",
                    textAlign: "center",
                    font: "500 13px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {t("chrome.search.no_results")}
                </div>
              )}

              {/* Candado al final: facetas restringidas por permiso. */}
              {result && result.locked.length > 0 && (
                <LockedBlock
                  facetLabels={result.locked.map((l) =>
                    t(`chrome.search.facet.${l.facet}`),
                  )}
                  title={t("chrome.search.locked_title")}
                  note={t("chrome.search.locked_note")}
                />
              )}
            </>
          )}
        </div>

        {/* Footer con hints de teclado */}
        <div
          style={{
            padding: "8px 18px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 14,
            font: "500 11px/1 var(--f-sans)",
            color: "var(--ink-mute)",
          }}
        >
          <span>↑↓ {t("chrome.search.kbd_navigate")}</span>
          <span>↵ {t("chrome.search.kbd_select")}</span>
          <span>{isMac ? "⌘" : "Ctrl"}K {t("chrome.search.kbd_toggle")}</span>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────

function ScopeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "4px 10px",
        borderRadius: "var(--r-pill)",
        border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
        background: active ? "var(--wine-tint)" : "var(--bg-elevated)",
        color: active ? "var(--wine)" : "var(--ink-soft)",
        font: "600 11.5px/1 var(--f-sans)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function FacetBlock({
  label,
  icon,
  children,
}: {
  label: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px 4px",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        <span style={{ display: "inline-flex" }}>{Icon[icon](12)}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

function HitRow({
  hit,
  active,
  optionId,
  onHover,
  onSelect,
}: {
  hit: GlobalSearchHit;
  active: boolean;
  optionId: string;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      id={optionId}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        margin: "0 4px",
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        background: active ? "var(--wine-tint)" : "transparent",
      }}
    >
      <span
        style={{
          font: "700 12px/1 var(--f-mono)",
          color: active ? "var(--wine)" : "var(--ink)",
          flexShrink: 0,
        }}
      >
        {hit.code}
      </span>
      <span
        style={{
          font: "500 13px/1.2 var(--f-sans)",
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {hit.title}
      </span>
      {hit.subtitle && (
        <span
          style={{
            font: "500 11.5px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "45%",
          }}
        >
          {hit.subtitle}
        </span>
      )}
    </div>
  );
}

function LockedBlock({
  facetLabels,
  title,
  note,
}: {
  facetLabels: string[];
  title: string;
  note: string;
}) {
  return (
    <div
      style={{
        margin: "8px 12px 4px",
        padding: "12px 14px",
        borderRadius: "var(--r-md)",
        border: "1px dashed var(--border)",
        background: "var(--bg-elevated)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: "var(--ink-mute)", display: "inline-flex", marginTop: 1 }}>
        {Icon.lock(14)}
      </span>
      <div>
        <div
          style={{
            font: "700 11px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.02em",
          }}
        >
          {title}: {facetLabels.join(" · ")}
        </div>
        <div
          style={{
            marginTop: 3,
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-mute)",
          }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}

function RecentsBlock({
  recents,
  onPick,
  emptyHint,
  title,
}: {
  recents: string[];
  onPick: (term: string) => void;
  emptyHint: string;
  title: string;
}) {
  if (recents.length === 0) {
    return (
      <div
        style={{
          padding: "18px",
          textAlign: "center",
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
        }}
      >
        {emptyHint}
      </div>
    );
  }
  return (
    <div>
      <div
        style={{
          padding: "8px 12px 4px",
          font: "700 10px/1 var(--f-sans)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {title}
      </div>
      {recents.map((term) => (
        <button
          key={term}
          onClick={() => onPick(term)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "calc(100% - 8px)",
            margin: "0 4px",
            padding: "8px 12px",
            borderRadius: "var(--r-sm)",
            background: "transparent",
            border: 0,
            cursor: "pointer",
            textAlign: "left",
            font: "500 13px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--wine-tint)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
            {Icon.search(13)}
          </span>
          {term}
        </button>
      ))}
    </div>
  );
}
