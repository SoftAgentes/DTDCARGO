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
  buildGenerateBulletsPrompt,
  buildGenerateArticlePrompt,
  buildSuggestKeywordsPrompt,
  type NewsBrief,
} from "@/lib/news/prompts";
import { StepIndicator } from "./StepIndicator";
import { Step0Brief } from "./Step0Brief";
import { Step1Headlines } from "./Step1Headlines";
import { Step2Structure, type BulletState } from "./Step2Structure";
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
  generateBullets,
  generateHeadlines,
  suggestKeywords,
  type BulletItem,
  type DetectBriefIntentResult,
  type ErrorResult,
  type Tone,
} from "../actions";

type Step = 0 | 1 | 2 | 3;
type ModalKind = "headlines" | "bullets" | "article" | "suggest-keywords";

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

/** Mapea BulletItem[] (action) → BulletState[] (UI) con id estable. */
function mapBulletsToState(items: BulletItem[]): BulletState[] {
  const stamp = Date.now();
  return items.map((b, i) => ({
    id: `b-${i}-${stamp}`,
    title: b.title,
    desc: b.desc,
    selected: true,
  }));
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

  // Step 1 — flag de sugerencia IA aceptada (para el draft persistido en Phase E)
  const [_aiSuggestionReason, setAiSuggestionReason] = useState<string | null>(null);

  // Step 2 state
  const [selectedHeadline, setSelectedHeadline] = useState("");
  const [bullets, setBullets] = useState<BulletState[]>([]);

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
        subtitle: "Pegá el JSON que devuelva claude.ai con focus + secundarias + pain points",
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
              subtitle: "La API falló — completalo en Manual para no perder el flow",
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
          'Pegá el JSON {"headlines": ["...", "..."]} que devuelva claude.ai',
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
            subtitle: "La API falló — usá Manual para no perder el momentum",
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

    const secondaryOpt =
      secondaryKeywords.length > 0 ? secondaryKeywords : undefined;
    const prompt = buildGenerateBulletsPrompt(h, categoria, secondaryOpt);

    if (mode === "manual") {
      // No avanzamos a Step 2 todavía — esperamos respuesta del modal
      openManualModal({
        kind: "bullets",
        title: "Generar estructura del artículo",
        subtitle: 'Pegá el JSON {"bullets": [...]} con 8-10 secciones',
        prompt,
        inputHint:
          'Esperamos {"bullets": [{"title": "...", "desc": "..."}, ...]}',
        placeholder: '{"bullets": [{"title": "...", "desc": "..."}]}',
        submitLabel: "Cargar estructura",
      });
      return;
    }

    setStep(2);
    startTransition(async () => {
      const res = await generateBullets(h, categoria, secondaryOpt);
      if (!res.ok) {
        openManualModal(
          {
            kind: "bullets",
            title: "Generar estructura (failover Manual)",
            subtitle: "La API falló — completá en Manual y seguimos",
            prompt,
            inputHint: 'Esperamos {"bullets": [{"title": "...", "desc": "..."}]}',
            placeholder: '{"bullets": [...]}',
            submitLabel: "Cargar estructura",
          },
          res.error,
        );
        return;
      }
      setBullets(mapBulletsToState(res.bullets));
    });
  };

  // ── Step 2 → 3 ──────────────────────────────────────────────

  const handleGenerateArticle = () => {
    const selectedBullets = bullets
      .filter((b) => b.selected)
      .map((b) => ({ title: b.title, desc: b.desc }));
    if (selectedBullets.length === 0) {
      setError("Seleccioná al menos 1 sección");
      return;
    }
    setError(null);

    const focusOpt = focusKeyword.trim() || undefined;
    const secondaryOpt =
      secondaryKeywords.length > 0 ? secondaryKeywords : undefined;

    const prompt = buildGenerateArticlePrompt(
      selectedHeadline,
      selectedBullets,
      focusOpt,
      secondaryOpt,
    );

    if (mode === "manual") {
      openManualModal({
        kind: "article",
        title: "Generar artículo Markdown",
        subtitle: "Pegá el Markdown puro (sin fences ```) que devuelva claude.ai",
        prompt,
        inputHint:
          "Esperamos Markdown directo — empezando con párrafo de intro (sin H1), luego ## H2 por sección.",
        placeholder: "Pegá acá el artículo Markdown completo…",
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
      );
      if (!res.ok) {
        openManualModal(
          {
            kind: "article",
            title: "Generar artículo (failover Manual)",
            subtitle: "La API falló — pegá el Markdown manual y seguimos",
            prompt,
            inputHint: "Esperamos Markdown directo, sin fences.",
            placeholder: "Pegá acá el artículo Markdown…",
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
        case "bullets": {
          const parsed = parseJsonLoose<{ bullets: BulletItem[] }>(raw);
          if (!parsed || !Array.isArray(parsed.bullets)) {
            throw new Error(
              'JSON inválido. Esperamos {"bullets": [{"title": "...", "desc": "..."}]}',
            );
          }
          const items = parsed.bullets
            .map((b) => ({
              title: String(b?.title ?? "").trim(),
              desc: String(b?.desc ?? "").trim(),
            }))
            .filter((b) => b.title.length > 0);
          if (items.length < 4) {
            throw new Error("Se esperaban al menos 4 bullets");
          }
          setBullets(mapBulletsToState(items));
          setStep(2);
          closeModal();
          break;
        }
        case "article": {
          const markdown = cleanMarkdown(raw);
          if (!markdown || markdown.length < 100) {
            throw new Error(
              "Markdown muy corto. Pegá el artículo completo (800-1200 palabras).",
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
      // De estructura a headlines · preserva headlines + brief.
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
        setBullets([]);
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
        <Step2Structure
          selectedHeadline={selectedHeadline}
          bullets={bullets}
          onBulletsChange={setBullets}
          onGenerate={handleGenerateArticle}
          loading={isPending}
          error={error}
        />
      )}

      {step === 3 && (
        <Step3Article
          selectedHeadline={selectedHeadline}
          markdown={article}
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
