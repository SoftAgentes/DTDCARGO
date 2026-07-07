"use client";

/**
 * Config del mapa estado-del-estimado → etapa de Kommo (SDD-0084). Va dentro de un
 * SectionCard de la pestaña Dirección. 3 filas (enviado/aceptado/rechazado), cada
 * una con su nombre como encabezado + embudo + etapa (filtrada por embudo). Guarda
 * vía saveKommoStageMapAction (admin-only). Solo tokens `var(--*)` + clases del
 * sistema (studio-input/btn/label) + Badge — coherente con el panel de write-back.
 */

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  ESTIMATE_STAGE_KEYS,
  ESTIMATE_STAGE_LABELS,
  type EstimateStageKey,
  type KommoPipelineRow,
  type KommoStageMap,
  type KommoStatusRow,
} from "@/lib/studio/kommo-types";
import { saveKommoStageMapAction } from "../actions";

type Draft = Record<EstimateStageKey, { pipeline_id: number; status_id: number }>;

function toDraft(initial: KommoStageMap): Draft {
  const d = {} as Draft;
  for (const k of ESTIMATE_STAGE_KEYS) {
    d[k] = {
      pipeline_id: initial[k]?.pipeline_id ?? 0,
      status_id: initial[k]?.status_id ?? 0,
    };
  }
  return d;
}

/** Arma el payload limpio o señala la primera fila a medio completar. */
function buildPayload(
  draft: Draft,
): { map: KommoStageMap } | { incomplete: EstimateStageKey } {
  const map: KommoStageMap = {};
  for (const k of ESTIMATE_STAGE_KEYS) {
    const { pipeline_id, status_id } = draft[k];
    const hasP = pipeline_id > 0;
    const hasS = status_id > 0;
    if (hasP !== hasS) return { incomplete: k };
    if (hasP && hasS) map[k] = { pipeline_id, status_id };
  }
  return { map };
}

function sameMap(a: KommoStageMap, b: KommoStageMap): boolean {
  for (const k of ESTIMATE_STAGE_KEYS) {
    const x = a[k];
    const y = b[k];
    if (!x && !y) continue;
    if (!x || !y) return false;
    if (x.pipeline_id !== y.pipeline_id || x.status_id !== y.status_id) return false;
  }
  return true;
}

export function StageMapConfig({
  pipelines,
  statuses,
  initial,
  canEdit,
}: {
  pipelines: KommoPipelineRow[];
  statuses: KommoStatusRow[];
  initial: KommoStageMap;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [pending, startTransition] = useTransition();

  // Etapas por embudo, para acotar el segundo select a la selección del primero.
  const statusesByPipeline = useMemo(() => {
    const m = new Map<number, KommoStatusRow[]>();
    for (const s of statuses) {
      const arr = m.get(s.pipeline_id) ?? [];
      arr.push(s);
      m.set(s.pipeline_id, arr);
    }
    return m;
  }, [statuses]);

  const mappedCount = ESTIMATE_STAGE_KEYS.filter(
    (k) => draft[k].pipeline_id > 0 && draft[k].status_id > 0,
  ).length;

  const setPipeline = (key: EstimateStageKey, pid: number) =>
    setDraft((prev) => {
      const same = prev[key].pipeline_id === pid;
      // Cambiar de embudo invalida la etapa elegida (pertenece al embudo anterior).
      return {
        ...prev,
        [key]: { pipeline_id: pid, status_id: same ? prev[key].status_id : 0 },
      };
    });

  const setStatus = (key: EstimateStageKey, sid: number) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], status_id: sid } }));

  const save = () => {
    const result = buildPayload(draft);
    if ("incomplete" in result) {
      toast.error(
        `Completa el embudo y la etapa para "${ESTIMATE_STAGE_LABELS[result.incomplete]}" (o deja ambos en "Sin mapear").`,
      );
      return;
    }
    if (sameMap(result.map, initial)) {
      toast.success("No hay cambios que guardar.");
      return;
    }
    startTransition(async () => {
      const res = await saveKommoStageMapAction(result.map);
      if (res.ok) toast.success("Mapa de etapas guardado.");
      else toast.error(res.error ?? "No se pudo guardar el mapa.");
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Badge tone={mappedCount > 0 ? "success" : "neutral"} dot>
          {mappedCount > 0 ? `${mappedCount} de 3 mapeadas` : "Sin mapear"}
        </Badge>
      </div>

      <p
        style={{
          font: "400 12px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
        }}
      >
        Cuando un estimado pasa a cada estado, su lead vinculado se mueve a la etapa
        de Kommo que elijas aquí. Déjalo en <strong>Sin mapear</strong> para no mover
        el lead en ese estado. Se aplica con el mismo interruptor del write-back (hoy
        en ensayo).
      </p>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {ESTIMATE_STAGE_KEYS.map((key) => {
          const row = draft[key];
          const opts = statusesByPipeline.get(row.pipeline_id) ?? [];
          const unmapped = row.pipeline_id === 0;
          return (
            <div
              key={key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                paddingTop: 12,
                marginTop: 12,
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ font: "700 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                  {ESTIMATE_STAGE_LABELS[key]}
                </span>
                {unmapped && (
                  <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
                    · no mueve el lead
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 10,
                }}
              >
                <div>
                  <label className="studio-label" htmlFor={`sm-pipe-${key}`}>
                    Embudo
                  </label>
                  <select
                    id={`sm-pipe-${key}`}
                    className="studio-input"
                    disabled={!canEdit || pending}
                    value={row.pipeline_id || ""}
                    onChange={(e) => setPipeline(key, Number(e.target.value) || 0)}
                  >
                    <option value="">Sin mapear</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name ?? `Embudo #${p.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="studio-label" htmlFor={`sm-stat-${key}`}>
                    Etapa
                  </label>
                  <select
                    id={`sm-stat-${key}`}
                    className="studio-input"
                    disabled={!canEdit || pending || !row.pipeline_id}
                    value={row.status_id || ""}
                    onChange={(e) => setStatus(key, Number(e.target.value) || 0)}
                  >
                    <option value="">{row.pipeline_id ? "Elegir etapa…" : "—"}</option>
                    {opts.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name ?? `Etapa #${s.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 2,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-dark studio-btn-sm"
          disabled={!canEdit || pending}
          onClick={save}
        >
          {pending ? "Guardando…" : "Guardar mapa"}
        </button>
        {!canEdit && (
          <span
            style={{
              font: "500 11.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Solo un administrador puede editar el mapa.
          </span>
        )}
      </div>
    </div>
  );
}
