/**
 * SDD-0625 · Formulario para corregir una noticia publicada, con vista previa.
 *
 * Estado controlado y ActionButton (no `<form action>`: en React 19 el form
 * se reinicia al terminar la acción y un error perdería lo escrito). Las marcas
 * `[VERIFICAR` se cuentan aquí para avisar antes, pero el que decide es el
 * servidor (`validarEdicion`).
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import { categoriasByTipo, NEWS_CATEGORIES_V4, type NewsCategoria } from "@/lib/news/categories";
import { contarMarcas } from "@/lib/news/autopublicar/marcas";
import { BAJADA_MAX, CUERPO_MIN, META_MAX, TITULO_MAX } from "@/lib/news/edicion";
import type { NoticiaParaEditar } from "@/lib/studio/news-publicadas-queries";
import { MarkdownLite } from "../../_components/MarkdownLite";
import { guardarEdicion } from "../actions";

const etiqueta: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const ayuda: React.CSSProperties = { fontSize: 12, color: "var(--color-grey-500, #6B6B6B)", marginTop: 4 };
const campo: React.CSSProperties = { width: "100%" };

export function EditarNoticiaForm({ noticia }: { noticia: NoticiaParaEditar }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [title, setTitle] = useState(noticia.title);
  const [excerpt, setExcerpt] = useState(noticia.excerpt);
  const [body, setBody] = useState(noticia.body_markdown);
  const [categoria, setCategoria] = useState<NewsCategoria>(noticia.categoria);
  const [meta, setMeta] = useState(noticia.meta_description ?? "");
  const [keyword, setKeyword] = useState(noticia.focus_keyword ?? "");
  const [vista, setVista] = useState<"editar" | "previa">("editar");
  const [error, setError] = useState<string | null>(null);

  const marcas = contarMarcas([title, excerpt, body, meta, keyword].join("\n"));
  const sinCambios =
    title === noticia.title &&
    excerpt === noticia.excerpt &&
    body === noticia.body_markdown &&
    categoria === noticia.categoria &&
    meta === (noticia.meta_description ?? "") &&
    keyword === (noticia.focus_keyword ?? "");
  const corto = body.trim().length < CUERPO_MIN;
  const opciones = categoriasByTipo(noticia.tipo);

  const id = (n: string) => `${uid}-${n}`;

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 900 }}>
      <div role="group" aria-label="Modo" style={{ display: "flex", gap: 8 }}>
        {(["editar", "previa"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={vista === m}
            className={`studio-btn studio-btn-sm ${vista === m ? "studio-btn-dark" : "studio-btn-ghost"}`}
            onClick={() => setVista(m)}
          >
            {m === "editar" ? "Editar" : "Vista previa"}
          </button>
        ))}
      </div>

      {vista === "editar" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div>
            <label htmlFor={id("titulo")} style={etiqueta}>Titular</label>
            <input
              id={id("titulo")}
              className="studio-input"
              style={campo}
              value={title}
              maxLength={TITULO_MAX}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={id("bajada")} style={etiqueta}>Bajada</label>
            <textarea
              id={id("bajada")}
              className="studio-input"
              style={{ ...campo, minHeight: 72, height: "auto", paddingTop: 8 }}
              value={excerpt}
              maxLength={BAJADA_MAX}
              onChange={(e) => setExcerpt(e.target.value)}
            />
            <p style={ayuda}>Es el resumen que sale en la tarjeta de /noticias. {excerpt.trim().length}/{BAJADA_MAX}</p>
          </div>
          <div>
            <label htmlFor={id("cuerpo")} style={etiqueta}>Cuerpo (Markdown)</label>
            <textarea
              id={id("cuerpo")}
              className="studio-input studio-input-mono"
              style={{ ...campo, minHeight: 360, height: "auto", paddingTop: 8, lineHeight: 1.5 }}
              value={body}
              aria-describedby={id("cuerpo-ayuda")}
              onChange={(e) => setBody(e.target.value)}
            />
            <p id={id("cuerpo-ayuda")} style={ayuda}>
              Mínimo {CUERPO_MIN} caracteres. Usa ## para los subtítulos.
            </p>
          </div>
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div>
              <label htmlFor={id("categoria")} style={etiqueta}>Categoría</label>
              <select
                id={id("categoria")}
                className="studio-input"
                style={campo}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as NewsCategoria)}
              >
                {opciones.map((c) => (
                  <option key={c} value={c}>{NEWS_CATEGORIES_V4[c].label}</option>
                ))}
              </select>
              <p style={ayuda}>Solo categorías del mismo tipo de la noticia.</p>
            </div>
            <div>
              <label htmlFor={id("keyword")} style={etiqueta}>Palabra clave SEO</label>
              <input
                id={id("keyword")}
                className="studio-input"
                style={campo}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor={id("meta")} style={etiqueta}>Meta descripción</label>
            <textarea
              id={id("meta")}
              className="studio-input"
              style={{ ...campo, minHeight: 64, height: "auto", paddingTop: 8 }}
              value={meta}
              maxLength={META_MAX}
              onChange={(e) => setMeta(e.target.value)}
            />
            <p style={ayuda}>La que muestra Google bajo el titular. {meta.trim().length}/{META_MAX}</p>
          </div>
          <div>
            <span style={etiqueta}>Enlace</span>
            <code style={{ fontSize: 13 }}>/noticias/{noticia.slug}</code>
            <p style={ayuda}>No cambia al corregir: así no se rompen los enlaces compartidos ni el mapa del sitio.</p>
          </div>
        </div>
      ) : (
        <article
          aria-label="Vista previa"
          style={{ background: "var(--color-white, #fff)", border: "1px solid var(--color-grey-200, #E8E6E2)", borderRadius: 12, padding: "28px 28px 32px" }}
        >
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-grey-500, #6B6B6B)", margin: 0 }}>
            {NEWS_CATEGORIES_V4[categoria]?.label}
          </p>
          <h2 style={{ fontFamily: "var(--font-archivo-black)", fontSize: 28, lineHeight: 1.15, margin: "10px 0 12px" }}>{title}</h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--color-grey-700, #333)", margin: "0 0 20px" }}>{excerpt}</p>
          <MarkdownLite source={body} />
        </article>
      )}

      {marcas > 0 ? (
        <Aviso tono="atencion">
          {marcas === 1 ? "Queda 1 marca [VERIFICAR]" : `Quedan ${marcas} marcas [VERIFICAR]`}: corrígelas para poder guardar.
        </Aviso>
      ) : null}
      {error ? (
        <Aviso tono="error">{error}</Aviso>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Link className="studio-btn studio-btn-ghost studio-btn-sm" href="/studio/marketing/noticias-web/publicadas">
          Cancelar
        </Link>
        <ActionButton
          variant="primary"
          size="sm"
          idleLabel="Guardar cambios"
          loadingLabel="Guardando…"
          successLabel="Guardado"
          idleIcon={Icon.check(14)}
          successIcon={Icon.check(14)}
          disabled={sinCambios || marcas > 0 || corto || !title.trim() || !excerpt.trim()}
          title={sinCambios ? "No hay cambios que guardar" : undefined}
          onAction={async () => {
            setError(null);
            const res = await guardarEdicion(noticia.id, {
              title,
              excerpt,
              body_markdown: body,
              categoria,
              meta_description: meta,
              focus_keyword: keyword,
            });
            return res.ok ? undefined : { error: res.error };
          }}
          onError={setError}
          onSuccess={() => {
            toast.success("Noticia corregida. En el sitio se ve en hasta 5 minutos.", {
              link: { href: `/noticias/${noticia.slug}`, label: "Ver en el sitio" },
            });
            router.push(`/studio/marketing/noticias-web/publicadas?highlight=${noticia.id}&hl-tone=success`);
          }}
        />
      </div>

      <div style={{ borderTop: "1px solid var(--color-grey-200, #E8E6E2)", paddingTop: 16 }}>
        <p style={{ fontSize: 13, color: "var(--color-grey-500, #6B6B6B)", margin: "0 0 8px" }}>
          ¿La noticia no tiene arreglo? Retírala del sitio con su motivo; después se puede volver a publicar.
        </p>
        <Link
          className="studio-btn studio-btn-ghost studio-btn-sm"
          href={`/studio/marketing/noticias-web/retirar/${noticia.id}`}
          style={{ color: "var(--color-status-danger, #c2353f)" }}
        >
          Retirar del sitio
        </Link>
      </div>
    </div>
  );
}
