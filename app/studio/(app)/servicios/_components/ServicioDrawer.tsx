"use client";

/**
 * ServicioDrawer — editor de un servicio (SDD-0076 Fase 2 + editor diferido).
 *
 * Pestañas: Servicio (config: público / cómo se cobra / interno) · FAQ ·
 * Adicionales · Precios. La pestaña Servicio es un form (useActionState +
 * upsertServiceConfigAction) con DrawerFooter. Las otras delegan a los
 * sub-editores (FaqEditor/AddonEditor/PriceHistoryEditor), que tienen sus
 * propios forms/acciones; ahí el footer es solo "Cerrar".
 *
 * El guardrail "no publicar con solo lo contable" se aplica al publicar (en la
 * card), no acá: acá se puede guardar incompleto (campos vacíos = pendientes).
 */

import { useActionState, useEffect, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { upsertServiceConfigAction } from "@/lib/studio/service-catalog/actions";
import {
  CHARGE_MOMENT_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SERVICE_STATE_OPTIONS,
  type ServicioConfigActionState,
} from "@/lib/studio/service-catalog/types";
import type {
  ServiceCatalogItem,
  ServiceOfferConfig,
} from "@/lib/studio/service-catalog/queries";
import type {
  ServiceFaq,
  ServiceAddon,
  ServicePriceEntry,
} from "@/lib/studio/service-catalog/types";
import {
  FaqEditor,
  AddonEditor,
  PriceHistoryEditor,
  OfferMatrixEditor,
} from "./ServiceSubEditors";
import { WorkflowEditor } from "./WorkflowEditor";
import type { ServiceWorkflowStep } from "@/lib/studio/workflow/types";
import type { AwaitingRun } from "@/lib/studio/workflow/queries";

const FORM_ID = "servicio-drawer-form";
const initialState: ServicioConfigActionState = {};

type Tab = "servicio" | "oferta" | "flujo" | "faq" | "adicionales" | "precios";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="studio-label" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {(error || hint) && (
        <p
          style={{
            font: "400 11.5px/1.4 var(--f-sans)",
            color: error ? "var(--danger)" : "var(--ink-soft)",
            margin: "var(--s-1) 0 0",
          }}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <legend
      className="studio-eyebrow"
      style={{ color: "var(--ink-soft)", margin: "var(--s-2) 0 var(--s-3)" }}
    >
      {children}
    </legend>
  );
}

export function ServicioDrawer({
  item,
  onClose,
  faqs,
  addons,
  priceEntries,
  offerConfig,
  workflowSteps,
  awaitingRuns,
}: {
  item: ServiceCatalogItem;
  onClose: () => void;
  faqs: ServiceFaq[];
  addons: ServiceAddon[];
  priceEntries: ServicePriceEntry[];
  offerConfig: ServiceOfferConfig | null;
  workflowSteps: ServiceWorkflowStep[];
  awaitingRuns: AwaitingRun[];
}) {
  const toast = useToast();
  const { catalog, config } = item;
  const action = upsertServiceConfigAction.bind(null, catalog.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [tab, setTab] = useState<Tab>("servicio");

  useEffect(() => {
    if (state.ok) {
      toast.success(`${catalog.nombre} guardado.`);
      onClose();
    }
  }, [state, toast, onClose, catalog.nombre]);

  const fe = state.fieldErrors;
  const selectedMethods = config?.payment_methods ?? [];

  const TABS: { id: Tab; label: string }[] = [
    { id: "servicio", label: "Servicio" },
    { id: "oferta", label: "Oferta" },
    { id: "flujo", label: `Flujo (${workflowSteps.length})` },
    { id: "faq", label: `FAQ (${faqs.length})` },
    { id: "adicionales", label: `Adicionales (${addons.length})` },
    { id: "precios", label: `Precios (${priceEntries.length})` },
  ];

  return (
    <DrawerShell
      title={catalog.nombre}
      subtitle={`${catalog.tipo === "nucleo" ? "Servicio núcleo" : "Add-on"} · grupo ${catalog.grupo}`}
      onClose={onClose}
      pending={isPending}
      width={660}
    >
      {/* Tabs */}
      <nav
        role="tablist"
        aria-label="Secciones del servicio"
        className="studio-tabs"
        style={{ margin: "0 var(--s-5)", flexShrink: 0 }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              onClick={() => setTab(t.id)}
              aria-selected={active}
              data-activa={active ? "true" : undefined}
              className="studio-tab"
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Body */}
      {tab === "servicio" ? (
        <form
          id={FORM_ID}
          action={formAction}
          style={{ flex: 1, overflow: "auto", padding: "var(--s-4) var(--s-5) var(--s-5)" }}
        >
          {/* ── Público ── */}
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <SectionTitle>Lo que ve el cliente</SectionTitle>

            <Field label="Nombre visible" error={fe?.title_public}>
              <input
                className="studio-input"
                name="title_public"
                defaultValue={config?.title_public || catalog.nombre}
                required
              />
            </Field>

            <Field
              label="Descripción corta"
              hint="1-2 frases: qué es el servicio."
              error={fe?.description_public}
            >
              <textarea
                className="studio-input"
                name="description_public"
                rows={3}
                defaultValue={config?.description_public ?? ""}
              />
            </Field>

            <Field label="Qué incluye" hint="Una línea por punto.">
              <textarea
                className="studio-input"
                name="includes_public"
                rows={4}
                defaultValue={(config?.includes_public ?? []).join("\n")}
              />
            </Field>

            <Field label="Qué NO incluye" hint="Una línea por punto.">
              <textarea
                className="studio-input"
                name="excludes_public"
                rows={3}
                defaultValue={(config?.excludes_public ?? []).join("\n")}
              />
            </Field>

            <Field label="Cómo se solicita">
              <textarea
                className="studio-input"
                name="how_to_request"
                rows={2}
                defaultValue={config?.how_to_request ?? ""}
              />
            </Field>

            <Field label="Tiempo estimado">
              <input
                className="studio-input"
                name="timelines_public"
                defaultValue={config?.timelines_public ?? ""}
              />
            </Field>

            <Field label="Nota (opcional)">
              <textarea
                className="studio-input"
                name="note_public"
                rows={2}
                defaultValue={config?.note_public ?? ""}
              />
            </Field>
          </fieldset>

          {/* ── Cómo se cobra ── */}
          <fieldset
            style={{ border: 0, margin: 0, padding: 0, borderTop: "1px solid var(--border)", paddingTop: 16 }}
          >
            <SectionTitle>Cómo se cobra</SectionTitle>

            <Field label="Precio (texto)" hint="Rango, condición o cómo se calcula. No publiques precios internos.">
              <textarea
                className="studio-input"
                name="price_text"
                rows={2}
                defaultValue={config?.price_text ?? ""}
              />
            </Field>

            <Field label="En qué parte se cobra" error={fe?.charge_moment}>
              <select
                className="studio-input"
                name="charge_moment"
                defaultValue={config?.charge_moment ?? ""}
              >
                <option value="">— Sin definir —</option>
                {CHARGE_MOMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Métodos de pago" error={fe?.payment_methods}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      font: "400 12.5px/1 var(--f-sans)",
                      color: "var(--ink)",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="payment_methods"
                      value={o.value}
                      defaultChecked={selectedMethods.includes(o.value)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </Field>
          </fieldset>

          {/* ── Interno + estado ── */}
          <fieldset
            style={{ border: 0, margin: 0, padding: 0, borderTop: "1px solid var(--border)", paddingTop: 16 }}
          >
            <SectionTitle>Interno (no sale al sitio)</SectionTitle>

            <Field label="Notas internas">
              <textarea
                className="studio-input"
                name="notes_internal"
                rows={2}
                defaultValue={config?.notes_internal ?? ""}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Precio de referencia interno">
                <input
                  className="studio-input"
                  name="internal_price_ref"
                  placeholder="ej. ~550/CBM"
                  defaultValue={config?.internal_price_ref ?? ""}
                />
              </Field>
              <Field label="Mapeo contable">
                <input
                  className="studio-input"
                  name="mapeo_contable"
                  placeholder="categoría de ingreso"
                  defaultValue={config?.mapeo_contable ?? ""}
                />
              </Field>
            </div>

            <Field label="Condiciones y políticas (legal)">
              <textarea
                className="studio-input"
                name="condiciones_politicas"
                rows={2}
                defaultValue={config?.condiciones_politicas ?? ""}
              />
            </Field>

            <Field label="Estado" error={fe?.service_state}>
              <select
                className="studio-input"
                name="service_state"
                defaultValue={config?.service_state ?? catalog.estado}
              >
                {SERVICE_STATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>

          {state.error && (
            <div style={{ marginTop: "var(--s-2)" }}>
              <Aviso tono="error" compacto>
                {state.error}
              </Aviso>
            </div>
          )}
        </form>
      ) : (
        <div style={{ flex: 1, overflow: "auto", padding: "var(--s-4) var(--s-5) var(--s-5)" }}>
          {tab === "oferta" && (
            <OfferMatrixEditor catalog={catalog} offerConfig={offerConfig} />
          )}
          {tab === "flujo" && (
            <WorkflowEditor
              serviceKey={catalog.id}
              steps={workflowSteps}
              awaiting={awaitingRuns}
            />
          )}
          {tab === "faq" && <FaqEditor serviceKey={catalog.id} faqs={faqs} />}
          {tab === "adicionales" && (
            <AddonEditor serviceKey={catalog.id} addons={addons} />
          )}
          {tab === "precios" && (
            <PriceHistoryEditor serviceKey={catalog.id} entries={priceEntries} />
          )}
        </div>
      )}

      {/* Footer */}
      {tab === "servicio" ? (
        <DrawerFooter
          formId={FORM_ID}
          onClose={onClose}
          isPending={isPending}
          canSubmit={!isPending}
          submitLabel="Guardar servicio"
        />
      ) : (
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      )}
    </DrawerShell>
  );
}
