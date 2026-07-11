"use client";

/**
 * ServiciosClient — orquestador del módulo Configuración de servicios (SDD-0076 Fase 2).
 *
 * Lista los 20 servicios canónicos agrupados (estructura de código) con su estado
 * de contenido/publicación (DB). Editar abre el asistente (ServicioDrawer); publicar
 * corre el GUARDRAIL (no se publica sin lo descriptivo).
 */

import { useState } from "react";
import {
  SERVICE_GROUPS,
  type MomentoTimeline,
} from "@/lib/shared/service-catalog";
import type {
  ServiceCatalogItem,
  ServiceOfferConfig,
} from "@/lib/studio/service-catalog/queries";
import {
  servicioPublishReadiness,
  type ServiceFaq,
  type ServiceAddon,
  type ServicePriceEntry,
} from "@/lib/studio/service-catalog/types";
import type { ServiceWorkflowStep } from "@/lib/studio/workflow/types";
import type { AwaitingRun } from "@/lib/studio/workflow/queries";
import { toggleServicePublishAction } from "@/lib/studio/service-catalog/actions";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ServicioDrawer } from "./ServicioDrawer";

const TIMELINE_LABEL: Record<MomentoTimeline, string> = {
  todo_recorrido: "Todo el recorrido",
  origen: "En origen",
  recepcion_bodega: "En recepción",
  transporte_aduana: "Transporte y aduana",
  transversal: "Transversal",
};

const STATE_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  activo: "success",
  proximamente: "warning",
  suspendido: "danger",
  "a-pedido": "info",
};

const STATE_LABEL: Record<string, string> = {
  activo: "Activo",
  proximamente: "Próximamente",
  suspendido: "Suspendido",
  "a-pedido": "A pedido",
};

export function ServiciosClient({
  items,
  faqs,
  addons,
  priceEntries,
  offerConfigs,
  workflowSteps,
  awaitingRuns,
}: {
  items: ServiceCatalogItem[];
  faqs: ServiceFaq[];
  addons: ServiceAddon[];
  priceEntries: ServicePriceEntry[];
  offerConfigs: ServiceOfferConfig[];
  workflowSteps: ServiceWorkflowStep[];
  awaitingRuns: AwaitingRun[];
}) {
  const toast = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const editing = items.find((it) => it.catalog.id === editingKey) ?? null;
  const publishedCount = items.filter((it) => it.config?.is_public).length;

  return (
    <div style={{ padding: "var(--s-6) var(--s-6)", maxWidth: 1100 }}>
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <h1 className="studio-display" style={{ margin: 0, fontSize: 24 }}>
          Servicios
        </h1>
        <p
          style={{
            font: "400 13.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "var(--s-2) 0 0",
            maxWidth: 680,
          }}
        >
          Configura cada servicio una sola vez: descripción, alcance, FAQ, precio,
          cómo se cobra y adicionales. Lo que marques como público alimenta el sitio;
          lo interno queda para el equipo.{" "}
          <strong style={{ color: "var(--ink)" }}>
            {publishedCount} de {items.length}
          </strong>{" "}
          publicados.
        </p>
      </header>

      {/* Grupos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {SERVICE_GROUPS.map((group) => {
          const groupItems = items.filter((it) => it.catalog.grupo === group.id);
          if (groupItems.length === 0) return null;
          return (
            <section key={group.id}>
              <h2
                className="studio-eyebrow"
                style={{ color: "var(--ink-soft)", margin: "0 0 var(--s-3)" }}
              >
                {group.titulo}
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: 12,
                }}
              >
                {groupItems.map((it) => (
                  <ServicioCard
                    key={it.catalog.id}
                    item={it}
                    onEdit={() => setEditingKey(it.catalog.id)}
                    onToast={toast}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {editing && (
        <ServicioDrawer
          item={editing}
          onClose={() => setEditingKey(null)}
          faqs={faqs.filter((f) => f.service_key === editing.catalog.id)}
          addons={addons.filter((a) => a.service_key === editing.catalog.id)}
          priceEntries={priceEntries.filter(
            (p) => p.service_key === editing.catalog.id,
          )}
          offerConfig={
            offerConfigs.find((o) => o.service_key === editing.catalog.id) ?? null
          }
          workflowSteps={workflowSteps.filter(
            (s) => s.service_key === editing.catalog.id || s.service_key === null,
          )}
          awaitingRuns={awaitingRuns.filter(
            (r) =>
              r.step_service_key === editing.catalog.id ||
              r.step_service_key === null,
          )}
        />
      )}
    </div>
  );
}

function ServicioCard({
  item,
  onEdit,
  onToast,
}: {
  item: ServiceCatalogItem;
  onEdit: () => void;
  onToast: ReturnType<typeof useToast>;
}) {
  const { catalog, config } = item;
  const isPublic = !!config?.is_public;
  const readiness = config
    ? servicioPublishReadiness(config)
    : { ready: false, missing: ["contenido del servicio"] };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        background: "var(--bg-elevated)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <h3
          style={{
            font: "600 14px/1.3 var(--f-sans)",
            color: "var(--ink)",
            margin: 0,
            flex: 1,
          }}
        >
          {config?.title_public || catalog.nombre}
          {catalog.principal && (
            <span style={{ color: "var(--wine-text)", marginLeft: 6 }}>★</span>
          )}
        </h3>
        <Badge tone={isPublic ? "success" : "neutral"} size="sm">
          {isPublic ? "Publicado" : "Borrador"}
        </Badge>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <Badge tone={catalog.tipo === "nucleo" ? "wine" : "neutral"} size="sm">
          {catalog.tipo === "nucleo" ? "Núcleo" : "Add-on"}
        </Badge>
        <Badge tone="info" size="sm">
          {TIMELINE_LABEL[catalog.momentoTimeline]}
        </Badge>
        <Badge tone={STATE_TONE[catalog.estado] ?? "neutral"} size="sm">
          {STATE_LABEL[catalog.estado] ?? catalog.estado}
        </Badge>
      </div>

      {config?.description_public ? (
        <p
          style={{
            font: "400 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {config.description_public}
        </p>
      ) : (
        <p
          style={{
            font: "400 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          Sin contenido todavía.
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 4,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={onEdit}
        >
          Editar
        </button>
        {isPublic ? (
          <ActionButton
            variant="ghost"
            size="sm"
            idleLabel="Despublicar"
            loadingLabel="Quitando…"
            successLabel="Despublicado"
            onAction={() => toggleServicePublishAction(catalog.id, false)}
            onSuccess={() => onToast.success(`${catalog.nombre} despublicado.`)}
            onError={(m) => onToast.error(m)}
          />
        ) : (
          <ActionButton
            variant="primary"
            size="sm"
            idleLabel="Publicar"
            loadingLabel="Publicando…"
            successLabel="Publicado"
            disabled={!readiness.ready}
            onAction={() => toggleServicePublishAction(catalog.id, true)}
            onSuccess={() => onToast.success(`${catalog.nombre} publicado.`)}
            onError={(m) => onToast.error(m)}
          />
        )}
      </div>
      {!isPublic && !readiness.ready && (
        <p
          style={{
            font: "400 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Para publicar falta: {readiness.missing.join(", ")}.
        </p>
      )}
    </div>
  );
}
