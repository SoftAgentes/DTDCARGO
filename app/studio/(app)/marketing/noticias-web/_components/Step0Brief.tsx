/**
 * Step0Brief · Plan v5 — Brief editorial (reemplaza a Step0Tipo).
 *
 * El operador describe la nota antes de cualquier clasificación:
 *  - Tema (textarea, requerido, max 500)
 *  - Hasta 3 links de referencia (opcional, validados como URL)
 *  - Ángulo en 1 oración (opcional, max 280)
 *
 * Al apretar "Detectar tipo + continuar" se dispara `detectBriefIntent`
 * (server action) que llama a Claude y devuelve {tipo, categoria,
 * tone_suggested, reason}. El parent (NoticiasWebClient) recibe el
 * resultado, populá el state derivado, y avanza al step 1.
 *
 * Flow nuevo: tema viene primero, el tipo se deriva — refleja cómo
 * funciona un newsroom real (editor jefe feedback).
 */

"use client";

import React, { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import type { NewsBrief } from "@/lib/news/prompts";
import type { DetectBriefIntentResult, ErrorResult } from "../actions";

interface Props {
  initialBrief: NewsBrief;
  onSubmit: (brief: NewsBrief) => Promise<DetectBriefIntentResult | ErrorResult>;
  onError: (msg: string) => void;
}

const TOPIC_MAX = 500;
const ANGLE_MAX = 280;
const REFS_MAX = 3;

export function Step0Brief({ initialBrief, onSubmit, onError }: Props) {
  const [topic, setTopic] = useState(initialBrief.topic);
  const [refs, setRefs] = useState<string[]>(
    initialBrief.refs.length > 0 ? initialBrief.refs : [""],
  );
  const [angle, setAngle] = useState(initialBrief.angle);

  const canSubmit =
    topic.trim().length > 0 && topic.trim().length <= TOPIC_MAX;

  const cleanRefs = refs.map((r) => r.trim()).filter((r) => r.length > 0);

  const addRef = () => {
    if (refs.length < REFS_MAX) setRefs([...refs, ""]);
  };
  const updateRef = (i: number, v: string) => {
    setRefs(refs.map((r, idx) => (idx === i ? v : r)));
  };
  const removeRef = (i: number) => {
    const next = refs.filter((_, idx) => idx !== i);
    setRefs(next.length === 0 ? [""] : next);
  };

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <span className="eyebrow">Paso 0 · Brief editorial</span>
        <h2
          className="mt-3 text-ink"
          style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}
        >
          ¿Sobre qué <span className="text-wine">quieres escribir</span>?
        </h2>
        <p className="mt-2 text-[13.5px] text-grey-500 max-w-[70ch] leading-relaxed">
          Cuéntale el tema, pégale links de referencia si los tienes, y deja claro
          qué se debe llevar el lector. El tipo editorial, la categoría y el
          tono los sugiere Claude automáticamente — los puedes editar después.
        </p>
      </div>

      {/* Tema */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="brief-topic"
          className="text-[13px] font-semibold text-ink"
        >
          Tema <span className="text-wine">*</span>
        </label>
        <textarea
          id="brief-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={TOPIC_MAX}
          rows={3}
          required
          placeholder="Ej: Cómo calcular el costo real de importar electrónica desde Yiwu con DDP en 2026"
          className="w-full bg-white border border-grey-200 rounded-lg p-3 text-[14px] text-ink placeholder:text-grey-300 focus:border-wine focus:outline-none transition-colors resize-y"
        />
        <div className="flex justify-end text-[11px] text-grey-500">
          {topic.length} / {TOPIC_MAX}
        </div>
      </div>

      {/* Links de referencia */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label className="text-[13px] font-semibold text-ink">
            Links de referencia{" "}
            <span className="text-grey-500 font-normal">
              (opcional, hasta {REFS_MAX})
            </span>
          </label>
          <span className="text-[11px] text-grey-500">
            {cleanRefs.length} / {REFS_MAX}
          </span>
        </div>
        <p className="text-[12px] text-grey-500">
          Artículos, fuentes, posts de competidores. Claude los considera al
          sugerir el tipo + ángulo.
        </p>
        <div className="flex flex-col gap-2">
          {refs.map((ref, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="inline-flex text-grey-300 flex-shrink-0"
                aria-hidden
              >
                {Icon.link(14)}
              </span>
              <input
                type="url"
                value={ref}
                onChange={(e) => updateRef(i, e.target.value)}
                placeholder="https://…"
                className="flex-1 bg-white border border-grey-200 rounded-lg px-3 py-2 text-[13.5px] text-ink placeholder:text-grey-300 focus:border-wine focus:outline-none transition-colors"
              />
              {(refs.length > 1 || ref.trim().length > 0) && (
                <button
                  type="button"
                  onClick={() => removeRef(i)}
                  className="text-grey-500 hover:text-wine p-1 rounded transition-colors flex-shrink-0"
                  aria-label="Quitar este link"
                  title="Quitar este link"
                >
                  {Icon.close(16)}
                </button>
              )}
            </div>
          ))}
          {refs.length < REFS_MAX && (
            <button
              type="button"
              onClick={addRef}
              className="inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-grey-700 hover:text-wine transition-colors mt-1"
            >
              <span className="inline-flex" aria-hidden>
                {Icon.plus(14)}
              </span>
              Agregar otro link
            </button>
          )}
        </div>
      </div>

      {/* Ángulo */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="brief-angle"
          className="text-[13px] font-semibold text-ink"
        >
          Ángulo editorial{" "}
          <span className="text-grey-500 font-normal">(opcional)</span>
        </label>
        <p className="text-[12px] text-grey-500">
          ¿Qué se debe llevar el lector? Una oración. Define el tono editorial.
        </p>
        <textarea
          id="brief-angle"
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          maxLength={ANGLE_MAX}
          rows={2}
          placeholder="Ej: El importador VE típico subestima IVA + flete interno y termina pagando 25% más sin saberlo"
          className="w-full bg-white border border-grey-200 rounded-lg p-3 text-[14px] text-ink placeholder:text-grey-300 focus:border-wine focus:outline-none transition-colors resize-y"
        />
        <div className="flex justify-end text-[11px] text-grey-500">
          {angle.length} / {ANGLE_MAX}
        </div>
      </div>

      {/* CTA */}
      <div className="pt-2">
        <ActionButton
          variant="dark"
          size="default"
          idleLabel="Detectar tipo + continuar"
          loadingLabel="Claude está leyendo el brief…"
          successLabel={null}
          idleIcon={Icon.arrowR(14)}
          disabled={!canSubmit}
          onAction={async () => {
            const brief: NewsBrief = {
              topic: topic.trim(),
              refs: cleanRefs,
              angle: angle.trim(),
            };
            const res = await onSubmit(brief);
            if (!res.ok) return { error: res.error };
          }}
          onError={onError}
        />
      </div>
    </div>
  );
}
