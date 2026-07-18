"use client";

/**
 * SDD-0158 — Lector de documentos de Marketing (client). Dos paneles: lista de
 * docs agrupada + buscador a la izquierda; documento renderizado a la derecha.
 * El HTML ya viene renderizado del server (`renderMarkdown`); acá solo se pinta
 * y se manejan los enlaces internos (`a[data-doc]`) para saltar entre docs sin
 * navegar. Read-only: no muta nada.
 */

import { useMemo, useState } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { MarketingDoc } from "@/lib/studio/marketing/docs-reader";

const LAST_KEY = "dtd-mkdocs-last";

export function DocsReaderClient({ docs }: { docs: MarketingDoc[] }) {
  const byFile = useMemo(() => {
    const m: Record<string, MarketingDoc> = {};
    for (const d of docs) m[d.file.toLowerCase()] = d;
    return m;
  }, [docs]);

  // Texto plano por doc para el buscador (sin tags).
  const plain = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of docs) m[d.path] = (d.title + " " + d.html.replace(/<[^>]+>/g, " ")).toLowerCase();
    return m;
  }, [docs]);

  const groups = useMemo(() => {
    const order: string[] = [];
    for (const d of docs) if (!order.includes(d.group)) order.push(d.group);
    return order;
  }, [docs]);

  const [current, setCurrent] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const last = localStorage.getItem(LAST_KEY);
        if (last && docs.some((d) => d.path === last)) return last;
      } catch {
        /* ignore */
      }
    }
    return docs[0]?.path ?? "";
  });
  const [q, setQ] = useState("");

  const open = (path: string) => {
    setCurrent(path);
    try {
      localStorage.setItem(LAST_KEY, path);
    } catch {
      /* ignore */
    }
  };

  const onArticleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a[data-doc]") as HTMLElement | null;
    if (!a) return;
    e.preventDefault();
    const file = (a.getAttribute("data-doc") || "").toLowerCase();
    const d = byFile[file];
    if (d) {
      open(d.path);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  const term = q.trim().toLowerCase();
  const matches = (d: MarketingDoc) => !term || plain[d.path].includes(term);
  const doc = docs.find((d) => d.path === current) ?? docs[0];

  return (
    <div className="mkdocs" style={{ maxWidth: 1280 }}>
      <style>{STYLES}</style>

      {/* Panel izquierdo: buscador + lista */}
      <aside className="mkdocs-side">
        <div style={{ marginBottom: 12 }}>
          <span className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
            Marketing · Documentos
          </span>
          <p style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
            {docs.length} documentos · read-only, se actualizan solos desde el repo.
          </p>
        </div>
        <input
          type="search"
          className="studio-input"
          placeholder="Buscar en los documentos…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar documento"
          style={{ marginBottom: 12 }}
        />
        <nav className="mkdocs-nav" aria-label="Documentos de marketing">
          {groups.map((g) => {
            const items = docs.filter((d) => d.group === g && matches(d));
            if (items.length === 0) return null;
            return (
              <div key={g} style={{ marginBottom: 10 }}>
                <div className="mkdocs-grp">{g}</div>
                {items.map((d) => (
                  <button
                    key={d.path}
                    type="button"
                    className={`mkdocs-item${d.path === current ? " active" : ""}`}
                    onClick={() => open(d.path)}
                  >
                    <span className="mkdocs-item-t">{d.title}</span>
                    <span className="mkdocs-item-f">{d.file}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Panel derecho: documento */}
      <div className="mkdocs-main">
        {doc ? (
          <>
            <div className="mkdocs-crumb">{doc.path}</div>
            {/* Contenido PROPIO del repo, ya escapado por renderMarkdown. */}
            <article
              className="mkdocs-body"
              onClick={onArticleClick}
              dangerouslySetInnerHTML={{ __html: doc.html }}
            />
          </>
        ) : (
          <EmptyState
            eyebrow="Sin documentos"
            title="No se encontraron documentos de marketing."
            description="Verifica que docs/marketing/ tenga archivos .md en el deploy."
          />
        )}
      </div>
    </div>
  );
}

const STYLES = `
.mkdocs { display:grid; grid-template-columns:264px 1fr; gap:22px; align-items:start; }
.mkdocs-side { position:sticky; top:16px; }
.mkdocs-nav { max-height:calc(100vh - 190px); overflow-y:auto; }
.mkdocs-grp { font:700 9.5px/1 var(--f-sans); letter-spacing:.14em; text-transform:uppercase; color:var(--ink-soft); padding:8px 8px 6px; }
.mkdocs-item { display:block; width:100%; text-align:left; background:none; border:0; cursor:pointer; border-radius:var(--r-md); padding:8px 10px; margin-bottom:1px; font-family:var(--f-sans); line-height:1.3; }
.mkdocs-item:hover { background:var(--bg-elevated); }
.mkdocs-item.active { background:var(--bg-elevated); box-shadow:inset 3px 0 0 var(--wine-soft); }
.mkdocs-item-t { display:block; font-size:13px; font-weight:600; color:var(--ink); }
.mkdocs-item-f { display:block; font:500 10.5px var(--f-mono); color:var(--ink-mute); margin-top:1px; }
.mkdocs-item.active .mkdocs-item-t { color:var(--wine-text); }
.mkdocs-main { min-width:0; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:26px 32px 48px; }
.mkdocs-crumb { font:600 11.5px/1 var(--f-mono); color:var(--ink-soft); margin-bottom:18px; word-break:break-all; }

.mkdocs-body { color:var(--ink); font:400 14.5px/1.65 var(--f-sans); }
.mkdocs-body h1 { font:800 27px/1.15 var(--f-sans); letter-spacing:-.02em; margin:0 0 16px; }
.mkdocs-body h2 { font:800 20px/1.2 var(--f-sans); letter-spacing:-.01em; margin:30px 0 11px; padding-bottom:6px; border-bottom:2px solid var(--border); }
.mkdocs-body h3 { font:700 16px/1.3 var(--f-sans); margin:22px 0 8px; }
.mkdocs-body h4 { font:700 13.5px/1.3 var(--f-sans); margin:18px 0 6px; color:var(--ink-soft); }
.mkdocs-body h5, .mkdocs-body h6 { font:700 12.5px var(--f-sans); margin:14px 0 5px; color:var(--ink-soft); }
.mkdocs-body p { margin:0 0 12px; }
.mkdocs-body strong { font-weight:700; color:var(--ink); }
.mkdocs-body del { color:var(--ink-mute); }
.mkdocs-body a { color:var(--wine-text); text-decoration:underline; text-underline-offset:2px; cursor:pointer; }
.mkdocs-body a.mdoc-ext::after { content:"↗"; font-size:.8em; margin-left:2px; opacity:.7; }
.mkdocs-body a.mdoc-dead { color:var(--ink-mute); text-decoration:underline dotted; cursor:help; }
.mkdocs-body code { font-family:var(--f-mono); font-size:.85em; background:var(--bg-elevated); border:1px solid var(--border); border-radius:4px; padding:1px 5px; color:var(--wine-text); }
.mkdocs-body pre { background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--r-md); padding:13px 15px; overflow-x:auto; margin:0 0 14px; }
.mkdocs-body pre code { background:none; border:0; padding:0; color:var(--ink); font-size:12.5px; line-height:1.55; }
.mkdocs-body ul, .mkdocs-body ol { margin:0 0 13px; padding-left:22px; }
.mkdocs-body li { margin:4px 0; }
.mkdocs-body li > ul, .mkdocs-body li > ol { margin:4px 0 2px; }
.mkdocs-body blockquote { margin:0 0 14px; padding:10px 15px; border-left:3px solid var(--wine-soft); background:var(--bg-elevated); border-radius:0 var(--r-md) var(--r-md) 0; }
.mkdocs-body blockquote > :last-child { margin-bottom:0; }
.mkdocs-body hr { border:0; border-top:1px solid var(--border); margin:24px 0; }
.mkdocs-tablewrap { overflow-x:auto; margin:0 0 15px; border:1px solid var(--border); border-radius:var(--r-md); }
.mkdocs-body table { border-collapse:collapse; width:100%; font-size:12.5px; }
.mkdocs-body th, .mkdocs-body td { text-align:left; padding:8px 11px; border-bottom:1px solid var(--border); vertical-align:top; }
.mkdocs-body th { background:var(--bg-elevated); font-weight:700; font-size:10.5px; letter-spacing:.03em; text-transform:uppercase; color:var(--ink-soft); white-space:nowrap; }
.mkdocs-body tr:last-child td { border-bottom:0; }
.mkdocs-body td code { white-space:nowrap; }
.mkdocs-chk { color:var(--wine-text); font-weight:700; }

@media (max-width:860px){
  .mkdocs { grid-template-columns:1fr; }
  .mkdocs-side { position:static; }
  .mkdocs-nav { max-height:none; }
  .mkdocs-main { padding:20px 18px 40px; }
}
`;
