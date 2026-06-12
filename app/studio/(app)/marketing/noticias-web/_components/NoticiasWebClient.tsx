/**
 * NoticiasWebClient · Plan v4 · Phase D — state machine de 4 pasos + modo dual.
 *
 * Steps 0 → 1 → 2 → 3:
 *   0. Tipo editorial (Informativo / Curiosidad / Polémica / Especial)
 *   1. Topic + Tone + Categoría (manual o sugerida por IA) + Keywords SEO
 *   2. Bullets editables
 *   3. Artículo Markdown
 *
 * Modo dual Auto / Manual (LLMModeToggle en header, persistido localStorage):
 *  - Auto:   server actions llaman a Claude vía SDK.
 *  - Manual: ManualPromptModal con prompt pre-cargado para llevarlo a
 *            claude.ai; el operador pega la respuesta y el cliente la
 *            parsea y aplica al state.
 *
 * Failover automático: si una server action falla en Auto, abre el modal
 * con el mismo prompt y el error visible — el operador no pierde momentum.
 *
 * Single source of truth de prompts en lib/news/prompts.ts (importado
 * tanto por el server action como por el cliente para modo Manual).
 *
 * State único en React (sin localStorage del state, sin DB todavía — la
 * persistencia a seo_drafts via saveDraft action se wirea en Phase E
 * junto con el publishPost flow).
 *
 * Navegación:
 *  - "Atrás" en pasos 1, 2 y 3 (top-left, Icon.arrowL).
 *  - Step 1 → 0: limpia tipo + categoria + topic + headlines + keywords.
 *  - Step 2 → 1: limpia bullets + selectedHeadline.
 *  - Step 3 → 2: limpia article.
 */

"use client";

import React, { useState, useTransition } from "react";
import { Icon } from "@/app/studio/_components/icons";
import {
  categoriasByTipo,
  type NewsCategoria,
  type NewsTipo,
} from "@/lib/news/categories";
import {
  buildGenerateHeadlinesPrompt,
  buildGenerateOutlinesPrompt,
  buildGenerateArticlePrompt,
  buildSuggestKeywordsPrompt,
  type NewsBrief,
} from "@/lib/news/prompts";
import { StepIndicator } from "./StepIndicator";
import { Step0Brief } from "./Step0Brief";
import { Step1Headlines } from "./Step1Headlines";
import { Step2Outlines } from "./Step2Outlines";
import { Step3Article } from "./Step3Article";
import { LLMModeToggle, useLLMMode } from "./LLMModeToggle";
import { ManualPromptModal } from "./ManualPromptModal";
import { CategoryDetector } from "./CategoryDetector";
import { KeywordPanel } from "./KeywordPanel";
import { PublishModal } from "./PublishModal";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  detectBriefIntent,
  generateArticle,
  generateHeadlines,
  generateOutlines,
  suggestKeywords,
  type DetectBriefIntentResult,
  type ErrorResult,
  type OutlineItem,
  type Tone,
} from "../actions";

type Step = 0 | 1 | 2 | 3;
type ModalKind = "headlines" | "outlines" | "article" | "suggest-keywords";

interface ManualModalConfig {
  kind: ModalKind;
  title: string;
  subtitle?: string;
  prompt: string;
  inputHint?: string;
  placeholder?: string;
  submitLabel?: string;
}

type ManualModalState =
  | { open: false }
  | {
      open: true;
      config: ManualModalConfig;
      error: string | null;
      loading: boolean;
    };

// ── Helpers ───────────────────────────────────────────────────

/** JSON parser tolerante a fences ```json y prosa envolvente. */
function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // probamos con sub-string
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/** Limpia markdown — quita fences si vienen. */
function cleanMarkdown(raw: string): string {
  return raw.replace(/^```(?:markdown|md)?\n?|\n?```$/g, "").trim();
}

// ── Component ─────────────────────────────────────────────────

export function NoticiasWebClient() {
  // Mode (Auto / Manual) — persistido en localStorage
  const [mode, setMode] = useLLMMode();

  // Step machine
  const [step, setStep] = useState<Step>(0);

  // Step 0 state · Brief (Plan v5)
  // El brief es lo único que el operador escribe en step 0; tipo + categoría
  // + tono se derivan vía detectBriefIntent y son editables después.
  const [briefRefs, setBriefRefs] = useState<string[]>([]);
  const [briefAngle, setBriefAngle] = useState("");
  // tipo + categoría: state derivado del brief (populated por detectBriefIntent)
  const [tipo, setTipo] = useState<NewsTipo | null>(null);
  const [categoria, setCategoria] = useState<NewsCategoria | null>(null);

  // Step 1 state · topic vive acá porque Step1Headlines lo edita inline
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("informativo");
  const [headlines, setHeadlines] = useState<string[]>([]);

  // Step 1 — SEO keywords (Step 1.5 — panel expandible)
  const [focusKeyword, setFocusKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  // Step 1 — reason por el cual Claude sugirió este tipo+categoría desde el brief.
  // Se renderiza como banner sutil en Step1Headlines (Plan v5) + persiste en
  // el draft para audit (Phase E).
  const [aiSuggestionReason, setAiSuggestionReason] = useState<string | null>(
    null,
  );

  // Step 2 state · 3 outlines alternativos (Plan v5) reemplazan a bullets-checkbox
  const [selectedHeadline, setSelectedHeadline] = useState("");
  const [outlines, setOutlines] = useState<OutlineItem[]>([]);
  const [selectedOutlineIdx, setSelectedOutlineIdx] = useState<number>(-1);

  // Step 3 state
  const [article, setArticle] = useState("");

  // Loading / error / modal
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<ManualModalState>({ open: false });

  // Publish flow (Phase E)
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishedInfo, setPublishedInfo] = useState<{
    slug: string;
    postId: string;
    authorName: string;
  } | null>(null);
  const toast = useToast();

  // ── Helpers internos ────────────────────────────────────────

  const openManualModal = (
    config: ManualModalConfig,
    errorFromAuto?: string | null,
  ) => {
    setModal({
      open: true,
      config,
      error: errorFromAuto ?? null,
      loading: false,
    });
  };

  const closeModal = () => setModal({ open: false });

  // ── Step 0 → 1 · Brief submit (Plan v5) ─────────────────────
  //
  // El operador escribe brief en step 0. Click "Detectar tipo + continuar"
  // dispara detectBriefIntent que devuelve tipo + categoría + tono sugeridos
  // por Claude. Populamos el state derivado y avanzamos a step 1 donde el
  // operador puede ajustar.
  //
  // Devuelve el result al caller (ActionButton dentro de Step0Brief) para
  // que pueda mostrar error con el callback estándar.

  const handleBriefSubmit = async (
    brief: NewsBrief,
  ): Promise<DetectBriefIntentResult | ErrorResult> => {
    setError(null);
    const res = await detectBriefIntent(brief);
    if (!res.ok) {
      setError(res.error);
      return res;
    }
    // Persistir el brief en state
    setTopic(brief.topic);
    setBriefRefs(brief.refs);
    setBriefAngle(brief.angle);
    // State derivado por Claude
    setTipo(res.tipo);
    setCategoria(res.categoria);
    setTone(res.tone_suggested);
    setAiSuggestionReason(res.reason);
    setStep(1);
    return res;
  };

  // ── Step 1 · Aceptar sugerencia de categoría (CategoryDetector) ─

  const handleAcceptCategorySuggestion = (
    cat: NewsCategoria,
    reason: string,
  ) => {
    setCategoria(cat);
    setAiSuggestionReason(reason);
  };

  // ── Step 1 · Cambiar tipo (revalidar categoría) ─────────────
  //
  // Si el operador cambia el tipo editorial en step 1, la categoría
  // actual puede no pertenecer al nuevo tipo. Si no calza, caemos a
  // la primera categoría disponible del tipo nuevo. Sin esto, el
  // botón "Generar" se rompería con "categoría inválida".

  const handleTipoChange = (t: NewsTipo) => {
    setTipo(t);
    const cats = categoriasByTipo(t);
    if (!categoria || !cats.includes(categoria)) {
      setCategoria(cats[0] ?? null);
    }
    // Limpiar reason de Claude porque el operador overrideó manual
    setAiSuggestionReason(null);
  };

  // ── Step 1 · Sugerir keywords ──────────────────────────────

  const handleSuggestKeywords = () => {
    if (!categoria) {
      setError("Falta categoría");
      return;
    }
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      setError("Tipea un tema base antes de sugerir keywords");
      return;
    }
    setError(null);

    const prompt = buildSuggestKeywordsPrompt(cleanTopic, categoria);

    if (mode === "manual") {
      openManualModal({
        kind: "suggest-keywords",
        title: "Sugerir keywords SEO",
        subtitle: "Pega el JSON que devuelva claude.ai con focus + secundarias + pain points",
        prompt,
        inputHint:
          'Esperamos {"focus_keyword": "...", "secondary_keywords": [...], "pain_points_addressed": [...]}',
        placeholder: '{"focus_keyword": "...", "secondary_keywords": [...]}',
        submitLabel: "Cargar keywords",
      });
      return;
    }

    setSuggesting(true);
    suggestKeywords(cleanTopic, categoria)
      .then((res) => {
        setSuggesting(false);
        if (!res.ok) {
          openManualModal(
            {
              kind: "suggest-keywords",
              title: "Sugerir keywords (failover Manual)",
              subtitle: "La API falló — complétalo en Manual para no perder el flow",
              prompt,
              inputHint:
                'Esperamos {"focus_keyword": "...", "secondary_keywords": [...], "pain_points_addressed": [...]}',
              placeholder: '{"focus_keyword": "..."}',
              submitLabel: "Cargar keywords",
            },
            res.error,
          );
          return;
        }
        setFocusKeyword(res.focus_keyword);
        setSecondaryKeywords(res.secondary_keywords);
        setPainPoints(res.pain_points_addressed);
      })
      .catch((e) => {
        setSuggesting(false);
        setError(e instanceof Error ? e.message : "Error desconocido");
      });
  };

  // ── Step 1 → 2 ──────────────────────────────────────────────

  const handleGenerateHeadlines = () => {
    if (!categoria) {
      setError("Falta categoría");
      return;
    }
    setError(null);

    const cleanTopic = topic.trim();
    const focusOpt = focusKeyword.trim() || undefined;
    const secondaryOpt =
      secondaryKeywords.length > 0 ? secondaryKeywords : undefined;

    const prompt = buildGenerateHeadlinesPrompt(
      cleanTopic,
      tone,
      categoria,
      focusOpt,
      secondaryOpt,
    );

    if (mode === "manual") {
      openManualModal({
        kind: "headlines",
        title: "Generar 5 titulares",
        subtitle:
          'Pega el JSON {"headlines": ["...", "..."]} que devuelva claude.ai',
        prompt,
        inputHint: 'Esperamos {"headlines": ["...", "...", "...", "...", "..."]}',
        placeholder: '{"headlines": ["Tarifas · ...", "Tarifas · ..."]}',
        submitLabel: "Cargar 5 titulares",
      });
      return;
    }

    startTransition(async () => {
      const res = await generateHeadlines(
        cleanTopic,
        tone,
        categoria,
        focusOpt,
        secondaryOpt,
      );
      if (!res.ok) {
        openManualModal(
          {
            kind: "headlines",
            title: "Generar 5 titulares (failover Manual)",
            subtitle: "La API falló — usa Manual para no perder el momentum",
            prompt,
            inputHint: 'Esperamos {"headlines": [...]}',
            placeholder: '{"headlines": [...]}',
            submitLabel: "Cargar 5 titulares",
          },
          res.error,
        );
        return;
      }
      setHeadlines(res.headlines);
    });
  };

  const handleSelectHeadline = (h: string) => {
    if (!categoria) {
      setError("Falta categoría");
      return;
    }
    setError(null);
    setSelectedHeadline(h);
    setSelectedOutlineIdx(-1);

    const secondaryOpt =
      secondaryKeywords.length > 0 ? secondaryKeywords : undefined;
    const prompt = buildGenerateOutlinesPrompt(h, categoria, secondaryOpt);

    if (mode === "manual") {
      // No avanzamos a Step 2 todavía — esperamos respuesta del modal
      openManualModal({
        kind: "outlines",
        title: "Generar 3 arquitecturas alternativas",
        subtitle:
          'Pega el JSON {"outlines": [...]} con 3 outlines (cada uno: thesis + sections + closing_type)',
        prompt,
        inputHint:
          'Esperamos {"outlines": [{"thesis":"...","sections":[{"title":"...","desc":"..."}],"closing_type":"conclusion-analitica"}]}',
        placeholder: '{"outlines": [{"thesis":"...","sections":[...]}]}',
        submitLabel: "Cargar 3 outlines",
      });
      return;
    }

    setStep(2);
    startTransition(async () => {
      const res = await generateOutlines(h, categoria, secondaryOpt);
      if (!res.ok) {
        openManualModal(
          {
            kind: "outlines",
            title: "Generar 3 arquitecturas (failover Manual)",
            subtitle: "La API falló — completa en Manual y seguimos",
            prompt,
            inputHint: 'Esperamos {"outlines": [...]}',
            placeholder: '{"outlines": [...]}',
            submitLabel: "Cargar 3 outlines",
          },
          res.error,
        );
        return;
      }
      setOutlines(res.outlines);
      // Por default proponemos el outline 0 (pragmático) pero el operador
      // puede elegir otro
      setSelectedOutlineIdx(0);
    });
  };

  // ── Step 2 → 3 ──────────────────────────────────────────────

  const handleGenerateArticle = () => {
    const selectedOutline =
      selectedOutlineIdx >= 0 ? outlines[selectedOutlineIdx] : null;
    if (!selectedOutline || selectedOutline.sections.length === 0) {
      setError("Elige una arquitectura antes de generar el artículo");
      return;
    }
    const selectedBullets = selectedOutline.sections.map((s) => ({
      title: s.title,
      desc: s.desc,
    }));
    setError(null);

    const focusOpt = focusKeyword.trim() || undefined;
    const secondaryOpt =
      secondaryKeywords.length > 0 ? secondaryKeywords : undefined;

    const prompt = buildGenerateArticlePrompt(
      selectedHeadline,
      selectedBullets,
      focusOpt,
      secondaryOpt,
      tipo ?? undefined,
    );

    if (mode === "manual") {
      openManualModal({
        kind: "article",
        title: "Generar artículo Markdown",
        subtitle: "Pega el Markdown puro (sin fences ```) que devuelva claude.ai",
        prompt,
        inputHint:
          "Esperamos Markdown directo — empezando con párrafo de intro (sin H1), luego ## H2 por sección.",
        placeholder: "Pega acá el artículo Markdown completo…",
        submitLabel: "Cargar artículo",
      });
      return;
    }

    setStep(3);
    startTransition(async () => {
      const res = await generateArticle(
        selectedHeadline,
        selectedBullets,
        focusOpt,
        secondaryOpt,
        tipo ?? undefined,
      );
      if (!res.ok) {
        openManualModal(
          {
            kind: "article",
            title: "Generar artículo (failover Manual)",
            subtitle: "La API falló — pega el Markdown manual y seguimos",
            prompt,
            inputHint: "Esperamos Markdown directo, sin fences.",
            placeholder: "Pega acá el artículo Markdown…",
            submitLabel: "Cargar artículo",
          },
          res.error,
        );
        return;
      }
      setArticle(res.markdown);
    });
  };

  // ── Modal submit · parser + applier ─────────────────────────

  const handleModalSubmit = (raw: string) => {
    if (!modal.open) return;
    setModal({ ...modal, loading: true, error: null });

    try {
      switch (modal.config.kind) {
        case "headlines": {
          const parsed = parseJsonLoose<{ headlines: string[] }>(raw);
          if (!parsed || !Array.isArray(parsed.headlines)) {
            throw new Error(
              'JSON inválido. Esperamos {"headlines": ["...", "..."]}',
            );
          }
          const list = parsed.headlines
            .map((h) => String(h).trim())
            .filter((h) => h.length > 0)
            .slice(0, 5);
          if (list.length === 0) {
            throw new Error("No se obtuvieron titulares válidos");
          }
          setHeadlines(list);
          closeModal();
          break;
        }
        case "outlines": {
          const parsed = parseJsonLoose<{ outlines: unknown[] }>(raw);
          if (!parsed || !Array.isArray(parsed.outlines)) {
            throw new Error(
              'JSON inválido. Esperamos {"outlines": [{"thesis":"...","sections":[...]}]}',
            );
          }
          const VALID_CLOSINGS = new Set([
            "conclusion-analitica",
            "llamada-a-la-accion",
            "pregunta-abierta",
          ]);
          const parsedOutlines: OutlineItem[] = parsed.outlines
            .map((raw): OutlineItem | null => {
              if (!raw || typeof raw !== "object") return null;
              const o = raw as {
                thesis?: unknown;
                sections?: unknown;
                closing_type?: unknown;
              };
              const thesis = String(o.thesis ?? "").trim();
              const sections = Array.isArray(o.sections)
                ? o.sections
                    .map((s) => {
                      if (!s || typeof s !== "object") return null;
                      const sec = s as { title?: unknown; desc?: unknown };
                      const title = String(sec.title ?? "").trim();
                      const desc = String(sec.desc ?? "").trim();
                      if (!title) return null;
                      return { title, desc };
                    })
                    .filter(
                      (s): s is { title: string; desc: string } => s !== null,
                    )
                : [];
              const rawClosing = String(o.closing_type ?? "");
              const closing_type = VALID_CLOSINGS.has(rawClosing)
                ? (rawClosing as OutlineItem["closing_type"])
                : "conclusion-analitica";
              if (!thesis || sections.length < 3) return null;
              return { thesis, sections, closing_type };
            })
            .filter((o): o is OutlineItem => o !== null)
            .slice(0, 3);
          if (parsedOutlines.length === 0) {
            throw new Error("No se obtuvieron outlines válidos");
          }
          setOutlines(parsedOutlines);
          setSelectedOutlineIdx(0);
          setStep(2);
          closeModal();
          break;
        }
        case "article": {
          const markdown = cleanMarkdown(raw);
          if (!markdown || markdown.length < 100) {
            throw new Error(
              "Markdown muy corto. Pega el artículo completo (800-1200 palabras).",
            );
          }
          setArticle(markdown);
          setStep(3);
          closeModal();
          break;
        }
        case "suggest-keywords": {
          const parsed = parseJsonLoose<{
            focus_keyword: string;
            secondary_keywords: string[];
            pain_points_addressed: string[];
          }>(raw);
          if (!parsed || typeof parsed.focus_keyword !== "string") {
            throw new Error(
              'JSON inválido. Esperamos {"focus_keyword": "...", "secondary_keywords": [...], "pain_points_addressed": [...]}',
            );
          }
          const focus = parsed.focus_keyword.trim();
          if (!focus) throw new Error("Focus keyword vacío");
          setFocusKeyword(focus);
          setSecondaryKeywords(
            (Array.isArray(parsed.secondary_keywords)
              ? parsed.secondary_keywords
              : [])
              .map((k) => String(k).trim())
              .filter((k) => k.length > 0)
              .slice(0, 6),
          );
          setPainPoints(
            (Array.isArray(parsed.pain_points_addressed)
              ? parsed.pain_points_addressed
              : [])
              .map((p) => String(p).trim())
              .filter((p) => p.length > 0)
              .slice(0, 5),
          );
          closeModal();
          break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error parseando respuesta";
      setModal((cur) =>
        cur.open ? { ...cur, loading: false, error: msg } : cur,
      );
    }
  };

  // ── Publish flow ────────────────────────────────────────────

  const handleOpenPublish = () => {
    if (!tipo || !categoria || !selectedHeadline || !article) {
      setError("Falta state para publicar");
      return;
    }
    setError(null);
    setPublishOpen(true);
  };

  const handlePublished = (result: {
    slug: string;
    postId: string;
    authorName: string;
  }) => {
    setPublishedInfo(result);
    setPublishOpen(false);
    toast.success(
      `Publicado: "${selectedHeadline.slice(0, 60)}${selectedHeadline.length > 60 ? "…" : ""}" · por ${result.authorName}`,
      {
        link: {
          href: `/noticias/${result.slug}`,
          label: "Ver en sitio público",
        },
        durationMs: 12000,
      },
    );
  };

  // ── Navegación atrás (Plan v5) ──────────────────────────────
  //
  // Filosofía: preservar el trabajo del operador. Atrás permite editar el
  // step anterior sin destruir lo que ya hizo. Solo descartamos lo que
  // forzosamente queda inconsistente con el cambio (ej: si vuelve al brief
  // y lo cambia, el artículo generado puede no calzar — pero NO lo
  // descartamos automático, le pedimos confirmación si lo va a perder).

  const handleBack = () => {
    setError(null);
    if (step === 3) {
      // De artículo a outlines · preserva todo, solo cambia de vista.
      setStep(2);
      return;
    }
    if (step === 2) {
      // De outlines a headlines · preserva headlines + brief.
      // Los outlines no se pierden — si el operador vuelve a step 2 sin
      // cambiar el headline, los outlines siguen ahí.
      setStep(1);
      return;
    }
    if (step === 1) {
      // De step 1 al brief · si hay artículo generado, confirmar antes.
      if (article) {
        const ok = window.confirm(
          "Volver al brief va a descartar el artículo generado. ¿Continuar?",
        );
        if (!ok) return;
        setArticle("");
        setOutlines([]);
        setSelectedOutlineIdx(-1);
        setSelectedHeadline("");
        setHeadlines([]);
      }
      setStep(0);
    }
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Top: back + step indicator + mode toggle */}
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-grey-200 text-grey-700 hover:border-wine hover:text-wine text-[13px] font-semibold transition-colors disabled:opacity-50"
            >
              <span className="inline-flex" aria-hidden>
                {Icon.arrowL(14)}
              </span>
              Atrás
            </button>
          ) : null}
          <StepIndicator current={step} />
        </div>
        <LLMModeToggle
          mode={mode}
          onChange={setMode}
          disabled={isPending || suggesting}
        />
      </div>

      {/* Body */}
      {step === 0 && (
        <Step0Brief
          initialBrief={{ topic, refs: briefRefs, angle: briefAngle }}
          onSubmit={handleBriefSubmit}
          onError={setError}
        />
      )}

      {step === 1 && tipo && categoria && (
        <Step1Headlines
          tipo={tipo}
          onTipoChange={handleTipoChange}
          categoria={categoria}
          onCategoriaChange={setCategoria}
          topic={topic}
          onTopicChange={setTopic}
          tone={tone}
          onToneChange={setTone}
          headlines={headlines}
          onHeadlinesChange={setHeadlines}
          onGenerate={handleGenerateHeadlines}
          onSelect={handleSelectHeadline}
          loading={isPending}
          error={error}
          aiSuggestionReason={aiSuggestionReason}
          categoryDetectorSlot={
            <CategoryDetector
              topic={topic}
              tipo={tipo}
              selectedCategoria={categoria}
              mode={mode}
              onAccept={handleAcceptCategorySuggestion}
            />
          }
          keywordPanelSlot={
            <KeywordPanel
              focusKeyword={focusKeyword}
              secondaryKeywords={secondaryKeywords}
              painPoints={painPoints}
              onChangeFocus={setFocusKeyword}
              onChangeSecondary={setSecondaryKeywords}
              onChangePain={setPainPoints}
              onRequestSuggest={handleSuggestKeywords}
              suggesting={suggesting}
              topicReady={topic.trim().length > 0}
            />
          }
        />
      )}

      {step === 2 && (
        <Step2Outlines
          selectedHeadline={selectedHeadline}
          outlines={outlines}
          selectedOutlineIdx={selectedOutlineIdx}
          onSelectOutline={setSelectedOutlineIdx}
          onUpdateOutline={(idx, next) => {
            setOutlines((cur) =>
              cur.map((o, i) => (i === idx ? next : o)),
            );
          }}
          onGenerateArticle={handleGenerateArticle}
          loading={isPending}
          error={error}
        />
      )}

      {step === 3 && (
        <Step3Article
          selectedHeadline={selectedHeadline}
          markdown={article}
          focusKeyword={focusKeyword}
          painPoints={painPoints}
          onRegenerate={handleGenerateArticle}
          onPublish={handleOpenPublish}
          publishedSlug={publishedInfo?.slug ?? null}
          loading={isPending}
          error={error}
        />
      )}

      {/* Manual modal · failover + modo Manual */}
      {modal.open && (
        <ManualPromptModal
          title={modal.config.title}
          subtitle={modal.config.subtitle}
          prompt={modal.config.prompt}
          inputHint={modal.config.inputHint}
          placeholder={modal.config.placeholder}
          submitLabel={modal.config.submitLabel}
          error={modal.error}
          loading={modal.loading}
          onClose={closeModal}
          onSubmit={handleModalSubmit}
        />
      )}

      {/* Publish modal · Phase E */}
      {publishOpen && tipo && categoria && (
        <PublishModal
          tipo={tipo}
          categoria={categoria}
          headline={selectedHeadline}
          articleMarkdown={article}
          focusKeyword={focusKeyword}
          secondaryKeywords={secondaryKeywords}
          painPoints={painPoints}
          onClose={() => setPublishOpen(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
