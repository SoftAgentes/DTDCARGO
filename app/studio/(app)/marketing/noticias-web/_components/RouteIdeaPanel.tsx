/**
 * RouteIdeaPanel · SDD-0089 F-A — El "Banco de ideas" (paso inicial del módulo).
 *
 * Antecede al wizard de noticia. El operador mete nombre + título (+ ángulo
 * opcional) de una idea y aprieta "Clasificar idea". El cerebro (routeIdea
 * server action en Auto, o buildRouteIdeaPrompt en Manual) corre el Test de
 * Noticia y devuelve flujo + categoría + canales + ángulo + títulos.
 *
 * El resultado se renderiza con:
 *   - El Test de Noticia (5 SÍ/NO + score X/5).
 *   - El Flujo (A noticia / B redes) con su razón.
 *   - La categoría (si Flujo A) + canales sugeridos (badges) + ángulo.
 *   - 2-3 títulos propuestos.
 *
 * CTA según flujo:
 *   - Flujo A → "Generar la noticia": deep-link al wizard precargando
 *     topic/angle/categoria/tipo (onStartNoticia).
 *   - Flujo B → aviso placeholder ("las piezas de redes llegan en F-B").
 *
 * Conserva el modo Auto/Manual + failover de SDD-0088: si routeIdea Auto falla,
 * el parent abre ManualPromptModal con buildRouteIdeaPrompt.
 *
 * Marca: solo tokens var(--*) del Studio + primitivas de _components/ui/.
 */

"use client";

import React, { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  ALL_ANGULOS,
  ANGULO_LABELS,
  CANAL_LABELS,
  CEREBRO_TIPOS,
  TEST_NOTICIA_KEYS,
  TEST_NOTICIA_LABELS,
  type Angulo,
  type RouteIdeaResult,
} from "@/lib/news/cerebro";
import { getCategoryInfo } from "@/lib/news/categories";

const NOMBRE_MAX = 300;
const TITULO_MAX = 300;

interface Props {
  /** Resultado del último clasificado (persiste al volver del wizard). */
  result: RouteIdeaResult | null;
  /** Dispara el clasificador (Auto o Manual) — el parent decide el modo. */
  onClassify: (
    nombre: string,
    titulo: string,
    angulo?: Angulo,
  ) => Promise<{ error?: string | null } | void>;
  /** Flujo A → arranca el wizard con el deep-link precargado. */
  onStartNoticia: (result: RouteIdeaResult) => void;
  /** Errores de validación / API. */
  onError: (msg: string) => void;
  error: string | null;
}

export function RouteIdeaPanel({
  result,
  onClassify,
  onStartNoticia,
  onError,
  error,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [titulo, setTitulo] = useState("");
  const [angulo, setAngulo] = useState<Angulo | "">("");

  const canSubmit =
    nombre.trim().length > 0 &&
    nombre.trim().length <= NOMBRE_MAX &&
    titulo.trim().length > 0 &&
    titulo.trim().length <= TITULO_MAX;

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <span className="eyebrow">Paso 0 · Banco de ideas</span>
        <h2
          className="mt-3 text-ink"
          style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}
        >
          ¿Qué <span className="text-wine">idea</span> tienes en mente?
        </h2>
        <p className="mt-2 text-[13.5px] text-grey-500 max-w-[70ch] leading-relaxed">
          Mete el tema y un título. El cerebro corre el Test de Noticia y decide
          si va a la web como noticia (Flujo A) o directo a redes y WhatsApp
          (Flujo B), con su categoría, canales, ángulo y títulos sugeridos.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-5">
        {/* Nombre / tema */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="idea-nombre"
            className="text-[13px] font-semibold text-ink"
          >
            Nombre o tema de la idea <span className="text-wine">*</span>
          </label>
          <input
            id="idea-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={NOMBRE_MAX}
            placeholder="Ej: Comprar repartido por mes en vez de cada 3 meses"
            className="w-full bg-white border border-grey-200 rounded-lg px-3 py-2.5 text-[14px] text-ink placeholder:text-grey-300 focus:border-wine transition-colors"
          />
        </div>

        {/* Título */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="idea-titulo"
            className="text-[13px] font-semibold text-ink"
          >
            Título propuesto <span className="text-wine">*</span>
          </label>
          <input
            id="idea-titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={TITULO_MAX}
            placeholder="Ej: Por qué comprar cada 3 meses te está costando plata"
            className="w-full bg-white border border-grey-200 rounded-lg px-3 py-2.5 text-[14px] text-ink placeholder:text-grey-300 focus:border-wine transition-colors"
          />
        </div>

        {/* Ángulo opcional */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="idea-angulo"
            className="text-[13px] font-semibold text-ink"
          >
            Ángulo preferido{" "}
            <span className="text-grey-500 font-normal">(opcional)</span>
          </label>
          <select
            id="idea-angulo"
            value={angulo}
            onChange={(e) => setAngulo(e.target.value as Angulo | "")}
            className="w-full bg-white border border-grey-200 rounded-lg px-3 py-2.5 text-[14px] text-ink focus:border-wine transition-colors"
          >
            <option value="">Que lo decida el cerebro</option>
            {ALL_ANGULOS.map((a) => (
              <option key={a} value={a}>
                {ANGULO_LABELS[a]}
              </option>
            ))}
          </select>
        </div>

        {/* CTA */}
        <div className="pt-1">
          <ActionButton
            variant="dark"
            size="default"
            idleLabel="Clasificar idea"
            loadingLabel="El cerebro está pensando…"
            successLabel={null}
            idleIcon={Icon.spark(14)}
            disabled={!canSubmit}
            onAction={async () => {
              const a = angulo === "" ? undefined : angulo;
              const res = await onClassify(nombre.trim(), titulo.trim(), a);
              if (res && res.error) return { error: res.error };
            }}
            onError={onError}
          />
        </div>

        {error && (
          <Aviso tono="error" compacto>
            {error}
          </Aviso>
        )}
      </div>

      {/* Resultado */}
      {result && (
        <RouteIdeaResultView result={result} onStartNoticia={onStartNoticia} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Vista del resultado del clasificador
// ──────────────────────────────────────────────────────────────

function RouteIdeaResultView({
  result,
  onStartNoticia,
}: {
  result: RouteIdeaResult;
  onStartNoticia: (r: RouteIdeaResult) => void;
}) {
  const isFlujoA = result.flujo === "A";
  const tipoInfo = CEREBRO_TIPOS[result.tipo];
  const score = result.test_noticia.score;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-5 border-t border-grey-200 pt-7"
    >
      {/* Encabezado del veredicto */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="eyebrow">Veredicto del cerebro</span>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={isFlujoA ? "success" : "wine"} size="md">
              {isFlujoA ? "Flujo A · Noticia" : "Flujo B · Redes / WhatsApp"}
            </Badge>
            <Badge tone="neutral" size="md">
              {tipoInfo.label}
            </Badge>
            <span className="text-[11.5px] text-grey-500">
              confianza {result.confidence}%
            </span>
          </div>
        </div>
        <ScorePill score={score} />
      </div>

      {/* Razón */}
      {result.reason && (
        <p className="text-[13px] text-grey-700 leading-relaxed max-w-[72ch]">
          {result.reason}
        </p>
      )}

      {/* Test de Noticia */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[12px] font-semibold text-ink uppercase tracking-wider">
          Test de Noticia
        </span>
        <ul className="flex flex-col gap-1.5">
          {TEST_NOTICIA_KEYS.map((k) => {
            const yes = result.test_noticia[k];
            return (
              <li key={k} className="flex items-center gap-2.5 text-[13px]">
                <span
                  className="inline-flex w-5 h-5 rounded-full items-center justify-center flex-shrink-0"
                  style={{
                    background: yes
                      ? "var(--success-bg)"
                      : "var(--neutral-bg)",
                    color: yes ? "var(--success)" : "var(--ink-mute)",
                  }}
                  aria-hidden
                >
                  {yes ? Icon.check(12) : Icon.close(11)}
                </span>
                <span className={yes ? "text-ink" : "text-grey-500"}>
                  {TEST_NOTICIA_LABELS[k]}
                </span>
                <span className="sr-only">{yes ? "Sí" : "No"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Detalle: categoría + canales + ángulo */}
      <div className="grid gap-4 sm:grid-cols-2">
        {isFlujoA && result.categoria && (
          <DetailBlock label="Categoría del blog">
            <Badge tone="info" size="md">
              {getCategoryInfo(result.categoria).label}
            </Badge>
          </DetailBlock>
        )}
        <DetailBlock label="Ángulo">
          <Badge tone="neutral" size="md">
            {ANGULO_LABELS[result.angulo]}
          </Badge>
        </DetailBlock>
        <DetailBlock label="Canales sugeridos">
          <div className="flex items-center gap-1.5 flex-wrap">
            {result.canales.map((c) => (
              <Badge
                key={c}
                tone={c === "noticias" ? "success" : "neutral"}
                size="md"
              >
                {CANAL_LABELS[c]}
              </Badge>
            ))}
          </div>
        </DetailBlock>
      </div>

      {/* Títulos propuestos */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[12px] font-semibold text-ink uppercase tracking-wider">
          Títulos propuestos
        </span>
        <ul className="flex flex-col gap-2">
          {result.titulos.map((t, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[13.5px] text-ink bg-grey-100 border border-grey-200 rounded-lg px-3 py-2.5"
            >
              <span
                className="inline-flex text-wine mt-0.5 flex-shrink-0"
                aria-hidden
              >
                {Icon.tag(13)}
              </span>
              <span className="leading-snug">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA según flujo */}
      {isFlujoA ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onStartNoticia(result)}
            className="studio-btn studio-btn-primary inline-flex items-center gap-2"
          >
            Generar la noticia
            <span className="inline-flex" aria-hidden>
              {Icon.arrowR(14)}
            </span>
          </button>
          <p className="text-[12px] text-grey-500 mt-2 leading-snug max-w-[64ch]">
            Arranca el wizard precargado con este tema, ángulo, categoría y tipo
            editorial — listo para generar titulares.
          </p>
        </div>
      ) : (
        <FlujoBPlaceholder />
      )}
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 3
      ? { bg: "var(--success-bg)", fg: "var(--success)" }
      : { bg: "var(--wine-tint)", fg: "var(--wine)" };
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-4 py-2 flex-shrink-0"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span
        className="font-mono font-bold leading-none"
        style={{ fontSize: 22 }}
      >
        {score}/5
      </span>
      <span className="text-[10px] uppercase tracking-wider mt-1 font-semibold">
        de 5
      </span>
    </div>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-grey-500">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

/** Aviso placeholder para Flujo B — la generación de piezas llega en F-B. */
function FlujoBPlaceholder() {
  return (
    <Aviso tono="info" titulo="Esto va directo a redes y WhatsApp">
      No pasa por la web (ensuciaría el blog sin aportar SEO). La generación
      de las piezas por canal (LinkedIn, Instagram, WhatsApp) llega en la
      próxima fase del motor. Por ahora tienes el ruteo, el ángulo y los
      títulos para crearlas a mano.
    </Aviso>
  );
}
